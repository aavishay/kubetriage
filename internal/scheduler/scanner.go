package scheduler

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/aavishay/kubetriage/backend/internal/ai"
	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/integrations"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/aavishay/kubetriage/backend/internal/triage"

	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func RunWorkloadScanner(aiService *ai.AIService) {
	log.Println("RunWorkloadScanner: Starting scan...")
	manager := k8s.GetClusterManager()
	if manager == nil {
		log.Println("RunWorkloadScanner: ClusterManager is nil, skipping scan.")
		return
	}
	clusters := manager.ListClusters()

	for _, cluster := range clusters {
		clusterObj, err := manager.GetCluster(cluster.ID)
		if err != nil {
			log.Printf("Error getting client for cluster %s: %v", cluster.Name, err)
			continue
		}
		client := clusterObj.ClientSet

		// List all pods in all namespaces
		pods, err := client.CoreV1().Pods("").List(context.Background(), metav1.ListOptions{})
		if err != nil {
			log.Printf("Error listing pods in cluster %s: %v", cluster.Name, err)
			continue
		}

		for _, pod := range pods.Items {
			// Heuristic: Restarts > 5 OR Status != Running/Succeeded
			isRisky := false
			for _, containerStatus := range pod.Status.ContainerStatuses {
				if containerStatus.RestartCount > 5 {
					isRisky = true
					break
				}
				if !containerStatus.Ready && containerStatus.State.Waiting != nil {
					reason := containerStatus.State.Waiting.Reason
					if reason == "CrashLoopBackOff" || reason == "ImagePullBackOff" || reason == "CreateContainerConfigError" || reason == "ErrImagePull" {
						isRisky = true
						break
					}
				}
			}

			if isRisky {
				// Resolve the top-level controller so the report is stored under the same
				// name shown in the triage workload list (Deployment/StatefulSet/etc).
				workloadName := pod.Name
				kind := "Pod"
				if len(pod.OwnerReferences) > 0 {
					workloadName, kind = k8s.ResolveTopLevelController(context.Background(), client, pod.Namespace, pod.OwnerReferences[0])
				}

				// Deduplicate: Check if we have an unread report for this workload
				var existingReport db.TriageReport
				result := db.DB.Session(&gorm.Session{Logger: db.DB.Logger.LogMode(logger.Silent)}).Where("cluster_id = ? AND namespace = ? AND workload_name = ? AND is_read = ?", cluster.ID, pod.Namespace, workloadName, false).First(&existingReport)

				if result.Error == nil {
					continue
				} else if result.Error != gorm.ErrRecordNotFound {
					log.Printf("DB error checking reports: %v", result.Error)
					continue
				}

				// Trigger AI Analysis
				log.Printf("Triggering Proactive Analysis for %s/%s", pod.Namespace, workloadName)

				if aiService == nil {
					log.Println("Warning: AIService not available for proactive scan.")
					continue
				}

				// Prepare Request
				req := ai.AnalyzeWorkloadRequest{
					WorkloadName: workloadName,
					Namespace:    pod.Namespace,
					Kind:         kind,
					Status:       string(pod.Status.Phase),
					Playbook:     "General Health",
					Instructions: "Proactive background triage of a failing pod detected by Cluster Watcher.",
				}

				// Enrich
				triage.EnrichAnalyzeRequest(context.Background(), client, &req)

				// Analyze
				analysis, err := aiService.AnalyzeWorkload(context.Background(), req)
				if err != nil {
					log.Printf("Error during proactive AI analysis: %v", err)
					analysis = fmt.Sprintf("AI Analysis failed: %v. Manual investigation required for %s/%s", err, pod.Namespace, workloadName)
				}

				severity := "High"
				if strings.Contains(strings.ToLower(analysis), "critical") {
					severity = "Critical"
				}

				report := db.TriageReport{
					ClusterID:    cluster.ID,
					Namespace:    pod.Namespace,
					WorkloadName: workloadName,
					Kind:         kind,
					Analysis:     analysis,
					Severity:     severity,
				}

				if err := db.DB.Create(&report).Error; err != nil {
					log.Printf("Error saving proactive report: %v", err)
				}

				// Send Slack Notification
				if severity == "High" || severity == "Critical" {
					go integrations.SendSlackAlert(
						fmt.Sprintf("🚨 Proactive Triage: %s/%s", pod.Namespace, workloadName),
						fmt.Sprintf("Cluster: %s\nIssue detected and triaged by AI Copilot.\n\n*Summary:*\n%s", cluster.Name, truncate(analysis, 500)),
						severity,
						nil,
					)
				}
			}
		}
	}
	log.Println("RunWorkloadScanner: Scan complete.")
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}
