package watcher

import (
	"context"
	"fmt"
	"log"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// scanAutomation runs general health checks and automation recipes (Phase 2)
func (w *Watcher) scanAutomation(ctx context.Context, cls *k8s.ClusterConn) {
	client := cls.ClientSet
	if client == nil {
		return
	}

	// 1. Check for CrashLooping Pods
	pods, err := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return
	}

	for _, pod := range pods.Items {
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.RestartCount > 5 {
				// Try to find owner
				kind := "Pod"
				name := pod.Name
				if len(pod.OwnerReferences) > 0 {
					// Simplified: take the first owner if it's a standard workload
					owner := pod.OwnerReferences[0]
					if owner.Kind == "ReplicaSet" {
						// For Deployments, owner is RS. We should ideally find the Deployment.
						// For MVP, we'll just report the Pod but mention the owner in analysis.
					}
				}

				w.reportAutomationIssue(
					ctx,
					cls,
					pod.Namespace,
					name,
					kind,
					"Rapid CrashLoop Detected",
					fmt.Sprintf("Container '%s' in Pod '%s' has restarted %d times. Potential crashloop detected. Check logs with `kubectl logs %s -n %s --previous`.", cs.Name, pod.Name, cs.RestartCount, pod.Name, pod.Namespace),
					"High",
					"",
				)
			}

			// Check for OOMKilled
			if cs.LastTerminationState.Terminated != nil && cs.LastTerminationState.Terminated.Reason == "OOMKilled" {
				w.reportAutomationIssue(
					ctx,
					cls,
					pod.Namespace,
					pod.Name,
					"Pod",
					"OOMKilled Detected",
					fmt.Sprintf("Container '%s' was recently terminated due to OutOfMemory (OOM).", cs.Name),
					"Critical",
					"",
				)
			}
		}
	}

	// 2. Check for Stalled Deployments (Availability < Replicas for too long)
	deployments, err := client.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return
	}

	for _, deploy := range deployments.Items {
		if deploy.Spec.Replicas != nil && deploy.Status.AvailableReplicas < *deploy.Spec.Replicas {
			// Basic heuristic: if it's not ready, it's a potential issue
			// In a real system we'd check time since last update
			w.reportAutomationIssue(
				ctx,
				cls,
				deploy.Namespace,
				deploy.Name,
				"Deployment",
				"Stalled Release",
				fmt.Sprintf("Deployment has %d/%d available replicas.", deploy.Status.AvailableReplicas, *deploy.Spec.Replicas),
				"Medium",
				"",
			)
		}
	}
}

func (w *Watcher) reportAutomationIssue(ctx context.Context, cls *k8s.ClusterConn, ns, name, kind, incidentType, analysis, severity, remediation string) {
	// Dedup checking
	var count int64
	db.DB.Model(&db.TriageReport{}).
		Where("cluster_id = ? AND namespace = ? AND workload_name = ? AND incident_type = ? AND is_read = ?", cls.ID, ns, name, incidentType, false).
		Count(&count)

	if count > 0 {
		return
	}

	report := db.TriageReport{
		ClusterID:              cls.ID,
		Namespace:              ns,
		WorkloadName:           name,
		Kind:                   kind,
		Severity:               severity,
		IncidentType:           incidentType,
		ApprovalStatus:         "Pending",
		Analysis:               fmt.Sprintf("### Automation Alert\n\n%s", analysis),
		AutoRemediationPayload: remediation,
	}

	// Assign Project (same as security)
	var defaultProject db.Project
	if err := db.DB.Where("name = ?", "Default").First(&defaultProject).Error; err == nil {
		uid := defaultProject.ID
		report.ProjectID = &uid
	}

	if err := db.DB.Create(&report).Error; err != nil {
		log.Printf("Watcher: Failed to create automation report: %v", err)
	} else {
		log.Printf("Watcher: Automation Alert Created: %s on %s/%s", incidentType, ns, name)
	}
}
