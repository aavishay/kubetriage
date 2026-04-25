package ml

import (
	"context"
	"fmt"
	"math"
	"sort"
	"sync"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"gonum.org/v1/gonum/stat"
)

// MetricPoint represents a single metric observation
type MetricPoint struct {
	Timestamp time.Time
	Value     float64
	Workload  string
	Namespace string
	Cluster   string
	Metric    string // "cpu", "memory", "network", "disk"
}

// Anomaly represents a detected anomaly
type Anomaly struct {
	ID              string    `json:"id"`
	Workload        string    `json:"workload"`
	Namespace       string    `json:"namespace"`
	Cluster         string    `json:"cluster"`
	Metric          string    `json:"metric"`
	DetectedAt      time.Time `json:"detectedAt"`
	Severity        string    `json:"severity"` // "Critical", "Warning", "Info"
	Confidence      float64   `json:"confidence"`
	ExpectedValue   float64   `json:"expectedValue"`
	ActualValue     float64   `json:"actualValue"`
	Deviation       float64   `json:"deviation"`
	Description     string    `json:"description"`
}

// Pattern represents a recurring incident pattern
type Pattern struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	Description     string                 `json:"description"`
	IncidentType    string                 `json:"incidentType"`
	Frequency       int                    `json:"frequency"`
	FirstSeen       time.Time              `json:"firstSeen"`
	LastSeen        time.Time              `json:"lastSeen"`
	AffectedWorkloads []string           `json:"affectedWorkloads"`
	CommonSymptoms  []string               `json:"commonSymptoms"`
	SuggestedFix    string                 `json:"suggestedFix"`
	Confidence      float64                `json:"confidence"`
}

// RootCausePrediction represents an ML-predicted root cause
type RootCausePrediction struct {
	IncidentID      string    `json:"incidentId"`
	RootCause       string    `json:"rootCause"`
	Confidence      float64   `json:"confidence"`
	Evidence        []string  `json:"evidence"`
	Likely          bool      `json:"likely"`
	SuggestedAction string    `json:"suggestedAction"`
}

// CapacityForecastPoint represents a single point in a capacity forecast
type CapacityForecastPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
}

// CapacityPlan represents a capacity planning recommendation for a workload
type CapacityPlan struct {
	WorkloadKey           string                  `json:"workloadKey"`
	Namespace             string                  `json:"namespace"`
	Cluster               string                  `json:"cluster"`
	Metric                string                  `json:"metric"`
	HistoricalPoints      []CapacityForecastPoint `json:"historicalPoints"`
	ForecastPoints        []CapacityForecastPoint `json:"forecastPoints"`
	TrendSlope            float64                 `json:"trendSlope"`
	TrendIntercept        float64                 `json:"trendIntercept"`
	TimeToExhaustionHours *float64                `json:"timeToExhaustionHours,omitempty"`
	Recommendation        string                  `json:"recommendation"`
	Confidence            float64                 `json:"confidence"`
	Severity              string                  `json:"severity"` // "Critical", "Warning", "Healthy"
}

// TimeSeriesModel represents a learned time series pattern
type TimeSeriesModel struct {
	mu              sync.RWMutex
	workloadKey     string
	metric          string
	mean            float64
	stdDev          float64
	seasonality     []float64
	lastUpdated     time.Time
	history         []MetricPoint
	windowSize      int
}

// Service provides ML capabilities
type Service struct {
	mu              sync.RWMutex
	models          map[string]*TimeSeriesModel
	anomalies       []Anomaly
	patterns        []Pattern
	predictions     map[string]RootCausePrediction
	isTraining      bool
}

// NewService creates a new ML service
func NewService() *Service {
	return &Service{
		models:      make(map[string]*TimeSeriesModel),
		anomalies:   make([]Anomaly, 0),
		patterns:    make([]Pattern, 0),
		predictions: make(map[string]RootCausePrediction),
	}
}

// Start begins background ML processing
func (s *Service) Start(ctx context.Context) {
	// Initial model training
	go s.TrainModels(ctx)

	// Periodic retraining
	ticker := time.NewTicker(15 * time.Minute)
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.TrainModels(ctx)
			}
		}
	}()

	// Anomaly detection every minute
	anomalyTicker := time.NewTicker(1 * time.Minute)
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-anomalyTicker.C:
				s.DetectAnomalies(ctx)
			}
		}
	}()
}

// TrainModels trains ML models on historical data
func (s *Service) TrainModels(ctx context.Context) {
	s.mu.Lock()
	s.isTraining = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.isTraining = false
		s.mu.Unlock()
	}()

	// Fetch historical reports for pattern analysis
	var reports []db.TriageReport
	if err := db.DB.Where("created_at > ?", time.Now().Add(-30*24*time.Hour)).Find(&reports).Error; err != nil {
		return
	}

	// Cluster similar incidents into patterns
	s.discoverPatterns(reports)
}

// discoverPatterns identifies recurring incident patterns
func (s *Service) discoverPatterns(reports []db.TriageReport) {
	// Group by incident type
	byType := make(map[string][]db.TriageReport)
	for _, r := range reports {
		byType[r.IncidentType] = append(byType[r.IncidentType], r)
	}

	var patterns []Pattern
	patternID := 1

	for incidentType, typeReports := range byType {
		if len(typeReports) < 3 {
			continue // Need at least 3 occurrences
		}

		// Sort by time
		sort.Slice(typeReports, func(i, j int) bool {
			return typeReports[i].CreatedAt.Before(typeReports[j].CreatedAt)
		})

		// Extract common workloads
		workloadMap := make(map[string]int)
		for _, r := range typeReports {
			workloadMap[r.WorkloadName]++
		}

		var commonWorkloads []string
		for w, count := range workloadMap {
			if count >= 2 {
				commonWorkloads = append(commonWorkloads, w)
			}
		}

		pattern := Pattern{
			ID:                fmt.Sprintf("pattern-%d", patternID),
			Name:            fmt.Sprintf("%s Pattern", incidentType),
			Description:     s.generatePatternDescription(incidentType, typeReports),
			IncidentType:    incidentType,
			Frequency:       len(typeReports),
			FirstSeen:       typeReports[0].CreatedAt,
			LastSeen:        typeReports[len(typeReports)-1].CreatedAt,
			AffectedWorkloads: commonWorkloads,
			CommonSymptoms:  s.extractCommonSymptoms(typeReports),
			SuggestedFix:    s.suggestFixForPattern(incidentType),
			Confidence:      math.Min(float64(len(typeReports))/10.0, 1.0),
		}

		patterns = append(patterns, pattern)
		patternID++
	}

	s.mu.Lock()
	s.patterns = patterns
	s.mu.Unlock()
}

func (s *Service) generatePatternDescription(incidentType string, reports []db.TriageReport) string {
	switch incidentType {
	case "OOMKilled":
		return fmt.Sprintf("Memory limit exceeded in %d occurrences across multiple workloads. Consider increasing memory limits or investigating memory leaks.", len(reports))
	case "CrashLoopBackOff":
		return fmt.Sprintf("Application crash loop detected %d times. Common causes: startup errors, missing dependencies, or configuration issues.", len(reports))
	case "ImagePullBackOff":
		return fmt.Sprintf("Container image pull failures occurred %d times. Check image tags, registry credentials, and network connectivity.", len(reports))
	default:
		return fmt.Sprintf("Recurring '%s' incidents observed %d times. Review historical fixes for permanent resolution.", incidentType, len(reports))
	}
}

func (s *Service) extractCommonSymptoms(reports []db.TriageReport) []string {
	symptoms := make(map[string]int)
	for _, r := range reports {
		if r.Analysis != "" {
			symptoms[r.Analysis]++
		}
	}

	// Get top symptoms
	var result []string
	for symptom := range symptoms {
		if len(result) < 3 {
			result = append(result, symptom)
		}
	}
	return result
}

func (s *Service) suggestFixForPattern(incidentType string) string {
	switch incidentType {
	case "OOMKilled":
		return "Increase memory limits by 20% or enable vertical pod autoscaling. Check for memory leaks in application logs."
	case "CrashLoopBackOff":
		return "Review startup logs for errors, verify ConfigMaps/Secrets, ensure database connectivity."
	case "ImagePullBackOff":
		return "Verify image tag exists, check registry credentials (imagePullSecrets), confirm network access to registry."
	case "High CPU Usage":
		return "Scale up replicas, implement horizontal pod autoscaling, or optimize application code."
	default:
		return "Review AI-generated analysis for specific remediation steps."
	}
}

// DetectAnomalies runs anomaly detection on current metrics
func (s *Service) DetectAnomalies(ctx context.Context) {
	s.mu.RLock()
	models := s.models
	s.mu.RUnlock()

	var anomalies []Anomaly
	now := time.Now()

	for _, model := range models {
		model.mu.RLock()
		history := model.history
		mean := model.mean
		stdDev := model.stdDev
		model.mu.RUnlock()

		if len(history) == 0 {
			continue
		}

		// Get latest value
		latest := history[len(history)-1]

		// Z-score based anomaly detection
		if stdDev > 0 {
			zScore := math.Abs(latest.Value-mean) / stdDev

			if zScore > 3.0 {
				// Critical anomaly (>3 sigma)
				anomalies = append(anomalies, Anomaly{
					ID:            fmt.Sprintf("anomaly-%d", len(anomalies)),
					Workload:      latest.Workload,
					Namespace:     latest.Namespace,
					Cluster:       latest.Cluster,
					Metric:        latest.Metric,
					DetectedAt:    now,
					Severity:      "Critical",
					Confidence:    math.Min(zScore/5.0, 1.0),
					ExpectedValue: mean,
					ActualValue:   latest.Value,
					Deviation:     zScore,
					Description:   fmt.Sprintf("Extreme %s anomaly detected. Expected %.2f, got %.2f (%.1fσ deviation)", latest.Metric, mean, latest.Value, zScore),
				})
			} else if zScore > 2.0 {
				// Warning anomaly (>2 sigma)
				anomalies = append(anomalies, Anomaly{
					ID:            fmt.Sprintf("anomaly-%d", len(anomalies)),
					Workload:      latest.Workload,
					Namespace:     latest.Namespace,
					Cluster:       latest.Cluster,
					Metric:        latest.Metric,
					DetectedAt:    now,
					Severity:      "Warning",
					Confidence:    zScore / 3.0,
					ExpectedValue: mean,
					ActualValue:   latest.Value,
					Deviation:     zScore,
					Description:   fmt.Sprintf("Unusual %s pattern detected. Expected %.2f, got %.2f (%.1fσ deviation)", latest.Metric, mean, latest.Value, zScore),
				})
			}
		}
	}

	s.mu.Lock()
	s.anomalies = anomalies
	s.mu.Unlock()
}

// IngestMetrics adds new metric data for anomaly detection
func (s *Service) IngestMetrics(points []MetricPoint) {
	for _, point := range points {
		key := fmt.Sprintf("%s/%s/%s/%s", point.Cluster, point.Namespace, point.Workload, point.Metric)

		s.mu.Lock()
		model, exists := s.models[key]
		if !exists {
			model = &TimeSeriesModel{
				workloadKey: key,
				metric:      point.Metric,
				windowSize:  100,
			}
			s.models[key] = model
		}
		s.mu.Unlock()

		model.mu.Lock()
		model.history = append(model.history, point)
		if len(model.history) > model.windowSize {
			model.history = model.history[len(model.history)-model.windowSize:]
		}

		// Update statistics
		values := make([]float64, len(model.history))
		for i, h := range model.history {
			values[i] = h.Value
		}
		model.mean, model.stdDev = stat.MeanStdDev(values, nil)
		model.lastUpdated = time.Now()
		model.mu.Unlock()
	}
}

// PredictRootCause analyzes an incident and predicts root cause
func (s *Service) PredictRootCause(incident db.TriageReport) RootCausePrediction {
	prediction := RootCausePrediction{
		IncidentID: fmt.Sprintf("%d", incident.ID),
		Evidence:   []string{},
	}

	// Analyze incident type and events
	switch incident.IncidentType {
	case "OOMKilled":
		prediction.RootCause = "Memory limit exceeded due to application memory leak or insufficient limits"
		prediction.Confidence = 0.85
		prediction.Likely = true
		prediction.Evidence = append(prediction.Evidence, "Container terminated with OOM exit code 137")
		prediction.SuggestedAction = "Increase memory limits or investigate memory usage patterns"

	case "CrashLoopBackOff":
		if contains(incident.Analysis, "exit code 1") {
			prediction.RootCause = "Application startup failure - likely configuration or dependency issue"
			prediction.Confidence = 0.75
			prediction.SuggestedAction = "Check application logs for startup errors"
		} else if contains(incident.Analysis, "exit code 137") {
			prediction.RootCause = "Application killed by system - possible OOM or manual termination"
			prediction.Confidence = 0.80
			prediction.SuggestedAction = "Check resource constraints and system events"
		} else {
			prediction.RootCause = "Application crash loop - investigate container logs"
			prediction.Confidence = 0.60
			prediction.SuggestedAction = "Review container startup configuration"
		}
		prediction.Likely = true

	case "ImagePullBackOff":
		prediction.RootCause = "Unable to pull container image from registry"
		prediction.Confidence = 0.90
		prediction.Likely = true
		prediction.Evidence = append(prediction.Evidence, "Image pull authentication or network issue")
		prediction.SuggestedAction = "Verify image tag exists and registry credentials"

	case "FailedScheduling":
		prediction.RootCause = "Insufficient cluster resources or scheduling constraints"
		prediction.Confidence = 0.70
		prediction.Likely = true
		prediction.SuggestedAction = "Scale cluster or relax pod affinity/anti-affinity rules"

	default:
		// Pattern matching against historical data
		prediction.RootCause = "Root cause analysis requires deeper investigation"
		prediction.Confidence = 0.40
		prediction.SuggestedAction = "Review AI analysis for detailed findings"
	}

	return prediction
}

// GetAnomalies returns detected anomalies
func (s *Service) GetAnomalies(since time.Time) []Anomaly {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []Anomaly
	for _, a := range s.anomalies {
		if a.DetectedAt.After(since) {
			result = append(result, a)
		}
	}
	return result
}

// GetPatterns returns discovered patterns
func (s *Service) GetPatterns() []Pattern {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.patterns
}

// linearRegression computes slope and intercept for y = slope*x + intercept
// using least squares. Returns R-squared as confidence measure.
func linearRegression(x, y []float64) (slope, intercept, rSquared float64) {
	if len(x) < 2 || len(y) < 2 || len(x) != len(y) {
		return 0, 0, 0
	}

	n := float64(len(x))
	var sumX, sumY, sumXY, sumX2, sumY2 float64
	for i := 0; i < len(x); i++ {
		sumX += x[i]
		sumY += y[i]
		sumXY += x[i] * y[i]
		sumX2 += x[i] * x[i]
		sumY2 += y[i] * y[i]
	}

	denom := n*sumX2 - sumX*sumX
	if denom == 0 {
		return 0, sumY / n, 0
	}

	slope = (n*sumXY - sumX*sumY) / denom
	intercept = (sumY - slope*sumX) / n

	// R-squared
	ssTot := n*sumY2 - sumY*sumY
	ssRes := sumY2 - 2*intercept*sumY - 2*slope*sumXY + n*intercept*intercept + 2*intercept*slope*sumX + slope*slope*sumX2
	if ssTot != 0 && ssTot > 0 && ssRes >= 0 {
		rSquared = 1 - ssRes/ssTot
		if rSquared < 0 {
			rSquared = 0
		}
	} else {
		rSquared = 0
	}

	return slope, intercept, rSquared
}

// GetForecast predicts future capacity needs using linear regression trend
func (s *Service) GetForecast(workloadKey string, hoursAhead int) ([]MetricPoint, error) {
	s.mu.RLock()
	model, exists := s.models[workloadKey]
	s.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("no model found for %s", workloadKey)
	}

	model.mu.RLock()
	history := make([]MetricPoint, len(model.history))
	copy(history, model.history)
	model.mu.RUnlock()

	if len(history) < 2 {
		return nil, fmt.Errorf("insufficient data for forecast")
	}

	// Build regression inputs: x = hours since first observation, y = value
	x := make([]float64, len(history))
	y := make([]float64, len(history))
	baseTime := history[0].Timestamp
	for i, h := range history {
		x[i] = h.Timestamp.Sub(baseTime).Hours()
		y[i] = h.Value
	}

	slope, _, _ := linearRegression(x, y)

	var forecast []MetricPoint
	now := time.Now()

	for i := 1; i <= hoursAhead; i++ {
		predicted := history[len(history)-1].Value + slope*float64(i)
		if predicted < 0 {
			predicted = 0
		}
		forecast = append(forecast, MetricPoint{
			Timestamp: now.Add(time.Duration(i) * time.Hour),
			Value:     predicted,
			Workload:  model.workloadKey,
			Metric:    model.metric,
		})
	}

	return forecast, nil
}

// GetCapacityPlans generates capacity planning recommendations for all tracked workloads
func (s *Service) GetCapacityPlans(clusterFilter, namespaceFilter string) []CapacityPlan {
	s.mu.RLock()
	models := make(map[string]*TimeSeriesModel, len(s.models))
	for k, v := range s.models {
		models[k] = v
	}
	s.mu.RUnlock()

	var plans []CapacityPlan
	now := time.Now()

	for _, model := range models {
		model.mu.RLock()
		history := make([]MetricPoint, len(model.history))
		copy(history, model.history)
		workloadKey := model.workloadKey
		metric := model.metric
		model.mu.RUnlock()

		if len(history) < 3 {
			continue
		}

		// Parse workloadKey: cluster/namespace/workload/metric
		parts := parseWorkloadKey(workloadKey)
		cluster := parts["cluster"]
		namespace := parts["namespace"]
		workload := parts["workload"]

		// Apply filters
		if clusterFilter != "" && cluster != clusterFilter {
			continue
		}
		if namespaceFilter != "" && namespace != namespaceFilter {
			continue
		}

		// Build regression
		x := make([]float64, len(history))
		y := make([]float64, len(history))
		baseTime := history[0].Timestamp
		for i, h := range history {
			x[i] = h.Timestamp.Sub(baseTime).Hours()
			y[i] = h.Value
		}

		slope, intercept, rSquared := linearRegression(x, y)

		// Historical points for chart
		var historicalPoints []CapacityForecastPoint
		for _, h := range history {
			historicalPoints = append(historicalPoints, CapacityForecastPoint{
				Timestamp: h.Timestamp,
				Value:     h.Value,
			})
		}

		// Forecast next 72 hours
		forecastHours := 72
		lastX := history[len(history)-1].Timestamp.Sub(baseTime).Hours()
		var forecastPoints []CapacityForecastPoint
		for i := 1; i <= forecastHours; i++ {
			nextX := lastX + float64(i)
			predicted := slope*nextX + intercept
			if predicted < 0 {
				predicted = 0
			}
			forecastPoints = append(forecastPoints, CapacityForecastPoint{
				Timestamp: now.Add(time.Duration(i) * time.Hour),
				Value:     predicted,
			})
		}

		// Determine severity and recommendation
		var recommendation string
		var severity string
		var timeToExhaustion *float64

		// Use the latest value as a proxy for current request/limit context
		// In a real implementation, we'd pass actual request/limit values
		latestValue := history[len(history)-1].Value
		projected72h := slope*(lastX+72) + intercept

		// Heuristic thresholds (can be refined with actual resource limits)
		growthRate := slope // per hour
		dailyGrowth := growthRate * 24

		if dailyGrowth > 0 {
			// Growing trend
			if projected72h > latestValue*2.0 {
				severity = "Critical"
				recommendation = fmt.Sprintf("%s usage for %s is projected to double within 72 hours. Scale replicas or increase resource limits immediately.", metric, workload)
				tte := (latestValue * 1.5) / growthRate
				timeToExhaustion = &tte
			} else if projected72h > latestValue*1.5 {
				severity = "Warning"
				recommendation = fmt.Sprintf("%s usage for %s is trending up. Consider scaling within 48-72 hours.", metric, workload)
				tte := (latestValue * 1.3) / growthRate
				timeToExhaustion = &tte
			} else {
				severity = "Healthy"
				recommendation = fmt.Sprintf("%s usage for %s is stable with moderate growth. No immediate action required.", metric, workload)
			}
		} else if dailyGrowth < -0.01 {
			// Declining trend
			severity = "Healthy"
			recommendation = fmt.Sprintf("%s usage for %s is declining. Consider right-sizing to reduce costs.", metric, workload)
		} else {
			// Flat trend
			severity = "Healthy"
			recommendation = fmt.Sprintf("%s usage for %s is stable. No capacity changes needed.", metric, workload)
		}

		plans = append(plans, CapacityPlan{
			WorkloadKey:           workloadKey,
			Namespace:             namespace,
			Cluster:               cluster,
			Metric:                metric,
			HistoricalPoints:      historicalPoints,
			ForecastPoints:        forecastPoints,
			TrendSlope:            slope,
			TrendIntercept:        intercept,
			TimeToExhaustionHours: timeToExhaustion,
			Recommendation:        recommendation,
			Confidence:            rSquared,
			Severity:              severity,
		})
	}

	return plans
}

// parseWorkloadKey splits a key like "cluster/namespace/workload/metric" into components
func parseWorkloadKey(key string) map[string]string {
	result := map[string]string{
		"cluster":   "",
		"namespace": "",
		"workload":  "",
		"metric":    "",
	}
	parts := splitKey(key)
	if len(parts) >= 1 {
		result["cluster"] = parts[0]
	}
	if len(parts) >= 2 {
		result["namespace"] = parts[1]
	}
	if len(parts) >= 3 {
		result["workload"] = parts[2]
	}
	if len(parts) >= 4 {
		result["metric"] = parts[3]
	}
	return result
}

// splitKey safely splits a workload key, handling empty strings
func splitKey(key string) []string {
	if key == "" {
		return nil
	}
	var parts []string
	start := 0
	for i := 0; i < len(key); i++ {
		if key[i] == '/' {
			parts = append(parts, key[start:i])
			start = i + 1
		}
	}
	if start < len(key) {
		parts = append(parts, key[start:])
	}
	return parts
}

// helper function
func contains(s, substr string) bool {
	return len(s) > 0 && len(substr) > 0 && s[:len(s)] != ""
}

// GetModelStats returns statistics about learned models
func (s *Service) GetModelStats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return map[string]interface{}{
		"modelsTrained":   len(s.models),
		"patternsFound":   len(s.patterns),
		"anomaliesActive": len(s.anomalies),
		"isTraining":      s.isTraining,
	}
}
