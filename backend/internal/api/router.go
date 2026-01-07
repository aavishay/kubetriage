package api

import (
	"time"

	"github.com/aavishay/kubetriage/backend/internal/ai"
	"github.com/aavishay/kubetriage/backend/internal/auth"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
)

func SetupRouter(aiService *ai.AIService) *gin.Engine {
	r := gin.Default()

	// CORS Config
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// OpenTelemetry Middleware
	r.Use(otelgin.Middleware("kubetriage-backend"))

	// Auth Middleware
	// r.Use(auth.AuthMiddleware()) // Removed global middleware, apply only to protected

	// Init OAuth
	auth.InitOAuth()

	// Init Handlers
	aiHandler := NewAIHandler(aiService)

	api := r.Group("/api")
	{
		// ... (public routes)

		// Protected Routes
		protected := api.Group("/")
		protected.Use(auth.AuthMiddleware())
		protected.Use(auth.AuditMiddleware())
		{
			protected.GET("/health", HealthHandler)
			protected.GET("/status/db", DBHealthHandler)
			protected.GET("/me", MeHandler)
			protected.GET("/clusters", ClustersHandler)
			protected.GET("/cluster/workloads", WorkloadsHandler)
			protected.GET("/cluster/metrics", ClusterMetricsHandler)
			protected.GET("/reports", ListReportsHandler)
			protected.GET("/reports/compliance", GenerateComplianceReportHandler)
			protected.POST("/reports/:id/read", MarkReportReadHandler)

			// AI / Remediation
			protected.POST("/ai/analyze", aiHandler.AnalyzeWorkload)
			protected.POST("/remediate/generate", aiHandler.GenerateRemediation)

			// Playbooks (Public Read)
			protected.GET("/playbooks", ListPlaybooksHandler)

			// Admin Routes
			admin := protected.Group("/")
			admin.Use(auth.RequireRole(auth.RoleAdmin))
			{
				admin.POST("/remediate/apply", ApplyRemediationHandler)

				// Playbooks (Admin Write)
				admin.POST("/playbooks", CreatePlaybookHandler)
				admin.PUT("/playbooks/:id", UpdatePlaybookHandler)
				admin.DELETE("/playbooks/:id", DeletePlaybookHandler)
			}
		}
	}
	return r
}
