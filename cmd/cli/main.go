package cli

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/ai"
	"github.com/aavishay/kubetriage/backend/internal/api"
	"github.com/aavishay/kubetriage/backend/internal/cache"
	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/gitops"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/aavishay/kubetriage/backend/internal/ml"
	"github.com/aavishay/kubetriage/backend/internal/telemetry"
	"github.com/aavishay/kubetriage/backend/internal/ui"
	"github.com/aavishay/kubetriage/backend/internal/watcher"
	"github.com/spf13/cobra"
)

var (
	port        string
	noOpen      bool
	diffCluster string
)

var rootCmd = &cobra.Command{
	Use:   "kubetriage",
	Short: "KubeTriage - Autonomous SRE Guard",
	Long:  `KubeTriage is an Autonomous SRE Guard that proactively detects, triages, and suggests fixes for Kubernetes cluster health issues.`,
}

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start the KubeTriage web server",
	RunE:  runServe,
}

var gitopsCmd = &cobra.Command{
	Use:   "gitops",
	Short: "GitOps inspection commands",
}

var argocdDiffCmd = &cobra.Command{
	Use:   "argocd-diff",
	Short: "Show compact ArgoCD application diffs",
	Long:  `Lists every ArgoCD Application on the cluster and shows the per-resource sync action (configured, unchanged, created, pruned) from the Application CRD status.`,
	RunE:  runArgoCDDiff,
}

func init() {
	rootCmd.AddCommand(serveCmd)
	rootCmd.AddCommand(gitopsCmd)
	gitopsCmd.AddCommand(argocdDiffCmd)
	serveCmd.Flags().StringVar(&port, "port", "3001", "Port to listen on")
	serveCmd.Flags().BoolVar(&noOpen, "no-open", false, "Don't open browser automatically")
	argocdDiffCmd.Flags().StringVar(&diffCluster, "cluster", "", "Cluster ID/context to use (defaults to first registered cluster)")
}

func runServe(cmd *cobra.Command, _ []string) error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if envPort := os.Getenv("PORT"); envPort != "" {
		port = envPort
	}

	// 1. Redis (optional — logs warning on failure, does not exit)
	cache.InitRedis(os.Getenv("REDIS_ADDR"))

	// 2. Database
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "kubetriage.db"
	}
	if _, err := db.InitDB(databaseURL); err != nil {
		return fmt.Errorf("failed to initialize database: %w", err)
	}
	log.Println("Database initialized")

	// 3. OpenTelemetry Tracing (optional)
	if otelEndpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"); otelEndpoint != "" {
		shutdownTracer, err := telemetry.InitTracer(ctx, "kubetriage", otelEndpoint)
		if err != nil {
			log.Printf("Warning: failed to initialize OpenTelemetry tracer: %v", err)
		} else {
			defer func() {
				if err := shutdownTracer(ctx); err != nil {
					log.Printf("Warning: failed to shutdown tracer: %v", err)
				}
			}()
			log.Println("OpenTelemetry tracer initialized")
		}
	}

	// 4. Kubernetes Cluster Manager
	if _, err := k8s.InitK8sClient(); err != nil {
		log.Printf("Warning: Kubernetes client initialization failed: %v", err)
		log.Printf("Clusters from kubeconfig will not be available. You can register clusters manually via the UI.")
	} else {
		clusters := k8s.Manager.ListClusters()
		log.Printf("Kubernetes manager initialized with %d cluster(s)", len(clusters))
		for _, c := range clusters {
			log.Printf("  - Loaded cluster: %s", c.Name)
		}
	}

	// 5. AI Service
	aiService, err := ai.NewAIService(ctx)
	if err != nil {
		return fmt.Errorf("failed to initialize AI service: %w", err)
	}
	defer aiService.Close()
	log.Println("AI service initialized")

	// 6. Background Watcher
	w := watcher.InitWatcher(ctx, aiService)
	defer w.Stop()
	log.Println("Cluster watcher started")

	// 7. ML Service
	mlService := ml.NewService()
	mlService.Start(ctx)
	log.Println("ML service initialized")

	// 8. Static Frontend Files
	rootFS := ui.GetStaticFS()
	assetsFS := ui.GetAssetsFS()
	indexHTML, err := ui.GetIndexHTML()
	if err != nil {
		log.Printf("Warning: frontend index.html not found — serving API only. Run `make build` to embed the frontend. Error: %v", err)
	}

	// 9. HTTP Router
	router := api.SetupRouter(api.RouterConfig{
		AIService: aiService,
		MLService: mlService,
		RootFS:    rootFS,
		AssetsFS:  assetsFS,
		IndexHTML: indexHTML,
	})

	// 10. HTTP Server
	addr := ":" + port
	srv := &http.Server{Addr: addr, Handler: router}

	go func() {
		log.Printf("KubeTriage listening on http://localhost:%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Open browser unless --no-open is set
	if !noOpen {
		go func() {
			url := "http://localhost:" + port
			var err error
			switch runtime.GOOS {
			case "linux":
				err = exec.Command("xdg-open", url).Run()
			default:
				err = exec.Command("open", url).Run()
			}
			if err != nil {
				log.Printf("Warning: could not open browser: %v", err)
			}
		}()
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}
	log.Println("Server stopped")
	return nil
}

func runArgoCDDiff(_ *cobra.Command, _ []string) error {
	ctx := context.Background()

	if _, err := k8s.InitK8sClient(); err != nil {
		return fmt.Errorf("failed to initialize Kubernetes client: %w", err)
	}

	var clusterID string
	if diffCluster != "" {
		clusterID = diffCluster
	} else if k8s.Manager != nil && len(k8s.Manager.ListClusters()) > 0 {
		clusterID = k8s.Manager.ListClusters()[0].ID
	} else {
		return fmt.Errorf("no clusters configured")
	}

	cluster, err := k8s.Manager.GetOrConnectCluster(clusterID)
	if err != nil {
		return fmt.Errorf("cannot connect to cluster %s: %w", clusterID, err)
	}
	if cluster == nil || cluster.DynamicClient == nil {
		return fmt.Errorf("cluster %s is not reachable", clusterID)
	}

	apps, err := gitops.DiffArgoCDApplications(ctx, cluster)
	if err != nil {
		return fmt.Errorf("failed to diff ArgoCD applications: %w", err)
	}

	if len(apps) == 0 {
		fmt.Println("No ArgoCD Applications found (ArgoCD may not be installed).")
		return nil
	}

	fmt.Printf("ArgoCD diffs for cluster %s\n\n", clusterID)
	for _, app := range apps {
		fmt.Printf("%s/%s  sync=%s  health=%s  changed=%d/%d  rev=%s\n",
			app.Namespace, app.Name, app.SyncStatus, app.HealthStatus,
			app.ChangedCount, app.ResourceCount, truncateRev(app.Revision))
		for _, r := range app.Resources {
			if r.Action == "unchanged" && r.SyncStatus == "Synced" && !r.RequiresPruning {
				continue
			}
			prefix := "  "
			var marker string
			switch r.Action {
			case "created":
				marker = "+"
			case "pruned":
				marker = "-"
			case "configured", "modified":
				marker = "~"
			default:
				marker = "?"
			}
			name := r.Name
			if r.Namespace != "" {
				name = fmt.Sprintf("%s/%s", r.Namespace, r.Name)
			}
			msg := ""
			if r.Message != "" && r.Message != r.Action {
				msg = fmt.Sprintf(" (%s)", r.Message)
			}
			fmt.Printf("%s%s %s/%s%s  %s\n", prefix, marker, r.Kind, name, msg, r.Action)
		}
		fmt.Println()
	}

	return nil
}

func truncateRev(rev string) string {
	if len(rev) > 12 {
		return rev[:12]
	}
	return rev
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
