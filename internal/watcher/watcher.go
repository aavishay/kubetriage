package watcher

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/ai"
	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type Watcher struct {
	cancelFunc context.CancelFunc
	aiService  *ai.AIService
}

func InitWatcher(ctx context.Context, aiService *ai.AIService) *Watcher {
	ctx, cancel := context.WithCancel(ctx)
	w := &Watcher{
		cancelFunc: cancel,
		aiService:  aiService,
	}
	go w.run(ctx)
	return w
}

func (w *Watcher) Stop() {
	if w.cancelFunc != nil {
		w.cancelFunc()
	}
}

func (w *Watcher) run(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	log.Println("Cluster Watcher initialized. Scanning for incidents...")

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.scanClusters(ctx)
		}
	}
}

func (w *Watcher) scanClusters(ctx context.Context) {
	if k8s.Manager == nil {
		return
	}

	clusters := k8s.Manager.ListClusters()
	for _, cls := range clusters {
		w.scanCluster(ctx, cls)
	}

	// 3. Scan Prometheus Metrics (Phase 2 - Automation Recipes)
	w.scanPrometheus(ctx)
}

func (w *Watcher) scanCluster(ctx context.Context, cls *k8s.ClusterConn) {
	client := cls.ClientSet
	if client == nil {
		return
	}

	// 1. Scan for CrashLoopBackOff / ImagePullBackOff / OOMKilled
	pods, err := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("Watcher: Failed to list pods in cluster %s: %v", cls.ID, err)
		return
	}

	for _, pod := range pods.Items {
		w.analyzePod(ctx, cls, pod)
	}

	// 2. Scan for Security Violations (Phase 4)
	w.scanSecurity(ctx, cls)

	// 3. Run Automation Recipes (Phase 2)
	w.scanAutomation(ctx, cls)
}

func (w *Watcher) analyzePod(ctx context.Context, cls *k8s.ClusterConn, pod corev1.Pod) {
	// Skip if already handled recently or healthy
	if pod.Status.Phase == corev1.PodSucceeded {
		return
	}

	var incidentType string
	var priority string = "Warning"

	// Check Container Statuses
	for _, cs := range pod.Status.ContainerStatuses {
		if cs.State.Waiting != nil && (cs.State.Waiting.Reason == "CrashLoopBackOff" || cs.State.Waiting.Reason == "ImagePullBackOff" || cs.State.Waiting.Reason == "ErrImagePull") {
			incidentType = cs.State.Waiting.Reason
			if incidentType == "CrashLoopBackOff" {
				priority = "High"
			}
		}
		if cs.LastTerminationState.Terminated != nil && cs.LastTerminationState.Terminated.Reason == "OOMKilled" {
			incidentType = "OOMKilled"
			priority = "Critical"
		}
	}

	if incidentType == "" {
		return
	}

	// Check if we already have an active incident for this Pod
	var count int64
	db.DB.Model(&db.TriageReport{}).
		Where("cluster_id = ? AND namespace = ? AND workload_name = ? AND incident_type = ? AND is_read = ?", cls.ID, pod.Namespace, pod.Name, incidentType, false).
		Count(&count)

	if count > 0 {
		return // Already tracked
	}

	// Create new Incident Report
	log.Printf("Watcher: Detected %s on %s/%s", incidentType, pod.Namespace, pod.Name)

	report := db.TriageReport{
		ClusterID:      cls.ID,
		Namespace:      pod.Namespace,
		WorkloadName:   pod.Name,
		Kind:           "Pod",
		Severity:       priority,
		IncidentType:   incidentType,
		ApprovalStatus: "Pending",
		Analysis:       fmt.Sprintf("Detected persistent **%s**. \n\nAutomated analysis indicates this issue requires attention.", incidentType),
	}

	// Resolve Owner (Workload) if possible
	if len(pod.OwnerReferences) > 0 {
		report.WorkloadName = pod.OwnerReferences[0].Name
		report.Kind = pod.OwnerReferences[0].Kind
	}

	// Assign to Default Project (MVP)
	var defaultProject db.Project
	if err := db.DB.Where("name = ?", "Default").First(&defaultProject).Error; err == nil {
		uid := defaultProject.ID
		report.ProjectID = &uid
	}

	if err := db.DB.Create(&report).Error; err != nil {
		log.Printf("Watcher: Failed to create report: %v", err)
		return
	}

	// Trigger Auto-Triage (Async)
	go w.performAutoTriage(context.Background(), cls, pod, report)
}

func (w *Watcher) performAutoTriage(ctx context.Context, cls *k8s.ClusterConn, pod corev1.Pod, report db.TriageReport) {
	if w.aiService == nil {
		return
	}

	log.Printf("Watcher: Starting Auto-Triage for %s/%s", pod.Namespace, pod.Name)

	// 1. Fetch Logs
	logs, _ := k8s.GetPodLogs(ctx, cls.ClientSet, pod.Namespace, pod.Name, &k8s.LogOptions{Lines: 50})

	// 2. Fetch Events
	events := k8s.GetPodEvents(ctx, cls.ClientSet, pod.Namespace, pod.Name)
	eventStr := ""
	for _, e := range events {
		eventStr += fmt.Sprintf("[%s] %s: %s\n", e.Type, e.Reason, e.Message)
	}

	// 3. AI Analysis & Remediation
	// We'll use GenerateRemediation directly as it's targeted
	var images []string
	for _, c := range pod.Spec.Containers {
		images = append(images, c.Image)
	}

	suggestion, err := w.aiService.GenerateRemediation(
		ctx,
		"gemini",         // Default provider
		"gemini-1.5-pro", // Default Model
		report.Kind,
		report.WorkloadName,
		logs,
		eventStr,
		strings.Join(images, ", "),
	)

	if err != nil {
		log.Printf("Watcher: Auto-Triage AI failed: %v", err)
		return
	}

	// 4. Update Report
	updates := map[string]interface{}{
		"analysis":                 fmt.Sprintf("### Auto-Triage Analysis\n\n%s\n\n**Reasoning:** %s", suggestion.Description, suggestion.Reasoning),
		"auto_remediation_payload": suggestion.PatchContent,
	}

	db.DB.Model(&report).Updates(updates)
	log.Printf("Watcher: Auto-Triage completed for %s (Patch Generated)", pod.Name)
}
