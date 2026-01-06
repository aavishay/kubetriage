package api

import (
	"time"

	"github.com/aavishay/kubetriage/backend/internal/auth"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
)

func SetupRouter() *gin.Engine {
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
	r.Use(auth.AuthMiddleware())

	api := r.Group("/api")
	{
		api.GET("/health", HealthHandler)
		api.GET("/status/db", DBHealthHandler)
		api.GET("/me", MeHandler)
		api.GET("/clusters", ClustersHandler)
		api.GET("/cluster/workloads", WorkloadsHandler)
		api.GET("/cluster/metrics", ClusterMetricsHandler)
		api.GET("/reports", ListReportsHandler)
		api.POST("/reports/:id/read", MarkReportReadHandler)

		// Remediation (AI)
		api.POST("/remediate/generate", GenerateRemediationHandler)

		// Playbooks (Public Read)
		api.GET("/playbooks", ListPlaybooksHandler)

		// Protected Routes (Admin only)
		admin := api.Group("/")
		admin.Use(auth.RequireRole(auth.RoleAdmin))
		{
			admin.POST("/remediate/apply", ApplyRemediationHandler)

			// Playbooks (Admin Write)
			admin.POST("/playbooks", CreatePlaybookHandler)
			admin.PUT("/playbooks/:id", UpdatePlaybookHandler)
			admin.DELETE("/playbooks/:id", DeletePlaybookHandler)
		}

	}
	return r
}
