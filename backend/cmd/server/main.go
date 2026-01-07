package main

import (
	"context"
	"log"
	"os"

	"github.com/aavishay/kubetriage/backend/internal/ai"
	"github.com/aavishay/kubetriage/backend/internal/api"
	"github.com/aavishay/kubetriage/backend/internal/cache"
	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/aavishay/kubetriage/backend/internal/prometheus"
	"github.com/aavishay/kubetriage/backend/internal/scheduler"
	"github.com/aavishay/kubetriage/backend/internal/telemetry"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env if exists
	_ = godotenv.Load()

	// Init Tracing
	ctx := context.Background()
	shutdown, err := telemetry.InitTracer(ctx, "kubetriage-backend", os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"))
	if err != nil {
		log.Printf("Warning: Failed to init tracer: %v", err)
	} else {
		defer func() {
			if err := shutdown(ctx); err != nil {
				log.Printf("Error shutting down tracer: %v", err)
			}
		}()
	}

	// Init K8s Client
	_, err = k8s.InitK8sClient()
	if err != nil {
		log.Printf("Warning: Failed to initialize K8s client: %v", err)
	} else {
		log.Println("Kubernetes client initialized successfully")

	}

	// Init Database
	_, err = db.InitDB(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Printf("Error connecting to DB: %v", err)
	} else {
		// Sync Clusters to Default Project (Multi-Tenancy MVP)
		var defaultProject db.Project
		// Wait for default project seeding (simple retry or sleep, or just check)
		// Since seed is in a goroutine, strict consistency might require wait,
		// but GORM access is safe. We'll attempt a quick sync.
		if err := db.DB.Where("name = ?", "Default").First(&defaultProject).Error; err == nil {
			mgr := k8s.GetClusterManager()
			if mgr != nil {
				for _, cls := range mgr.ListClusters() {
					var count int64
					db.DB.Model(&db.ClusterProject{}).Where("cluster_id = ?", cls.ID).Count(&count)
					if count == 0 {
						log.Printf("Auto-assigning cluster '%s' to Default Project", cls.Name)
						db.DB.Create(&db.ClusterProject{
							ClusterID: cls.ID,
							ProjectID: defaultProject.ID,
						})
					}
				}
			}
		}
	}

	// Init Redis
	cache.InitRedis(os.Getenv("REDIS_ADDR"))

	// Init Prometheus Client
	err = prometheus.InitPrometheusClient()
	if err != nil {
		log.Printf("Warning: Failed to init Prometheus client: %v", err)
	} else {
		log.Println("Prometheus client initialized")
	}

	// Init AI Service
	aiService, err := ai.NewAIService(ctx)
	if err != nil {
		log.Printf("Warning: Failed to init AI service: %v", err)
	} else {
		defer aiService.Close()
	}

	// Setup Router
	r := api.SetupRouter(aiService)

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	// Init Scheduler
	scheduler.InitScheduler()
	defer scheduler.StopScheduler()

	log.Printf("Starting server on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal("Failed to start server: ", err)
	}
}
