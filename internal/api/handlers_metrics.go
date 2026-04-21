package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ExternalMetricSource represents an external metrics provider configuration
type ExternalMetricSource struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	ClusterID   string            `json:"clusterId,omitempty"`  // associated cluster (optional)
	Provider    string            `json:"provider"` // datadog, newrelic, cloudwatch, custom, victoriametrics
	APIKey      string            `json:"apiKey,omitempty"`
	APISecret   string            `json:"apiSecret,omitempty"`
	Region      string            `json:"region,omitempty"`     // for cloudwatch
	Endpoint    string            `json:"endpoint,omitempty"`   // custom endpoint
	Namespace   string            `json:"namespace,omitempty"`  // default namespace
	Enabled     bool              `json:"enabled"`
	CreatedAt   time.Time         `json:"createdAt"`
	UpdatedAt   time.Time         `json:"updatedAt"`
	LastSyncAt  *time.Time        `json:"lastSyncAt,omitempty"`
	SyncStatus  string            `json:"syncStatus"` // idle, syncing, error
	ErrorMessage string           `json:"errorMessage,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
}

// ExternalMetric represents a single metric data point from external source
type ExternalMetric struct {
	ID          string                 `json:"id"`
	SourceID    string                 `json:"sourceId"`
	Name        string                 `json:"name"`
	Value       float64                `json:"value"`
	Timestamp   time.Time              `json:"timestamp"`
	Labels      map[string]string      `json:"labels"` // tags/dimensions
	Unit        string                 `json:"unit,omitempty"`
	MetricType  string                 `json:"metricType"` // gauge, counter, histogram
	ClusterID   string                 `json:"clusterId,omitempty"`
	Namespace   string                 `json:"namespace,omitempty"`
	Workload    string                 `json:"workload,omitempty"`
	Container   string                 `json:"container,omitempty"`
	Node        string                 `json:"node,omitempty"`
}

// MetricQuery represents a query for external metrics
type MetricQuery struct {
	SourceID   string    `json:"sourceId,omitempty"`
	Name       string    `json:"name,omitempty"`
	Labels     map[string]string `json:"labels,omitempty"`
	StartTime  time.Time `json:"startTime"`
	EndTime    time.Time `json:"endTime"`
	Aggregation string   `json:"aggregation,omitempty"` // avg, sum, min, max, count
	Interval   string    `json:"interval,omitempty"`    // 1m, 5m, 1h
}

// MetricTimeSeries represents a time series of metric values
type MetricTimeSeries struct {
	Name   string                 `json:"name"`
	Labels map[string]string      `json:"labels"`
	Unit   string                 `json:"unit,omitempty"`
	Values []MetricDataPoint      `json:"values"`
}

// MetricDataPoint represents a single point in a time series
type MetricDataPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
}

// In-memory stores
var (
	metricSources = make(map[string]*ExternalMetricSource)
	metricsStore  = make(map[string][]ExternalMetric) // keyed by source_id:name
)

// ListMetricSourcesHandler returns all external metric sources
// Supports filtering by cluster_id query parameter
func ListMetricSourcesHandler(c *gin.Context) {
	clusterID := c.Query("cluster_id")

	var sources []ExternalMetricSource
	for _, s := range metricSources {
		// If cluster_id specified, filter by it
		if clusterID != "" && s.ClusterID != clusterID {
			continue
		}
		sources = append(sources, *s)
	}

	c.JSON(http.StatusOK, gin.H{
		"sources": sources,
		"count":   len(sources),
	})
}

// GetMetricSourceHandler returns a specific metric source
func GetMetricSourceHandler(c *gin.Context) {
	id := c.Param("id")
	source, exists := metricSources[id]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Metric source not found"})
		return
	}

	// Don't return sensitive credentials
	response := *source
	response.APIKey = ""
	response.APISecret = ""

	c.JSON(http.StatusOK, response)
}

// CreateMetricSourceHandler creates a new external metric source
func CreateMetricSourceHandler(c *gin.Context) {
	var request struct {
		Name      string            `json:"name"`
		ClusterID string            `json:"clusterId,omitempty"`
		Provider  string            `json:"provider"`
		APIKey    string            `json:"apiKey"`
		APISecret string            `json:"apiSecret"`
		Region    string            `json:"region,omitempty"`
		Endpoint  string            `json:"endpoint,omitempty"`
		Namespace string            `json:"namespace,omitempty"`
		Labels    map[string]string `json:"labels,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	source := ExternalMetricSource{
		ID:         uuid.New().String(),
		Name:       request.Name,
		ClusterID:  request.ClusterID,
		Provider:   request.Provider,
		APIKey:     request.APIKey,
		APISecret:  request.APISecret,
		Region:     request.Region,
		Endpoint:   request.Endpoint,
		Namespace:  request.Namespace,
		Enabled:    true,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
		SyncStatus: "idle",
		Labels:     request.Labels,
	}

	metricSources[source.ID] = &source

	// Test connection
	go testMetricSourceConnection(&source)

	// Don't return credentials
	response := source
	response.APIKey = ""
	response.APISecret = ""

	c.JSON(http.StatusCreated, response)
}

// UpdateMetricSourceHandler updates a metric source
func UpdateMetricSourceHandler(c *gin.Context) {
	id := c.Param("id")
	source, exists := metricSources[id]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Metric source not found"})
		return
	}

	var request struct {
		Name     string            `json:"name"`
		APIKey   string            `json:"apiKey,omitempty"`
		APISecret string           `json:"apiSecret,omitempty"`
		Region   string            `json:"region,omitempty"`
		Endpoint string            `json:"endpoint,omitempty"`
		Enabled  *bool             `json:"enabled,omitempty"`
		Labels   map[string]string `json:"labels,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	source.Name = request.Name
	if request.APIKey != "" {
		source.APIKey = request.APIKey
	}
	if request.APISecret != "" {
		source.APISecret = request.APISecret
	}
	source.Region = request.Region
	source.Endpoint = request.Endpoint
	if request.Enabled != nil {
		source.Enabled = *request.Enabled
	}
	source.Labels = request.Labels
	source.UpdatedAt = time.Now()

	c.JSON(http.StatusOK, source)
}

// DeleteMetricSourceHandler deletes a metric source
func DeleteMetricSourceHandler(c *gin.Context) {
	id := c.Param("id")
	_, exists := metricSources[id]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Metric source not found"})
		return
	}

	delete(metricSources, id)
	c.JSON(http.StatusOK, gin.H{"message": "Metric source deleted"})
}

// TestMetricSourceHandler tests a metric source connection
func TestMetricSourceHandler(c *gin.Context) {
	id := c.Param("id")
	source, exists := metricSources[id]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Metric source not found"})
		return
	}

	go testMetricSourceConnection(source)

	c.JSON(http.StatusOK, gin.H{
		"message": "Connection test initiated",
		"status":  source.SyncStatus,
	})
}

// IngestMetricsHandler ingests metrics from external sources
func IngestMetricsHandler(c *gin.Context) {
	var request struct {
		SourceID string           `json:"sourceId"`
		Metrics  []ExternalMetric `json:"metrics"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	source, exists := metricSources[request.SourceID]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Metric source not found"})
		return
	}

	if !source.Enabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Metric source is disabled"})
		return
	}

	now := time.Now()
	source.LastSyncAt = &now
	source.SyncStatus = "syncing"

	// Store metrics
	for _, metric := range request.Metrics {
		metric.ID = uuid.New().String()
		metric.SourceID = request.SourceID
		if metric.Timestamp.IsZero() {
			metric.Timestamp = now
		}

		key := fmt.Sprintf("%s:%s", request.SourceID, metric.Name)
		metricsStore[key] = append(metricsStore[key], metric)

		// Keep only last 10000 points per metric to prevent memory issues
		if len(metricsStore[key]) > 10000 {
			metricsStore[key] = metricsStore[key][len(metricsStore[key])-10000:]
		}
	}

	source.SyncStatus = "idle"

	c.JSON(http.StatusCreated, gin.H{
		"message":  fmt.Sprintf("Ingested %d metrics", len(request.Metrics)),
		"count":    len(request.Metrics),
		"sourceId": request.SourceID,
	})
}

// QueryMetricsHandler queries external metrics
func QueryMetricsHandler(c *gin.Context) {
	var query MetricQuery

	// Parse query parameters
	query.SourceID = c.Query("sourceId")
	query.Name = c.Query("name")
	query.Aggregation = c.DefaultQuery("aggregation", "avg")
	query.Interval = c.DefaultQuery("interval", "1m")

	// Parse time range
	startTimeStr := c.Query("startTime")
	endTimeStr := c.Query("endTime")

	if startTimeStr != "" {
		if t, err := time.Parse(time.RFC3339, startTimeStr); err == nil {
			query.StartTime = t
		}
	} else {
		query.StartTime = time.Now().Add(-1 * time.Hour)
	}

	if endTimeStr != "" {
		if t, err := time.Parse(time.RFC3339, endTimeStr); err == nil {
			query.EndTime = t
		}
	} else {
		query.EndTime = time.Now()
	}

	// Parse labels
	labelsJSON := c.Query("labels")
	if labelsJSON != "" {
		json.Unmarshal([]byte(labelsJSON), &query.Labels)
	}

	// Query metrics
	var results []MetricTimeSeries

	for _, metrics := range metricsStore {
		var filtered []ExternalMetric

		for _, m := range metrics {
			// Filter by time range
			if m.Timestamp.Before(query.StartTime) || m.Timestamp.After(query.EndTime) {
				continue
			}

			// Filter by source
			if query.SourceID != "" && m.SourceID != query.SourceID {
				continue
			}

			// Filter by name
			if query.Name != "" && m.Name != query.Name {
				continue
			}

			// Filter by labels
			if matchesLabels(m.Labels, query.Labels) {
				filtered = append(filtered, m)
			}
		}

		if len(filtered) > 0 {
			ts := buildTimeSeries(filtered, query.Aggregation, query.Interval)
			if len(ts.Values) > 0 {
				results = append(results, ts)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"series":    results,
		"count":     len(results),
		"startTime": query.StartTime,
		"endTime":   query.EndTime,
	})
}

// GetMetricProvidersHandler returns supported metric providers
func GetMetricProvidersHandler(c *gin.Context) {
	providers := []gin.H{
		{
			"id":          "datadog",
			"name":        "Datadog",
			"description": "Ingest metrics from Datadog monitoring platform",
			"authType":    "api_key",
			"requiredFields": []string{"apiKey", "apiSecret"},
			"optionalFields": []string{"endpoint"},
		},
		{
			"id":          "newrelic",
			"name":        "New Relic",
			"description": "Ingest metrics from New Relic observability platform",
			"authType":    "api_key",
			"requiredFields": []string{"apiKey"},
			"optionalFields": []string{"endpoint"},
		},
		{
			"id":          "cloudwatch",
			"name":        "AWS CloudWatch",
			"description": "Ingest metrics from AWS CloudWatch",
			"authType":    "aws_credentials",
			"requiredFields": []string{"apiKey", "apiSecret", "region"},
			"optionalFields": []string{"namespace"},
		},
		{
			"id":          "prometheus",
			"name":        "Prometheus",
			"description": "Connect to Prometheus server for metrics querying via PromQL",
			"authType":    "none_or_basic",
			"requiredFields": []string{"endpoint"},
			"optionalFields": []string{"apiKey"},
			"features": []string{"promql_compatible", "native_prometheus"},
		},
		{
			"id":          "victoriametrics",
			"name":        "VictoriaMetrics",
			"description": "Connect to VictoriaMetrics time-series database for high-performance metrics querying",
			"authType":    "none_or_basic",
			"requiredFields": []string{"endpoint"},
			"optionalFields": []string{"apiKey"},
			"features": []string{"promql_compatible", "high_compression", "fast_queries"},
		},
		{
			"id":          "custom",
			"name":        "Custom Endpoint",
			"description": "Ingest metrics from any Prometheus-compatible endpoint",
			"authType":    "none_or_basic",
			"requiredFields": []string{"endpoint"},
			"optionalFields": []string{"apiKey"},
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"providers": providers,
	})
}

// SyncMetricsHandler triggers a sync for a metric source
func SyncMetricsHandler(c *gin.Context) {
	id := c.Param("id")
	source, exists := metricSources[id]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Metric source not found"})
		return
	}

	if !source.Enabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Metric source is disabled"})
		return
	}

	go syncMetricsFromSource(source)

	c.JSON(http.StatusOK, gin.H{
		"message": "Sync started",
		"source":  source.Name,
	})
}

// Helper functions

func testMetricSourceConnection(source *ExternalMetricSource) {
	source.SyncStatus = "syncing"

	// Simulate connection test based on provider
	switch source.Provider {
	case "datadog":
		// In real implementation, would make API call to Datadog
		time.Sleep(500 * time.Millisecond)
	case "newrelic":
		time.Sleep(500 * time.Millisecond)
	case "cloudwatch":
		time.Sleep(500 * time.Millisecond)
	case "prometheus":
		// Test connection to Prometheus
		if _, err := testPrometheusConnection(source.Endpoint, source.APIKey); err != nil {
			source.SyncStatus = "error"
			source.ErrorMessage = err.Error()
			return
		}
		time.Sleep(300 * time.Millisecond)
	case "victoriametrics":
		// Test connection to VictoriaMetrics
		if _, err := testVictoriaMetricsConnection(source.Endpoint, source.APIKey); err != nil {
			source.SyncStatus = "error"
			source.ErrorMessage = err.Error()
			return
		}
		time.Sleep(300 * time.Millisecond)
	case "custom":
		time.Sleep(300 * time.Millisecond)
	}

	source.SyncStatus = "idle"
}

// testPrometheusConnection attempts to connect to a Prometheus instance
func testPrometheusConnection(endpoint, apiKey string) (bool, error) {
	if endpoint == "" {
		return false, fmt.Errorf("endpoint is required")
	}

	// Validate the endpoint format
	if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		return false, fmt.Errorf("endpoint must start with http:// or https://")
	}

	// In a real implementation, this would:
	// 1. Create a Prometheus client
	// 2. Execute a simple health check query (e.g., "up")
	// 3. Return success/failure
	return true, nil
}

// testVictoriaMetricsConnection attempts to connect to a VictoriaMetrics instance
func testVictoriaMetricsConnection(endpoint, apiKey string) (bool, error) {
	if endpoint == "" {
		return false, fmt.Errorf("endpoint is required")
	}

	// In a real implementation, this would:
	// 1. Create a VM client
	// 2. Execute a simple health check query (e.g., "up")
	// 3. Return success/failure
	// For now, we just validate the endpoint format
	if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		return false, fmt.Errorf("endpoint must start with http:// or https://")
	}

	return true, nil
}

func syncMetricsFromSource(source *ExternalMetricSource) {
	source.SyncStatus = "syncing"

	// In real implementation, would:
	// 1. Connect to external API
	// 2. Query metrics
	// 3. Transform to internal format
	// 4. Store in metricsStore

	switch source.Provider {
	case "prometheus":
		// Sync metrics from Prometheus
		if err := syncPrometheus(source); err != nil {
			source.SyncStatus = "error"
			source.ErrorMessage = err.Error()
			return
		}
	case "victoriametrics":
		// Sync metrics from VictoriaMetrics
		if err := syncVictoriaMetrics(source); err != nil {
			source.SyncStatus = "error"
			source.ErrorMessage = err.Error()
			return
		}
	default:
		// Simulate fetching metrics for other providers
		time.Sleep(2 * time.Second)
	}

	now := time.Now()
	source.LastSyncAt = &now
	source.SyncStatus = "idle"
}

// syncPrometheus syncs metrics from a Prometheus instance
func syncPrometheus(source *ExternalMetricSource) error {
	// In real implementation, would:
	// 1. Create Prometheus client from source.Endpoint, source.APIKey
	// 2. Query available metrics using PromQL (e.g., up, node_exporter metrics)
	// 3. Store in metricsStore keyed by source.ID

	// For now, simulate some sample Prometheus metrics
	time.Sleep(1 * time.Second)

	now := time.Now()
	sampleMetrics := []ExternalMetric{
		{
			ID:         fmt.Sprintf("prom-%d", time.Now().Unix()),
			SourceID:   source.ID,
			Name:       "up",
			Value:      1,
			Timestamp:  now,
			Unit:       "",
			MetricType: "gauge",
			Labels:     map[string]string{"job": "kubernetes-nodes", "instance": "node-001"},
		},
		{
			ID:         fmt.Sprintf("prom-%d", time.Now().Unix()+1),
			SourceID:   source.ID,
			Name:       "node_cpu_seconds_total",
			Value:      12345.67,
			Timestamp:  now,
			Unit:       "seconds",
			MetricType: "counter",
			Labels:     map[string]string{"cpu": "0", "mode": "user", "instance": "node-001"},
		},
		{
			ID:         fmt.Sprintf("prom-%d", time.Now().Unix()+2),
			SourceID:   source.ID,
			Name:       "container_memory_usage_bytes",
			Value:      536870912,
			Timestamp:  now,
			Unit:       "bytes",
			MetricType: "gauge",
			Labels:     map[string]string{"container": "app", "pod": "web-001", "namespace": "default"},
		},
	}

	// Store metrics
	for _, metric := range sampleMetrics {
		key := fmt.Sprintf("source-%s:%s", source.ID, metric.Name)
		metricsStore[key] = append(metricsStore[key], metric)
	}

	return nil
}

// syncVictoriaMetrics syncs metrics from a VictoriaMetrics instance
func syncVictoriaMetrics(source *ExternalMetricSource) error {
	// In real implementation, would:
	// 1. Create VM client from source.Endpoint, source.APIKey
	// 2. Query available metrics (e.g., node_exporter, kubelet metrics)
	// 3. Store in metricsStore keyed by source.ID

	// For now, simulate some sample metrics
	time.Sleep(1 * time.Second)

	// Simulate adding some sample VM metrics to the store
	now := time.Now()
	sampleMetrics := []ExternalMetric{
		{
			ID:         fmt.Sprintf("vm-%d", time.Now().Unix()),
			SourceID:   source.ID,
			Name:       "cpu_usage",
			Value:      45.5,
			Timestamp:  now,
			Unit:       "percent",
			MetricType: "gauge",
			Labels:     map[string]string{"cluster": "prod", "instance": "vm-001"},
		},
		{
			ID:         fmt.Sprintf("vm-%d", time.Now().Unix()+1),
			SourceID:   source.ID,
			Name:       "memory_usage",
			Value:      72.3,
			Timestamp:  now,
			Unit:       "percent",
			MetricType: "gauge",
			Labels:     map[string]string{"cluster": "prod", "instance": "vm-001"},
		},
	}

	// Store metrics
	for _, metric := range sampleMetrics {
		key := fmt.Sprintf("source-%s:%s", source.ID, metric.Name)
		metricsStore[key] = append(metricsStore[key], metric)
	}

	return nil
}

func matchesLabels(metricLabels, queryLabels map[string]string) bool {
	if len(queryLabels) == 0 {
		return true
	}

	for k, v := range queryLabels {
		if metricLabels[k] != v {
			return false
		}
	}
	return true
}

func buildTimeSeries(metrics []ExternalMetric, aggregation, interval string) MetricTimeSeries {
	if len(metrics) == 0 {
		return MetricTimeSeries{}
	}

	// Group by time buckets based on interval
	intervalDuration := parseInterval(interval)
	buckets := make(map[int64][]float64)

	for _, m := range metrics {
		bucket := m.Timestamp.Unix() / int64(intervalDuration.Seconds())
		buckets[bucket] = append(buckets[bucket], m.Value)
	}

	// Build data points
	var dataPoints []MetricDataPoint
	for bucket, values := range buckets {
		ts := time.Unix(bucket*int64(intervalDuration.Seconds()), 0)
		value := aggregate(values, aggregation)
		dataPoints = append(dataPoints, MetricDataPoint{
			Timestamp: ts,
			Value:     value,
		})
	}

	// Sort by timestamp
	sort.Slice(dataPoints, func(i, j int) bool {
		return dataPoints[i].Timestamp.Before(dataPoints[j].Timestamp)
	})

	return MetricTimeSeries{
		Name:   metrics[0].Name,
		Labels: metrics[0].Labels,
		Unit:   metrics[0].Unit,
		Values: dataPoints,
	}
}

func parseInterval(interval string) time.Duration {
	switch interval {
	case "1m":
		return time.Minute
	case "5m":
		return 5 * time.Minute
	case "10m":
		return 10 * time.Minute
	case "1h":
		return time.Hour
	default:
		return time.Minute
	}
}

func aggregate(values []float64, aggregation string) float64 {
	if len(values) == 0 {
		return 0
	}

	switch aggregation {
	case "sum":
		sum := 0.0
		for _, v := range values {
			sum += v
		}
		return sum
	case "min":
		min := values[0]
		for _, v := range values[1:] {
			if v < min {
				min = v
			}
		}
		return min
	case "max":
		max := values[0]
		for _, v := range values[1:] {
			if v > max {
				max = v
			}
		}
		return max
	case "count":
		return float64(len(values))
	default: // avg
		sum := 0.0
		for _, v := range values {
			sum += v
		}
		return sum / float64(len(values))
	}
}

// Demo data initialization
func init() {
	// Add some demo metric sources
	datadog := &ExternalMetricSource{
		ID:         "source-datadog-001",
		Name:       "Production Datadog",
		Provider:   "datadog",
		APIKey:     "***",
		APISecret:  "***",
		Enabled:    true,
		CreatedAt:  time.Now().Add(-7 * 24 * time.Hour),
		UpdatedAt:  time.Now().Add(-7 * 24 * time.Hour),
		SyncStatus: "idle",
		Labels:     map[string]string{"env": "production", "team": "platform"},
	}

	cloudwatch := &ExternalMetricSource{
		ID:         "source-cw-001",
		Name:       "AWS CloudWatch",
		Provider:   "cloudwatch",
		APIKey:     "***",
		APISecret:  "***",
		Region:     "us-east-1",
		Namespace:  "AWS/EKS",
		Enabled:    true,
		CreatedAt:  time.Now().Add(-30 * 24 * time.Hour),
		UpdatedAt:  time.Now().Add(-30 * 24 * time.Hour),
		SyncStatus: "idle",
		Labels:     map[string]string{"env": "production", "provider": "aws"},
	}

	metricSources[datadog.ID] = datadog
	metricSources[cloudwatch.ID] = cloudwatch

	// Generate some demo metrics
	now := time.Now()
	for i := 0; i < 100; i++ {
		ts := now.Add(-time.Duration(i) * time.Minute)

		// Datadog metrics
		metricsStore["source-datadog-001:requests_per_second"] = append(
			metricsStore["source-datadog-001:requests_per_second"],
			ExternalMetric{
				ID:         uuid.New().String(),
				SourceID:   datadog.ID,
				Name:       "requests_per_second",
				Value:      100 + float64(i%20),
				Timestamp:  ts,
				Unit:       "req/s",
				MetricType: "gauge",
				Labels:     map[string]string{"service": "api-gateway"},
			},
		)

		// CloudWatch metrics
		metricsStore["source-cw-001:cpu_utilization"] = append(
			metricsStore["source-cw-001:cpu_utilization"],
			ExternalMetric{
				ID:         uuid.New().String(),
				SourceID:   cloudwatch.ID,
				Name:       "cpu_utilization",
				Value:      45 + float64(i%30),
				Timestamp:  ts,
				Unit:       "percent",
				MetricType: "gauge",
				Labels:     map[string]string{"cluster": "prod-eks"},
			},
		)
	}
}

// GetMetricsStatsHandler returns statistics about external metrics
func GetMetricsStatsHandler(c *gin.Context) {
	totalMetrics := 0
	for _, metrics := range metricsStore {
		totalMetrics += len(metrics)
	}

	c.JSON(http.StatusOK, gin.H{
		"totalMetrics":    totalMetrics,
		"uniqueMetrics":   len(metricsStore),
		"sources":         len(metricSources),
		"oldestDataPoint": time.Now().Add(-2 * time.Hour),
		"newestDataPoint": time.Now(),
	})
}
