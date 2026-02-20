package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/ai"
	"github.com/aavishay/kubetriage/backend/internal/api"
	"github.com/aavishay/kubetriage/backend/internal/cache"
	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/aavishay/kubetriage/backend/internal/ui"
	"github.com/aavishay/kubetriage/backend/internal/watcher"
)

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	port := getEnv("PORT", "3001")
	databaseURL := getEnv("DATABASE_URL", "kubetriage.db")
	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")

	// 1. Redis (optional — logs warning on failure, does not exit)
	cache.InitRedis(redisAddr)

	// 2. Database
	if _, err := db.InitDB(databaseURL); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	log.Println("Database initialized")

	// 3. Kubernetes Cluster Manager
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

	// 4. AI Service (requires at least one provider: Gemini or Ollama)
	aiService, err := ai.NewAIService(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize AI service: %v", err)
	}
	defer aiService.Close()
	log.Println("AI service initialized")

	// 5. Background Watcher (depends on k8s.GlobalManager being set)
	w := watcher.InitWatcher(ctx, aiService)
	defer w.Stop()
	log.Println("Cluster watcher started")

	// 5. Static Frontend Files (embedded at compile time)
	rootFS := ui.GetStaticFS()
	assetsFS := ui.GetAssetsFS()
	indexHTML, err := ui.GetIndexHTML()
	if err != nil {
		log.Printf("Warning: frontend index.html not found — serving API only. Run `make build` to embed the frontend. Error: %v", err)
	}

	// 6. HTTP Router
	router := api.SetupRouter(aiService, rootFS, assetsFS, indexHTML)

	// 7. HTTP Server with graceful shutdown
	srv := &http.Server{
		Addr:    ":" + port,
		Handler: router,
	}

	go func() {
		log.Printf("KubeTriage listening on http://localhost:%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

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
}
