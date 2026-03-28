package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/ai"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
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
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	// OpenTelemetry Middleware
	r.Use(otelgin.Middleware("kubetriage-backend"))

	// Init Handlers
	aiHandler := NewAIHandler(aiService)

	api := r.Group("/api")
	{
		// Public Routes
		api.GET("/health", HealthHandler)
		api.GET("/status/db", DBHealthHandler)

		// Clusters
		api.GET("/clusters", ClustersHandler)
		api.POST("/clusters/register", RegisterClusterHandler)
		api.DELETE("/clusters/:id", DeleteClusterHandler)
		api.GET("/cluster/workloads", WorkloadsHandler)
		api.GET("/cluster/nodes", NodesHandler)
		api.GET("/cluster/events", ClusterEventsHandler)
		api.GET("/cluster/metrics", ClusterMetricsHandler)

		// Reports
		api.GET("/reports", ListReportsHandler)
		api.DELETE("/reports", DeleteAllReportsHandler)
		api.GET("/reports/compliance", GenerateComplianceReportHandler)
		api.POST("/reports/:id/read", MarkReportReadHandler)
		api.POST("/reports/:id/export", ExportReportHandler)
		api.POST("/reports/:id/approve", ApproveRemediationHandler)
		api.POST("/reports/:id/reject", RejectRemediationHandler)

		// Comments
		api.GET("/comments", ListCommentsHandler)
		api.POST("/comments", CreateCommentHandler)
		api.DELETE("/comments/:id", DeleteCommentHandler)

		// AI / Remediation
		api.GET("/ai/models", aiHandler.GetModels)
		api.POST("/ai/analyze", aiHandler.AnalyzeWorkload)
		api.POST("/ai/topology", aiHandler.GenerateTopology)
		api.POST("/ai/chat", aiHandler.Chat)
		api.POST("/remediate/generate", aiHandler.GenerateRemediation)
		api.POST("/remediate/apply", ApplyRemediationHandler)

		// Playbooks & Recipes
		api.GET("/playbooks", ListPlaybooksHandler)
		api.POST("/playbooks", CreatePlaybookHandler)
		api.PUT("/playbooks/:id", UpdatePlaybookHandler)
		api.DELETE("/playbooks/:id", DeletePlaybookHandler)
		api.GET("/recipes", ListRecipesHandler)
		api.POST("/recipes/:id/toggle", ToggleRecipeHandler)

		// WebSocket Logs
		api.GET("/ws/logs", StreamLogsHandler)
		api.GET("/cluster/logs/search", SearchLogsHandler)
	}
	// Serve Frontend Static Files
	r.StaticFS("/assets", assetsFS)

	// Favicon handlers
	r.GET("/favicon.ico", func(c *gin.Context) { c.FileFromFS("/favicon.ico", rootFS) })
	r.GET("/favicon.png", func(c *gin.Context) { c.FileFromFS("/favicon.png", rootFS) })
	r.GET("/favicon.svg", func(c *gin.Context) { c.FileFromFS("/favicon.svg", rootFS) })

	// Expose Prometheus metrics
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// SPA Handler: any route not handled by API or static files returns index.html
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/api") {
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
