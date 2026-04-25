package api

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/ml"
	"github.com/gin-gonic/gin"
)

// MLHandler wraps the ML service for HTTP handlers
type MLHandler struct {
	service *ml.Service
}

// NewMLHandler creates a new ML handler
func NewMLHandler(service *ml.Service) *MLHandler {
	return &MLHandler{service: service}
}

// AnomaliesResponse represents the anomalies endpoint response
type AnomaliesResponse struct {
	Timestamp  time.Time      `json:"timestamp"`
	Anomalies  []ml.Anomaly  `json:"anomalies"`
	Count      int            `json:"count"`
}

// PatternsResponse represents the patterns endpoint response
type PatternsResponse struct {
	Timestamp time.Time     `json:"timestamp"`
	Patterns  []ml.Pattern  `json:"patterns"`
	Count     int           `json:"count"`
}

// PredictionResponse represents a root cause prediction
type PredictionResponse struct {
	ReportID     uint                    `json:"reportId"`
	Prediction ml.RootCausePrediction `json:"prediction"`
	Timestamp  time.Time               `json:"timestamp"`
}

// ForecastResponse represents a capacity forecast
type ForecastResponse struct {
	WorkloadKey string           `json:"workloadKey"`
	Forecast    []ml.MetricPoint `json:"forecast"`
	HoursAhead  int              `json:"hoursAhead"`
}

// MLStatsResponse represents ML service statistics
type MLStatsResponse struct {
	Timestamp     time.Time              `json:"timestamp"`
	ModelsTrained int                    `json:"modelsTrained"`
	PatternsFound int                    `json:"patternsFound"`
	AnomaliesActive int                  `json:"anomaliesActive"`
	IsTraining    bool                   `json:"isTraining"`
	Insights      []MLInsight            `json:"insights"`
}

type MLInsight struct {
	Type        string `json:"type"` // "anomaly", "pattern", "forecast"
	Title       string `json:"title"`
	Description string `json:"description"`
	Severity    string `json:"severity,omitempty"`
	Confidence  float64 `json:"confidence"`
}

// GetAnomaliesHandler returns detected anomalies
func (h *MLHandler) GetAnomalies(c *gin.Context) {
	since := c.DefaultQuery("since", "1h")
	duration, err := time.ParseDuration(since)
	if err != nil {
		duration = 1 * time.Hour
	}

	anomalies := h.service.GetAnomalies(time.Now().Add(-duration))

	c.JSON(http.StatusOK, AnomaliesResponse{
		Timestamp: time.Now(),
		Anomalies: anomalies,
		Count:     len(anomalies),
	})
}

// GetPatternsHandler returns discovered patterns
func (h *MLHandler) GetPatterns(c *gin.Context) {
	patterns := h.service.GetPatterns()

	c.JSON(http.StatusOK, PatternsResponse{
		Timestamp: time.Now(),
		Patterns:  patterns,
		Count:     len(patterns),
	})
}

// PredictRootCauseHandler generates root cause prediction for an incident
func (h *MLHandler) PredictRootCause(c *gin.Context) {
	reportIDStr := c.Param("id")
	reportID, err := strconv.ParseUint(reportIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid report ID"})
		return
	}

	var report db.TriageReport
	if err := db.DB.First(&report, reportID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "report not found"})
		return
	}

	prediction := h.service.PredictRootCause(report)

	c.JSON(http.StatusOK, PredictionResponse{
		ReportID:     uint(reportID),
		Prediction:   prediction,
		Timestamp:    time.Now(),
	})
}

// GetForecastHandler returns capacity forecast
func (h *MLHandler) GetForecast(c *gin.Context) {
	workloadKey := c.Query("workload")
	if workloadKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "workload key required"})
		return
	}

	hoursStr := c.DefaultQuery("hours", "24")
	hours, err := strconv.Atoi(hoursStr)
	if err != nil {
		hours = 24
	}

	forecast, err := h.service.GetForecast(workloadKey, hours)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ForecastResponse{
		WorkloadKey: workloadKey,
		Forecast:    forecast,
		HoursAhead:  hours,
	})
}

// GetMLStatsHandler returns ML service statistics and insights
func (h *MLHandler) GetMLStats(c *gin.Context) {
	stats := h.service.GetModelStats()
	anomalies := h.service.GetAnomalies(time.Now().Add(-24 * time.Hour))
	patterns := h.service.GetPatterns()

	// Generate insights
	var insights []MLInsight

	// Add anomaly insights
	for _, a := range anomalies {
		if a.Confidence > 0.8 {
			insights = append(insights, MLInsight{
				Type:        "anomaly",
				Title:       fmt.Sprintf("%s Anomaly Detected", a.Metric),
				Description: a.Description,
				Severity:    a.Severity,
				Confidence:  a.Confidence,
			})
		}
	}

	// Add pattern insights
	for _, p := range patterns {
		if p.Confidence > 0.7 {
			insights = append(insights, MLInsight{
				Type:        "pattern",
				Title:       p.Name,
				Description: fmt.Sprintf("%s - Occurred %d times", p.Description, p.Frequency),
				Severity:    "Info",
				Confidence:  p.Confidence,
			})
		}
	}

	// Sort insights by confidence
	sort.Slice(insights, func(i, j int) bool {
		return insights[i].Confidence > insights[j].Confidence
	})

	// Limit to top 10
	if len(insights) > 10 {
		insights = insights[:10]
	}

	c.JSON(http.StatusOK, MLStatsResponse{
		Timestamp:       time.Now(),
		ModelsTrained:   stats["modelsTrained"].(int),
		PatternsFound:   stats["patternsFound"].(int),
		AnomaliesActive: stats["anomaliesActive"].(int),
		IsTraining:      stats["isTraining"].(bool),
		Insights:        insights,
	})
}

// IngestMetricsHandler accepts new metrics for ML processing
func (h *MLHandler) IngestMetrics(c *gin.Context) {
	var points []ml.MetricPoint
	if err := c.ShouldBindJSON(&points); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.service.IngestMetrics(points)
	c.JSON(http.StatusOK, gin.H{"status": "ingested", "count": len(points)})
}

// CapacityPlansResponse represents capacity planning recommendations
type CapacityPlansResponse struct {
	Timestamp    time.Time          `json:"timestamp"`
	Plans        []ml.CapacityPlan  `json:"plans"`
	Count        int                `json:"count"`
	CriticalCount int               `json:"criticalCount"`
	WarningCount  int               `json:"warningCount"`
}

// GetCapacityPlans returns capacity planning recommendations
func (h *MLHandler) GetCapacityPlans(c *gin.Context) {
	cluster := c.Query("cluster")
	namespace := c.Query("namespace")

	plans := h.service.GetCapacityPlans(cluster, namespace)

	criticalCount := 0
	warningCount := 0
	for _, p := range plans {
		if p.Severity == "Critical" {
			criticalCount++
		} else if p.Severity == "Warning" {
			warningCount++
		}
	}

	c.JSON(http.StatusOK, CapacityPlansResponse{
		Timestamp:     time.Now(),
		Plans:         plans,
		Count:         len(plans),
		CriticalCount: criticalCount,
		WarningCount:  warningCount,
	})
}

// MLIntelligenceResponse combines all ML data
type MLIntelligenceResponse struct {
	Timestamp   time.Time              `json:"timestamp"`
	Anomalies   []ml.Anomaly           `json:"anomalies"`
	Patterns    []ml.Pattern           `json:"patterns"`
	Stats       map[string]interface{} `json:"stats"`
	Insights    []MLInsight            `json:"insights"`
}

// GetMLIntelligenceHandler returns complete ML intelligence data
func (h *MLHandler) GetMLIntelligence(c *gin.Context) {
	// Get all ML data
	anomalies := h.service.GetAnomalies(time.Now().Add(-24 * time.Hour))
	patterns := h.service.GetPatterns()
	stats := h.service.GetModelStats()

	// Build insights
	var insights []MLInsight

	// Anomaly insights
	criticalCount := 0
	warningCount := 0
	for _, a := range anomalies {
		if a.Severity == "Critical" {
			criticalCount++
		} else if a.Severity == "Warning" {
			warningCount++
		}
	}

	if criticalCount > 0 {
		insights = append(insights, MLInsight{
			Type:        "summary",
			Title:       fmt.Sprintf("%d Critical Anomalies Detected", criticalCount),
			Description: "Machine learning has detected significant deviations from normal behavior",
			Severity:    "Critical",
			Confidence:  0.95,
		})
	}

	// Pattern insights
	highConfidencePatterns := 0
	for _, p := range patterns {
		if p.Confidence >= 0.7 {
			highConfidencePatterns++
			insights = append(insights, MLInsight{
				Type:        "pattern",
				Title:       p.Name,
				Description: fmt.Sprintf("Recurring issue pattern detected %d times since %s", p.Frequency, p.FirstSeen.Format("2006-01-02")),
				Severity:    "Info",
				Confidence:  p.Confidence,
			})
		}
	}

	if highConfidencePatterns > 0 {
		insights = append([]MLInsight{{
			Type:        "summary",
			Title:       fmt.Sprintf("%d Recurring Patterns Identified", highConfidencePatterns),
			Description: "Machine learning has identified recurring incident patterns that may benefit from permanent fixes",
			Severity:    "Info",
			Confidence:  0.85,
		}}, insights...)
	}

	// Model training insight
	if stats["isTraining"].(bool) {
		insights = append(insights, MLInsight{
			Type:        "system",
			Title:       "ML Models Training",
			Description: "Machine learning models are currently being retrained with new data",
			Severity:    "Info",
			Confidence:  1.0,
		})
	}

	c.JSON(http.StatusOK, MLIntelligenceResponse{
		Timestamp: time.Now(),
		Anomalies:   anomalies,
		Patterns:    patterns,
		Stats:       stats,
		Insights:    insights,
	})
}