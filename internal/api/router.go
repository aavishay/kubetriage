package api

import (
	"net/http"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/ai"
	"github.com/aavishay/kubetriage/backend/internal/auth"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
)

func SetupRouter(aiService *ai.AIService, rootFS http.FileSystem, assetsFS http.FileSystem, indexHTML []byte) *gin.Engine {
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
	// Init Handlers
	aiHandler := NewAIHandler(aiService)

	api := r.Group("/api")
	{
		// Public Routes
		api.GET("/health", HealthHandler)
		api.GET("/status/db", DBHealthHandler)
		api.GET("/auth/login", func(c *gin.Context) { auth.LoginHandler(c) })
		api.POST("/auth/logout", func(c *gin.Context) { auth.LogoutHandler(c) })
		api.GET("/auth/logout", func(c *gin.Context) { auth.LogoutHandler(c) }) // Support GET for easier testing/links
		api.GET("/auth/google/callback", func(c *gin.Context) { auth.CallbackHandler(c) })

		// Protected Routes
		protected := api.Group("/")
		protected.Use(auth.AuthMiddleware())
		protected.Use(auth.AuditMiddleware())
		{
			protected.GET("/me", MeHandler)
			protected.GET("/clusters", ClustersHandler)
			protected.POST("/clusters/register", RegisterClusterHandler)
			protected.DELETE("/clusters/:id", DeleteClusterHandler)
			protected.GET("/cluster/workloads", WorkloadsHandler)
			protected.GET("/cluster/metrics", ClusterMetricsHandler)
			protected.GET("/reports", ListReportsHandler)
			protected.DELETE("/reports", auth.RequireRole(auth.RoleAdmin), DeleteAllReportsHandler)
			protected.GET("/reports/compliance", GenerateComplianceReportHandler)
			protected.POST("/reports/:id/read", MarkReportReadHandler)

			// AI / Remediation
			protected.GET("/ai/models", aiHandler.GetModels)
			protected.POST("/ai/analyze", aiHandler.AnalyzeWorkload)
			protected.POST("/ai/topology", aiHandler.GenerateTopology)
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
	// Serve Frontend Static Files
	// Use the embedded filesystem
	r.StaticFS("/assets", assetsFS) // This will serve from dist/assets -> dist/assets (mapped correctly)

	// Because StaticFS servers /assets/*, we can't easily map /favicon.ico directly unless we check for it in NoRoute or have it in root of FS.
	// Since we subbed "dist", if favicon.ico is in dist/favicon.ico, we can serve it manually.
	r.GET("/favicon.ico", func(c *gin.Context) {
		c.FileFromFS("favicon.ico", rootFS)
	})
	r.GET("/favicon.png", func(c *gin.Context) {
		c.FileFromFS("favicon.png", rootFS)
	})
	r.GET("/favicon.svg", func(c *gin.Context) {
		c.FileFromFS("favicon.svg", rootFS)
	})

	// SPA Handler: any route not handled by API or static files returns index.html
	r.NoRoute(func(c *gin.Context) {
		// Avoid intercepting API 404s
		path := c.Request.URL.Path
		if len(path) >= 4 && path[0:4] == "/api" {
			c.JSON(404, gin.H{"code": 404, "message": "API endpoint not found"})
			return
		}

		// Serve index.html from embedded FS
		c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")

		if len(indexHTML) > 0 {
			c.Data(200, "text/html; charset=utf-8", indexHTML)
		} else {
			// Fallback if bytes missing (shouldn't happen in prod)
			c.FileFromFS("index.html", rootFS)
		}
	})

	return r
}
