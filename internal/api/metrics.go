package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/cache"
	"github.com/aavishay/kubetriage/backend/internal/prometheus"
	"github.com/gin-gonic/gin"
)

// promEscape escapes characters that would break a PromQL regex label value.
func promEscape(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `"`, `\"`)
	s = strings.ReplaceAll(s, `|`, `\|`)
	return s
}

func ClusterMetricsHandler(c *gin.Context) {
	if prometheus.GlobalClient == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Prometheus client not initialized"})
		return
	}

	clusterID := c.Query("cluster")
	workload := c.Query("workload")
	namespace := c.Query("namespace")
	metric := c.Query("metric")
	durationStr := c.Query("duration")

	if workload == "" || namespace == "" || metric == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workload, namespace, and metric params are required"})
		return
	}

	podFilter := ""
	if podsParam := c.Query("pods"); podsParam != "" {
		var podNames []string
		if err := json.Unmarshal([]byte(podsParam), &podNames); err == nil && len(podNames) > 0 {
			escaped := make([]string, len(podNames))
			for i, p := range podNames {
				escaped[i] = promEscape(p)
			}
			podFilter = fmt.Sprintf(",pod=~\"%s\"", strings.Join(escaped, "|"))
		}
	}
	if podFilter == "" {
		podFilter = fmt.Sprintf(",pod=~\"%s-.*\"", promEscape(workload))
	}

	var query string
	clusterFilter := ""
	if clusterID != "" {
		clusterFilter = fmt.Sprintf(",cluster=\"%s\"", clusterID)
	}
	switch metric {
	case "cpu":
		// Rate of CPU usage over 5m window, summed across all pods of the workload
		query = fmt.Sprintf("sum(rate(container_cpu_usage_seconds_total{namespace=\"%s\"%s, container!=\"POD\"%s}[5m]))", namespace, podFilter, clusterFilter)
	case "memory":
		query = fmt.Sprintf("sum(container_memory_working_set_bytes{namespace=\"%s\"%s, container!=\"POD\"%s})", namespace, podFilter, clusterFilter)
	case "storage":
		query = fmt.Sprintf("sum(container_fs_usage_bytes{namespace=\"%s\"%s, container!=\"POD\"%s})", namespace, podFilter, clusterFilter)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid metric type. Supported: cpu, memory, storage"})
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
	cacheKey := fmt.Sprintf("metrics:%s:%s:%s:%s:%s:%s", clusterID, namespace, workload, metric, durationStr, c.Query("pods"))
	if cached, err := cache.Get(c.Request.Context(), cacheKey); err == nil {
		var points []prometheus.MetricPoint
		if err := json.Unmarshal([]byte(cached), &points); err == nil {
			c.JSON(http.StatusOK, points)
			return
		}
	}

	result, err := prometheus.GlobalClient.QueryRange(c.Request.Context(), query, start, end, step)
	// QueryRange call was already made above

	if err != nil {
		// Soft fail: If Prometheus is down/unreachable, return empty list instead of 500
		// This allows the UI to render the rest of the page (e.g. 0% CPU)
		fmt.Printf("Warning: Prometheus Query Failed: %v\n", err)
		c.JSON(http.StatusOK, []prometheus.MetricPoint{})
		return
	}

	// Step 2: Store in Cache (1 minute TTL for metrics)
	if jsonData, err := json.Marshal(result); err == nil {
		cache.Set(c.Request.Context(), cacheKey, jsonData, cache.TTLMetrics)
	}

	c.JSON(http.StatusOK, result)
}
