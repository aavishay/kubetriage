package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuditLogMiddleware creates a middleware that logs significant API actions
func AuditLogMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip GET requests and health checks (read-only operations don't need auditing)
		if c.Request.Method == http.MethodGet {
			c.Next()
			return
		}

		// Skip non-significant endpoints
		path := c.Request.URL.Path
		if shouldSkipAudit(path) {
			c.Next()
			return
		}

		// Capture request body for significant mutations
		var requestBody []byte
		if c.Request.Body != nil {
			requestBody, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		}

		// Process request
		c.Next()

		// Log the action after processing
		go logAuditAction(c, path, requestBody)
	}
}

func shouldSkipAudit(path string) bool {
	skipPaths := []string{
		"/api/health",
		"/api/db-health",
		"/api/ws/",
		"/api/ai/models",
		"/api/metrics",
	}
	for _, skip := range skipPaths {
		if len(path) >= len(skip) && path[:len(skip)] == skip {
			return true
		}
	}
	return false
}

func logAuditAction(c *gin.Context, path string, requestBody []byte) {
	// Determine action type based on path and method
	action, resource := classifyAction(c.Request.Method, path)
	if action == "" {
		return
	}

	// Extract details (limit size)
	details := ""
	if len(requestBody) > 0 && len(requestBody) < 10000 {
		// Try to parse as JSON for cleaner storage
		var jsonData map[string]interface{}
		if err := json.Unmarshal(requestBody, &jsonData); err == nil {
			// Remove sensitive fields
			delete(jsonData, "apiKey")
			delete(jsonData, "api_key")
			delete(jsonData, "password")
			delete(jsonData, "token")
			delete(jsonData, "secret")
			if cleanedJSON, err := json.Marshal(jsonData); err == nil {
				details = string(cleanedJSON)
			}
		} else {
			details = string(requestBody)
		}
	}

	// Extract resource ID from path if present
	resourceID := c.Param("id")

	// Get cluster ID from query or body
	clusterID := c.Query("cluster")
	if clusterID == "" {
		clusterID = c.Query("clusterId")
	}

	// Get namespace from query
	namespace := c.Query("namespace")

	log := db.AuditLog{
		ID:         uuid.New(),
		Action:     action,
		Resource:   resource,
		ResourceID: resourceID,
		ClusterID:  clusterID,
		Namespace:  namespace,
		Details:    details,
		IPAddress:  c.ClientIP(),
		Success:    c.Writer.Status() < 400,
		CreatedAt:  time.Now(),
	}

	if !log.Success {
		// Capture error from context if available
		if ginErr := c.Errors.Last(); ginErr != nil {
			log.ErrorMsg = ginErr.Error()
		} else {
			log.ErrorMsg = http.StatusText(c.Writer.Status())
		}
	}

	// Fire-and-forget: don't block response on audit logging
	db.DB.Create(&log)
}

func classifyAction(method, path string) (action, resource string) {
	// Map HTTP method + path to action/resource pairs
	actionMap := map[string]struct {
		action   string
		resource string
	}{
		"POST /api/reports":           {action: "triage_create", resource: "report"},
		"POST /api/reports/:id/approve": {action: "remediation_approve", resource: "report"},
		"POST /api/reports/:id/reject":  {action: "remediation_reject", resource: "report"},
		"POST /api/remediate/apply":   {action: "remediation_apply", resource: "workload"},
		"POST /api/remediate/generate": {action: "remediation_generate", resource: "workload"},
		"POST /api/runbooks/:id/execute": {action: "runbook_execute", resource: "runbook"},
		"POST /api/runbooks":          {action: "runbook_create", resource: "runbook"},
		"PUT /api/runbooks/:id":       {action: "runbook_update", resource: "runbook"},
		"DELETE /api/runbooks/:id":    {action: "runbook_delete", resource: "runbook"},
		"POST /api/clusters/register": {action: "cluster_register", resource: "cluster"},
		"DELETE /api/clusters/:id":    {action: "cluster_delete", resource: "cluster"},
		"POST /api/comments":          {action: "comment_create", resource: "comment"},
		"DELETE /api/comments/:id":    {action: "comment_delete", resource: "comment"},
		"POST /api/scheduled-fixes/:id/approve": {action: "scheduled_fix_approve", resource: "scheduled_fix"},
		"POST /api/settings/ai":       {action: "settings_update_ai", resource: "settings"},
		"POST /api/settings/notifications": {action: "settings_update_notifications", resource: "settings"},
		"POST /api/metric-sources":    {action: "metric_source_create", resource: "metric_source"},
		"PUT /api/metric-sources/:id": {action: "metric_source_update", resource: "metric_source"},
		"DELETE /api/metric-sources/:id": {action: "metric_source_delete", resource: "metric_source"},
		"POST /api/notifications/channels": {action: "channel_create", resource: "notification_channel"},
		"PUT /api/notifications/channels/:id": {action: "channel_update", resource: "notification_channel"},
		"DELETE /api/notifications/channels/:id": {action: "channel_delete", resource: "notification_channel"},
		"POST /api/notifications/rules": {action: "rule_create", resource: "alert_rule"},
		"PUT /api/notifications/rules/:id": {action: "rule_update", resource: "alert_rule"},
		"DELETE /api/notifications/rules/:id": {action: "rule_delete", resource: "alert_rule"},
	}

	// Try exact match first
	key := method + " " + path
	if mapped, ok := actionMap[key]; ok {
		return mapped.action, mapped.resource
	}

	// Try pattern matching for parameterized paths
	for pattern, mapped := range actionMap {
		if matchPattern(pattern, key) {
			return mapped.action, mapped.resource
		}
	}

	// Generic fallback
	if method == http.MethodPost {
		return "create", "resource"
	}
	if method == http.MethodPut {
		return "update", "resource"
	}
	if method == http.MethodDelete {
		return "delete", "resource"
	}
	return "", ""
}

func matchPattern(pattern, actual string) bool {
	// Simple pattern matching: :id segments match any non-slash segment
	pParts := splitPath(pattern)
	aParts := splitPath(actual)
	if len(pParts) != len(aParts) {
		return false
	}
	for i := range pParts {
		if len(pParts[i]) > 0 && pParts[i][0] == ':' {
			continue // Parameter matches anything
		}
		if pParts[i] != aParts[i] {
			return false
		}
	}
	return true
}

func splitPath(path string) []string {
	var result []string
	start := 0
	for i := 0; i < len(path); i++ {
		if path[i] == '/' {
			if start < i {
				result = append(result, path[start:i])
			}
			start = i + 1
		}
	}
	if start < len(path) {
		result = append(result, path[start:])
	}
	return result
}

// AuditLogsHandler returns paginated audit logs
func AuditLogsHandler(c *gin.Context) {
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := parseInt(l); err == nil && parsed > 0 && parsed <= 500 {
			limit = parsed
		}
	}

	offset := 0
	if o := c.Query("offset"); o != "" {
		if parsed, err := parseInt(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Build query
	query := db.DB.Model(&db.AuditLog{}).Order("created_at DESC")

	if action := c.Query("action"); action != "" {
		query = query.Where("action = ?", action)
	}
	if resource := c.Query("resource"); resource != "" {
		query = query.Where("resource = ?", resource)
	}
	if clusterID := c.Query("clusterId"); clusterID != "" {
		query = query.Where("cluster_id = ?", clusterID)
	}
	if namespace := c.Query("namespace"); namespace != "" {
		query = query.Where("namespace = ?", namespace)
	}

	// Get total count
	var total int64
	query.Count(&total)

	// Get paginated results
	var logs []db.AuditLog
	if err := query.Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audit logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":   logs,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func parseInt(s string) (int, error) {
	var result int
	_, err := fmt.Sscanf(s, "%d", &result)
	return result, err
}
