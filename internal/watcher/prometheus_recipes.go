package watcher

import (
	"context"
	"fmt"
	"log"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/aavishay/kubetriage/backend/internal/prometheus"
	"github.com/prometheus/common/model"
)

func (w *Watcher) scanPrometheus(ctx context.Context) {
	if prometheus.GlobalClient == nil {
		return
	}

	var recipes []db.Recipe
	db.DB.Where("trigger_type = ? AND is_enabled = ?", "Metric", true).Find(&recipes)

	for _, recipe := range recipes {
		w.evaluateMetricRecipe(ctx, recipe)
	}
}

func (w *Watcher) evaluateMetricRecipe(ctx context.Context, recipe db.Recipe) {
	query := recipe.TriggerConfig
	if query == "" {
		return
	}

	val, err := prometheus.GlobalClient.QueryVectorRaw(ctx, query)
	if err != nil {
		log.Printf("Watcher: Recipe '%s' query failed: %v", recipe.Name, err)
		return
	}

	vector, ok := val.(model.Vector)
	if !ok {
		return
	}

	for _, sample := range vector {
		ns := string(sample.Metric["namespace"])
		pod := string(sample.Metric["pod"])
		value := float64(sample.Value)

		w.reportMetricViolation(
			ctx,
			ns,
			pod,
			recipe.Name,
			"High",
			fmt.Sprintf("Metric Trigger: %s (Value: %.2f)", recipe.Description, value),
			"Review resource utilization or check for anomalies in metrics dashboard.",
		)
	}
}

func (w *Watcher) reportMetricViolation(ctx context.Context, ns, name, incidentType, severity, analysis, remediationHint string) {
	// find cluster ID (simplified: assuming single cluster or matching by name/ns)
	// Prometheus metrics usually contain 'cluster' label if multi-cluster, but for now we assume local/primary.
	// We need a ClusterID to link the report. We'll pick the first available one from K8sManager.
	var clusterID string
	clusters := k8s.Manager.ListClusters()
	if len(clusters) > 0 {
		clusterID = clusters[0].ID
	} else {
		return
	}

	// Dedup
	var count int64
	db.DB.Model(&db.TriageReport{}).
		Where("cluster_id = ? AND namespace = ? AND workload_name = ? AND incident_type = ? AND is_read = ?", clusterID, ns, name, incidentType, false).
		Count(&count)

	if count > 0 {
		return
	}

	report := db.TriageReport{
		ClusterID:              clusterID,
		Namespace:              ns,
		WorkloadName:           name,
		Kind:                   "Pod",
		Severity:               severity,
		IncidentType:           incidentType,
		ApprovalStatus:         "Pending",
		Analysis:               fmt.Sprintf("### Performance Anomaly: %s\n\n%s\n\n**Recommendation:** %s", incidentType, analysis, remediationHint),
		AutoRemediationPayload: "", // Metrics usually require manual rightsizing, no auto-patch unless we have VPA logic
	}

	// Assign Project
	var defaultProject db.Project
	if err := db.DB.Where("name = ?", "Default").First(&defaultProject).Error; err == nil {
		uid := defaultProject.ID
		report.ProjectID = &uid
	}

	if err := db.DB.Create(&report).Error; err != nil {
		log.Printf("Watcher: Failed to create metric report: %v", err)
	} else {
		log.Printf("Watcher: Metric Alert Created: %s on %s/%s", incidentType, ns, name)
	}
}
