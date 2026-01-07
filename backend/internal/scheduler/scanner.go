package scheduler

import (
	"context"
	"fmt"
	"log"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"

	// "github.com/aavishay/kubetriage/backend/internal/ai" // Assuming existing AI service package
	"gorm.io/gorm"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func RunWorkloadScanner() {
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
					if containerStatus.State.Waiting.Reason == "CrashLoopBackOff" || containerStatus.State.Waiting.Reason == "ImagePullBackOff" {
						isRisky = true
						break
					}
				}
			}

			if isRisky {
				// Deduplicate: Check if we have an unread report for this workload in the last hour?
				// For simplified MVP, just check if ANY unread report exists
				var existingReport db.TriageReport
				result := db.DB.Where("cluster_id = ? AND namespace = ? AND workload_name = ? AND is_read = ?", cluster.ID, pod.Namespace, pod.Name, false).First(&existingReport)

				if result.Error == nil {
					// Found an existing unread report, skip to avoid spam
					continue
				} else if result.Error != gorm.ErrRecordNotFound {
					log.Printf("DB error checking reports: %v", result.Error)
					continue
				}

				// Trigger AI Analysis
				log.Printf("Triggering Proactive Analysis for %s/%s", pod.Namespace, pod.Name)

				// TODO: Call actual AI service. For now, creating a mock report.
				// In real impl: analysis, err := ai.AnalyzeLogs(...)
				analysis := fmt.Sprintf("## Proactive Alert\n\nPod `%s` in namespace `%s` is exhibiting instability.\n\n**Detected Issues:**\n- High Restart Count\n- Potential CrashLoopBackOff\n\n**Recommendation:** Check logs and resources.", pod.Name, pod.Namespace)

				report := db.TriageReport{
					ClusterID:    cluster.ID,
					Namespace:    pod.Namespace,
					WorkloadName: pod.Name, // Using Pod name as proxy for workload for now
					Kind:         "Pod",
					Analysis:     analysis,
					Severity:     "High",
				}

				if err := db.DB.Create(&report).Error; err != nil {
					log.Printf("Error saving report: %v", err)
				}
			}
		}
	}
	log.Println("RunWorkloadScanner: Scan complete.")
}
