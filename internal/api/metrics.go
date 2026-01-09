package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/cache"
	"github.com/aavishay/kubetriage/backend/internal/prometheus"
	"github.com/gin-gonic/gin"
)

func ClusterMetricsHandler(c *gin.Context) {
	if prometheus.GlobalClient == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Prometheus client not initialized"})
		return
	}

	workload := c.Query("workload")
	namespace := c.Query("namespace")
	metric := c.Query("metric")
	durationStr := c.Query("duration")

	if workload == "" || namespace == "" || metric == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workload, namespace, and metric params are required"})
		return
	}

	var query string
	switch metric {
	case "cpu":
		// Rate of CPU usage over 5m window, summed across all pods of the workload
		// Heuristic: matching pod name prefix. Ideally we'd match bye owner reference but that's complex in PromQL alone without strict labeling.
		query = fmt.Sprintf("sum(rate(container_cpu_usage_seconds_total{namespace=\"%s\", pod=~\"%s-.*\", container!=\"POD\"}[5m]))", namespace, workload)
	case "memory":
		query = fmt.Sprintf("sum(container_memory_working_set_bytes{namespace=\"%s\", pod=~\"%s-.*\", container!=\"POD\"})", namespace, workload)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid metric type. Supported: cpu, memory"})
		return
	}

	duration := 1 * time.Hour
	if durationStr != "" {
		parsed, err := time.ParseDuration(durationStr)
		if err == nil {
			duration = parsed
		}
	}

	end := time.Now()
	start := end.Add(-duration)
	// Auto-calculate step to aim for ~60 points
	step := duration / 60
	if step < 10*time.Second {
		step = 10 * time.Second
	}

	// Step 1: Check Cache
	cacheKey := fmt.Sprintf("metrics:%s:%s:%s:%s", namespace, workload, metric, durationStr)
	if cached, err := cache.Get(c.Request.Context(), cacheKey); err == nil {
		var points []prometheus.MetricPoint
		if err := json.Unmarshal([]byte(cached), &points); err == nil {
			c.JSON(http.StatusOK, points)
			return
		}
	}

	result, err := prometheus.GlobalClient.QueryRange(c.Request.Context(), query, start, end, step)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Step 2: Store in Cache (1 minute TTL for metrics)
	if jsonData, err := json.Marshal(result); err == nil {
		cache.Set(c.Request.Context(), cacheKey, jsonData, 1*time.Minute)
	}

	c.JSON(http.StatusOK, result)
}
