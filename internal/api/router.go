package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/ai"
	"github.com/aavishay/kubetriage/backend/internal/ml"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
)

// RouterConfig holds all dependencies for setting up the router.
type RouterConfig struct {
	AIService *ai.AIService
	MLService *ml.Service
	RootFS    http.FileSystem
	AssetsFS  http.FileSystem
	IndexHTML []byte
}

// ginHandler wraps an http.Handler to work with gin
func ginHandler(h http.Handler) gin.HandlerFunc {
	return func(c *gin.Context) { h.ServeHTTP(c.Writer, c.Request) }
}

// ginHandlerFunc wraps an http.HandlerFunc to work with gin
func ginHandlerFunc(h func(http.ResponseWriter, *http.Request)) gin.HandlerFunc {
	return func(c *gin.Context) { h(c.Writer, c.Request) }
}

// GinHandler is the interface for handlers that use gin.Context
type GinHandler interface {
	ServeHTTP(*gin.Context)
}

// wrapGinHandler wraps a GinHandler for use in gin router
func wrapGinHandler(h GinHandler) gin.HandlerFunc {
	return h.ServeHTTP
}

func SetupRouter(cfg RouterConfig) *gin.Engine {
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

	// Audit Log Middleware
	r.Use(AuditLogMiddleware())

	// Init Handlers
	aiHandler := NewAIHandler(cfg.AIService)
	mlHandler := NewMLHandler(cfg.MLService)

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
		api.GET("/cluster/scaling-efficiency", ScalingEfficiencyHandler)
		api.GET("/cluster/node-claims", NodeClaimsHandler)
		api.GET("/clusters/aggregate", MultiClusterHandler)
		api.GET("/clusters/:id/health", ClusterHealthCheckHandler)

		// GitOps
		api.GET("/gitops/status", GitOpsStatusHandler)
		api.GET("/gitops/applications", GitOpsApplicationsHandler)
		api.GET("/gitops/flux", GitOpsFluxHandler)

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

		// ML Intelligence
		api.GET("/ml/intelligence", mlHandler.GetMLIntelligence)
		api.GET("/ml/anomalies", mlHandler.GetAnomalies)
		api.GET("/ml/patterns", mlHandler.GetPatterns)
		api.GET("/ml/stats", mlHandler.GetMLStats)
		api.GET("/ml/forecast", mlHandler.GetForecast)
		api.POST("/ml/metrics", mlHandler.IngestMetrics)
		api.GET("/ml/predict/:id", mlHandler.PredictRootCause)

		// Developer Experience
		api.GET("/developer/portal", DeveloperPortalHandler)
		api.GET("/developer/teams", TeamListHandler)
		api.GET("/developer/costs", CostAttributionHandler)
		api.POST("/developer/pre-deploy", PreDeployCheckHandler)
		api.POST("/developer/resolve/:id", ResolveIncidentHandler)

		// Autonomous Remediation - Auto-Fix with Approval
		api.GET("/autofix/proposals", wrapGinHandler(&ListAutoFixProposalsHandler{}))
		api.GET("/autofix/proposals/:id", wrapGinHandler(&GetAutoFixProposalHandler{}))
		api.POST("/autofix/proposals", wrapGinHandler(&CreateAutoFixProposalHandler{}))
		api.POST("/autofix/proposals/:id/approve", wrapGinHandler(&ApproveAutoFixHandler{}))
		api.POST("/autofix/proposals/:id/apply", wrapGinHandler(&ApplyAutoFixHandler{}))
		api.POST("/autofix/proposals/:id/rollback", wrapGinHandler(&RollbackAutoFixHandler{}))

		// Runbook Automation
		api.GET("/runbooks", ListRunbooksHandler)
		api.GET("/runbooks/:id", GetRunbookHandler)
		api.POST("/runbooks", CreateRunbookHandler)
		api.PUT("/runbooks/:id", UpdateRunbookHandler)
		api.DELETE("/runbooks/:id", DeleteRunbookHandler)
		api.POST("/runbooks/:id/execute", ExecuteRunbookHandler)
		api.POST("/runbooks/executions/:id/steps/:stepId/approve", ApproveRunbookStepHandler)
		api.GET("/runbooks/executions/:id", GetRunbookExecutionHandler)
		api.POST("/reports/:id/runbook", ConvertTriageToRunbookHandler)

		// Scheduled Remediation
		api.GET("/scheduled-fixes", ListScheduledFixesHandler)
		api.POST("/scheduled-fixes", wrapGinHandler(&CreateScheduledFixHandler{}))
		api.POST("/scheduled-fixes/:id/approve", wrapGinHandler(&ApproveScheduledFixHandler{}))
		api.POST("/scheduled-fixes/:id/cancel", wrapGinHandler(&CancelScheduledFixHandler{}))

		// External Metrics API
		api.GET("/metrics/sources", ListMetricSourcesHandler)
		api.GET("/metrics/sources/:id", GetMetricSourceHandler)
		api.POST("/metrics/sources", CreateMetricSourceHandler)
		api.PUT("/metrics/sources/:id", UpdateMetricSourceHandler)
		api.DELETE("/metrics/sources/:id", DeleteMetricSourceHandler)
		api.POST("/metrics/sources/:id/test", TestMetricSourceHandler)
		api.POST("/metrics/sources/:id/sync", SyncMetricsHandler)
		api.GET("/metrics/providers", GetMetricProvidersHandler)
		api.POST("/metrics/ingest", IngestMetricsHandler)
		api.GET("/metrics/query", QueryMetricsHandler)
		api.GET("/metrics/stats", GetMetricsStatsHandler)

		// Audit Logs
		api.GET("/audit-logs", AuditLogsHandler)
	}
	// Serve Frontend Static Files
	r.StaticFS("/assets", cfg.AssetsFS)

	// Favicon handlers
	r.GET("/favicon.ico", func(c *gin.Context) { c.FileFromFS("/favicon.ico", cfg.RootFS) })
	r.GET("/favicon.png", func(c *gin.Context) { c.FileFromFS("/favicon.png", cfg.RootFS) })
	r.GET("/favicon.svg", func(c *gin.Context) { c.FileFromFS("/favicon.svg", cfg.RootFS) })

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

		if len(cfg.IndexHTML) > 0 {
			c.Data(200, "text/html; charset=utf-8", cfg.IndexHTML)
		} else {
			// Fallback if bytes missing (shouldn't happen in prod)
			c.FileFromFS("index.html", cfg.RootFS)
		}
	})

	return r
}
