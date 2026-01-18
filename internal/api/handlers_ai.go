package api

import (
	"fmt"
	"log"
	"net/http"

	"strings" // Added for severity check

	"github.com/google/uuid"

	"github.com/aavishay/kubetriage/backend/internal/ai"
	"github.com/aavishay/kubetriage/backend/internal/auth" // Added for user info
	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/gin-gonic/gin"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

type AIHandler struct {
	service *ai.AIService
}

func NewAIHandler(service *ai.AIService) *AIHandler {
	return &AIHandler{service: service}
}

func (h *AIHandler) AnalyzeWorkload(c *gin.Context) {
	var req ai.AnalyzeWorkloadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// --- ENRICHMENT START: Fetch Real-time K8s Events ---
	// The frontend might send stale events. We want fresh ones, especially for the specific Failing Pod.
	ctx := c.Request.Context()
	clusterID := c.Query("clusterId") // Try to get from query if available
	var client *kubernetes.Clientset

	if clusterID != "" && k8s.Manager != nil {
		if cls, err := k8s.Manager.GetCluster(clusterID); err == nil {
			client = cls.ClientSet
		}
	}
	if client == nil {
		client = k8s.ClientSet // Fallback to default/local
	}

	if client != nil && req.Namespace != "" && req.WorkloadName != "" {
		// 1. Fetch Events for the Workload itself
		workloadEvents := fetchRecentEvents(ctx, client, req.Namespace, req.WorkloadName, req.Kind)

		var freshEvents []string
		for _, e := range workloadEvents {
			freshEvents = append(freshEvents, fmt.Sprintf("%s event: [%s] %s", req.Kind, e.Reason, e.Message))
		}

		// 2. Identify Relevant Pods to find the "Bad" one
		var podSelector string
		if req.Kind == "Job" || req.Kind == "ScaledJob" {
			podSelector = fmt.Sprintf("job-name=%s", req.WorkloadName) // Common for Jobs
		} else {
			// For Deployments/StS/DS, we need the selector.
			// Fast path: Try to guess or list all pods in NS and match OwnerRef (slower but robust without querying Parent first)
			// Or better: Let's query the parent to be sure.
			// NOTE: To keep it fast, we'll Try to list pods with label "app=WORKLOAD_NAME" first as strict heuristic,
			// or just list all pods and check OwnerRef if list isn't too huge.
			// Actually, fetchRecentLogs in handlers.go does a List with selector.
			// Let's do a quick List with a broad heuristic or look up the Deployment to get the selector.
			// WE WILL LOOK UP THE PARENT. It's safer.
			switch req.Kind {
			case "Deployment":
				if d, err := client.AppsV1().Deployments(req.Namespace).Get(ctx, req.WorkloadName, metav1.GetOptions{}); err == nil {
					if sel, err := metav1.LabelSelectorAsSelector(d.Spec.Selector); err == nil {
						podSelector = sel.String()
					}
				}
			case "StatefulSet":
				if s, err := client.AppsV1().StatefulSets(req.Namespace).Get(ctx, req.WorkloadName, metav1.GetOptions{}); err == nil {
					if sel, err := metav1.LabelSelectorAsSelector(s.Spec.Selector); err == nil {
						podSelector = sel.String()
					}
				}
			case "DaemonSet":
				if d, err := client.AppsV1().DaemonSets(req.Namespace).Get(ctx, req.WorkloadName, metav1.GetOptions{}); err == nil {
					if sel, err := metav1.LabelSelectorAsSelector(d.Spec.Selector); err == nil {
						podSelector = sel.String()
					}
				}
			}
		}

		// 3. Find the "Worst" Pod if we have a selector or heuristic
		if podSelector != "" {
			if pods, err := client.CoreV1().Pods(req.Namespace).List(ctx, metav1.ListOptions{LabelSelector: podSelector}); err == nil {
				var targetPod *v1.Pod
				// Priority: Failed -> Pending -> Running (Unready)
				for _, p := range pods.Items {
					p := p
					if targetPod == nil {
						targetPod = &p
						continue
					}

					// Upgrade target if p is "worse"
					if p.Status.Phase == v1.PodFailed || p.Status.Phase == v1.PodUnknown {
						targetPod = &p
						break // Found a fail, stop
					}
					if p.Status.Phase == v1.PodPending && targetPod.Status.Phase != v1.PodFailed {
						targetPod = &p
					}
					// If both running, check readiness (simplified)
				}

				if targetPod != nil {
					// 4. Fetch Events for this specific Pod
					podEvents := fetchRecentEvents(ctx, client, req.Namespace, targetPod.Name, "Pod")
					if len(podEvents) > 0 {
						freshEvents = append(freshEvents, fmt.Sprintf("\n--- Pod %s Events ---", targetPod.Name))
						for _, e := range podEvents {
							freshEvents = append(freshEvents, fmt.Sprintf("Pod event: [%s] %s", e.Reason, e.Message))
						}
					}

					// Auto-append Pod info to logs if empty? No, keep it pure.

					// 5. Fetch Events for the Node (Correlation)
					if targetPod.Spec.NodeName != "" {
						// Node events usually live in "default"
						nodeEvents := fetchRecentEvents(ctx, client, "default", targetPod.Spec.NodeName, "Node")
						// Filter for Warning only to reduce noise? Or just take recent.
						// fetchRecentEvents usually returns last 10.
						if len(nodeEvents) > 0 {
							hasWarnings := false
							var nodeEvStr []string
							for _, e := range nodeEvents {
								if e.Type == "Warning" {
									hasWarnings = true
								}
								nodeEvStr = append(nodeEvStr, fmt.Sprintf("Node event: [%s] %s", e.Reason, e.Message))
							}
							if hasWarnings {
								freshEvents = append(freshEvents, fmt.Sprintf("\n--- Node %s Events ---", targetPod.Spec.NodeName))
								freshEvents = append(freshEvents, nodeEvStr...)
							}
						}
					}
				}
			}
		}

		if len(freshEvents) > 0 {
			// Prepend fresh events to request
			req.Events = append(freshEvents, req.Events...)
		}
	}
	// --- ENRICHMENT END ---

	analysis, err := h.service.AnalyzeWorkload(c.Request.Context(), req)
	if err != nil {
		log.Printf("Error analyzing workload: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to generate analysis: %v", err)})
		return
	}

	// 1. Detect Severity Heuristically
	severity := "Info"
	lowerAnalysis := strings.ToLower(analysis)
	if strings.Contains(lowerAnalysis, "critical") || strings.Contains(lowerAnalysis, "severe") {
		severity = "Critical"
	} else if strings.Contains(lowerAnalysis, "warning") || strings.Contains(lowerAnalysis, "high risk") {
		severity = "Warning"
	}

	// 2. Get User Project (if authenticated)
	var projectID *uuid.UUID
	if val, exists := c.Get("user"); exists {
		if userInfo, ok := val.(auth.UserInfo); ok {
			// Parse ProjectID string to UUID if valid
			if uid, err := uuid.Parse(userInfo.ProjectID); err == nil {
				projectID = &uid
			}
		}
	}

	// 3. Save to DB
	// 3. Save to DB
	reportClusterID := "local-cluster" // simplified for MVP
	report := db.TriageReport{
		ClusterID:    reportClusterID,
		WorkloadName: req.WorkloadName,
		Namespace:    req.Namespace,
		Kind:         req.Kind,
		Analysis:     analysis,
		Severity:     severity,
		ProjectID:    projectID,
		IsRead:       false,
	}

	if err := db.DB.Create(&report).Error; err != nil {
		log.Printf("Failed to save report: %v", err)
		// Proceed anyway, don't fail the request just because save failed (though ideally we should alert)
	}

	c.JSON(http.StatusOK, gin.H{"analysis": analysis, "reportId": report.ID})
}

func (h *AIHandler) GenerateRemediation(c *gin.Context) {
	var req GenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Fetch current images to avoid placeholders
	ctx := c.Request.Context()
	clusterID := c.Query("clusterId")
	var client *kubernetes.Clientset

	if clusterID != "" && k8s.Manager != nil {
		if cls, err := k8s.Manager.GetCluster(clusterID); err == nil {
			client = cls.ClientSet
		}
	}
	if client == nil {
		client = k8s.ClientSet
	}

	currentImages := ""
	if client != nil {
		switch req.ResourceKind {
		case "Deployment":
			if d, err := client.AppsV1().Deployments(req.Namespace).Get(ctx, req.ResourceName, metav1.GetOptions{}); err == nil {
				for _, c := range d.Spec.Template.Spec.Containers {
					currentImages += fmt.Sprintf("Container '%s': %s\n", c.Name, c.Image)
				}
			}
		case "StatefulSet":
			if s, err := client.AppsV1().StatefulSets(req.Namespace).Get(ctx, req.ResourceName, metav1.GetOptions{}); err == nil {
				for _, c := range s.Spec.Template.Spec.Containers {
					currentImages += fmt.Sprintf("Container '%s': %s\n", c.Name, c.Image)
				}
			}
		case "DaemonSet":
			if d, err := client.AppsV1().DaemonSets(req.Namespace).Get(ctx, req.ResourceName, metav1.GetOptions{}); err == nil {
				for _, c := range d.Spec.Template.Spec.Containers {
					currentImages += fmt.Sprintf("Container '%s': %s\n", c.Name, c.Image)
				}
			}
		}
	}

	suggestion, err := h.service.GenerateRemediation(c.Request.Context(), req.Provider, req.Model, req.ResourceKind, req.ResourceName, req.ErrorLog, req.Analysis, currentImages)
	if err != nil {
		log.Printf("Error generating remediation: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate remediation"})
		return
	}

	c.JSON(http.StatusOK, suggestion)
}

func (h *AIHandler) GetModels(c *gin.Context) {
	provider := c.Query("provider")
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider query parameter is required"})
		return
	}

	models, err := h.service.GetAvailableModels(c.Request.Context(), provider)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"models": models})
}

type GenerateTopologyRequest struct {
	Provider        string `json:"provider"`
	Model           string `json:"model"`
	WorkloadSummary string `json:"workloadSummary"`
}

func (h *AIHandler) GenerateTopology(c *gin.Context) {
	var req GenerateTopologyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	log.Printf("DEBUG: Received Topology Request. Provider: '%s', Model: '%s'", req.Provider, req.Model)

	diagram, err := h.service.GenerateTopology(c.Request.Context(), req.Provider, req.Model, req.WorkloadSummary)
	if err != nil {
		log.Printf("Error generating topology: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate topology"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"diagram": diagram})
}
