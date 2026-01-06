package main

import (
	"context"
	"log"
	"os"

	"github.com/aavishay/kubetriage/backend/internal/api"
	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
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
	_, err := k8s.InitK8sClient()
	if err != nil {
		log.Printf("Warning: Failed to initialize K8s client: %v", err)
	} else {
		log.Println("Kubernetes client initialized successfully")
	}

	// Init Database
	_, err = db.InitDB(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Printf("Error connecting to DB: %v", err)
	}

	// Setup Router
	r := api.SetupRouter()

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	log.Printf("Starting server on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal("Failed to start server: ", err)
	}
}
