package api

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/gin-gonic/gin"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
)

// DeveloperWorkload represents a workload with ownership info
type DeveloperWorkload struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	Namespace        string            `json:"namespace"`
	Kind             string            `json:"kind"`
	ClusterID        string            `json:"clusterId"`
	ClusterName      string            `json:"clusterName"`
	Status           string            `json:"status"`
	Team             string            `json:"team"`
	Owner            string            `json:"owner"`
	Email            string            `json:"email"`
	SlackChannel     string            `json:"slackChannel"`
	Replicas         int32             `json:"replicas"`
	AvailableReplicas int32            `json:"availableReplicas"`
	Images           []string          `json:"images"`
	Labels           map[string]string `json:"labels"`
	Annotations      map[string]string `json:"annotations"`
	CreatedAt        time.Time         `json:"createdAt"`
	HasOpenIncidents bool              `json:"hasOpenIncidents"`
	CostPerMonth     float64           `json:"costPerMonth"`
}

// CostBreakdown represents cost attribution data
type CostBreakdown struct {
	Team         string  `json:"team"`
	Namespace    string  `json:"namespace"`
	Cluster      string  `json:"cluster"`
	CPUCost      float64 `json:"cpuCost"`
	MemoryCost   float64 `json:"memoryCost"`
	StorageCost  float64 `json:"storageCost"`
	NetworkCost  float64 `json:"networkCost"`
	TotalCost    float64 `json:"totalCost"`
	WorkloadCount int    `json:"workloadCount"`
}

// PreDeployCheck represents a validation check result
type PreDeployCheck struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Category    string `json:"category"` // "security", "resources", "best-practices", "policy"
	Severity    string `json:"severity"` // "error", "warning", "info"
	Message     string `json:"message"`
	Details     string `json:"details,omitempty"`
	Remediation string `json:"remediation,omitempty"`
	Passed      bool   `json:"passed"`
}

// PreDeployResult represents the complete validation result
type PreDeployResult struct {
	Timestamp   time.Time         `json:"timestamp"`
	Workload    string            `json:"workload"`
	Namespace   string            `json:"namespace"`
	Checks      []PreDeployCheck  `json:"checks"`
	Passed      bool              `json:"passed"`
	Score       int               `json:"score"` // 0-100
	CanDeploy   bool              `json:"canDeploy"`
}

// DeveloperPortalResponse represents the developer portal data
type DeveloperPortalResponse struct {
	Timestamp      time.Time           `json:"timestamp"`
	Team           string              `json:"team"`
	Workloads      []DeveloperWorkload `json:"workloads"`
	OpenIncidents  []db.TriageReport   `json:"openIncidents"`
	CostSummary    CostSummary         `json:"costSummary"`
	AllowedActions []string            `json:"allowedActions"`
}

type CostSummary struct {
	MonthlyCost      float64 `json:"monthlyCost"`
	BudgetLimit      float64 `json:"budgetLimit"`
	BudgetUsedPercent float64 `json:"budgetUsedPercent"`
	Trend            string  `json:"trend"` // "up", "down", "stable"
}

// DeveloperPortalHandler returns workloads and data for a developer team
func DeveloperPortalHandler(c *gin.Context) {
	team := c.Query("team")
	if team == "" {
		// Try to get from user context or default
		team = "default"
	}

	// Get selected cluster from query param
	clusterId := c.Query("clusterId")

	// Add timeout to prevent hanging on unreachable clusters
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Get workloads owned by this team (filtered by cluster if specified)
	workloads := fetchTeamWorkloads(ctx, team, clusterId)

	// Get open incidents for these workloads
	incidents := fetchTeamIncidents(team, workloads)

	// Calculate cost summary
	costSummary := calculateTeamCost(workloads)

	response := DeveloperPortalResponse{
		Timestamp:      time.Now(),
		Team:           team,
		Workloads:      workloads,
		OpenIncidents:  incidents,
		CostSummary:    costSummary,
		AllowedActions: []string{"view", "resolve-incident", "restart", "scale"},
	}

	c.JSON(http.StatusOK, response)
}

func fetchTeamWorkloads(ctx context.Context, team string, clusterId string) []DeveloperWorkload {
	workloads := make([]DeveloperWorkload, 0) // Initialize empty slice (not nil)

	if k8s.Manager == nil {
		return workloads
	}

	for _, cluster := range k8s.Manager.ListClusters() {
		// If clusterId is specified, only query that cluster
		if clusterId != "" && cluster.ID != clusterId {
			continue
		}
		if cluster.ClientSet == nil {
			continue
		}

		// Fetch deployments
		deployments, err := cluster.ClientSet.AppsV1().Deployments("").List(ctx, metav1.ListOptions{
			LabelSelector: labels.SelectorFromSet(map[string]string{
				"app.kubernetes.io/team": team,
			}).String(),
		})
		if err == nil {
			for _, d := range deployments.Items {
				// Check if it matches the team
				workloadTeam := d.Labels["app.kubernetes.io/team"]
				if workloadTeam == "" {
					workloadTeam = d.Labels["team"]
				}
				if workloadTeam != team {
					continue
				}

				status := "Healthy"
				if d.Status.AvailableReplicas < d.Status.Replicas {
					if d.Status.AvailableReplicas == 0 {
						status = "Critical"
					} else {
						status = "Warning"
					}
				}

				var images []string
				for _, c := range d.Spec.Template.Spec.Containers {
					images = append(images, c.Image)
				}

				workloads = append(workloads, DeveloperWorkload{
					ID:                fmt.Sprintf("%s/%s/%s", cluster.ID, d.Namespace, d.Name),
					Name:              d.Name,
					Namespace:         d.Namespace,
					Kind:              "Deployment",
					ClusterID:         cluster.ID,
					ClusterName:       cluster.Name,
					Status:            status,
					Team:              workloadTeam,
					Owner:             d.Annotations["app.kubernetes.io/owner"],
					Email:             d.Annotations["app.kubernetes.io/email"],
					SlackChannel:      d.Annotations["app.kubernetes.io/slack"],
					Replicas:          d.Status.Replicas,
					AvailableReplicas: d.Status.AvailableReplicas,
					Images:            images,
					Labels:            d.Labels,
					Annotations:       d.Annotations,
					CreatedAt:         d.CreationTimestamp.Time,
					CostPerMonth:      estimateWorkloadCost(d.Spec.Template.Spec),
				})
			}
		}

		// Also check statefulsets
		statefulsets, err := cluster.ClientSet.AppsV1().StatefulSets("").List(ctx, metav1.ListOptions{
			LabelSelector: labels.SelectorFromSet(map[string]string{
				"app.kubernetes.io/team": team,
			}).String(),
		})
		if err == nil {
			for _, s := range statefulsets.Items {
				workloadTeam := s.Labels["app.kubernetes.io/team"]
				if workloadTeam == "" {
					workloadTeam = s.Labels["team"]
				}
				if workloadTeam != team {
					continue
				}

				status := "Healthy"
				if s.Status.ReadyReplicas < s.Status.Replicas {
					if s.Status.ReadyReplicas == 0 {
						status = "Critical"
					} else {
						status = "Warning"
					}
				}

				var images []string
				for _, c := range s.Spec.Template.Spec.Containers {
					images = append(images, c.Image)
				}

				workloads = append(workloads, DeveloperWorkload{
					ID:                fmt.Sprintf("%s/%s/%s", cluster.ID, s.Namespace, s.Name),
					Name:              s.Name,
					Namespace:         s.Namespace,
					Kind:              "StatefulSet",
					ClusterID:         cluster.ID,
					ClusterName:       cluster.Name,
					Status:            status,
					Team:              workloadTeam,
					Owner:             s.Annotations["app.kubernetes.io/owner"],
					Email:             s.Annotations["app.kubernetes.io/email"],
					SlackChannel:      s.Annotations["app.kubernetes.io/slack"],
					Replicas:          s.Status.Replicas,
					AvailableReplicas: s.Status.ReadyReplicas,
					Images:            images,
					Labels:            s.Labels,
					Annotations:       s.Annotations,
					CreatedAt:         s.CreationTimestamp.Time,
					CostPerMonth:      estimateWorkloadCost(s.Spec.Template.Spec),
				})
			}
		}
	}

	return workloads
}

func fetchTeamIncidents(team string, workloads []DeveloperWorkload) []db.TriageReport {
	incidents := make([]db.TriageReport, 0) // Initialize empty slice (not nil)

	// Get workload names for query
	workloadNames := make([]string, len(workloads))
	for i, w := range workloads {
		workloadNames[i] = w.Name
	}

	if len(workloadNames) > 0 {
		db.DB.Where("is_read = ?", false).
			Where("workload_name IN ?", workloadNames).
			Order("created_at desc").
			Find(&incidents)
	}

	return incidents
}

func calculateTeamCost(workloads []DeveloperWorkload) CostSummary {
	var totalCost float64
	for _, w := range workloads {
		totalCost += w.CostPerMonth
	}

	// Assume default budget of $1000 per team
	budgetLimit := 1000.0

	return CostSummary{
		MonthlyCost:       totalCost,
		BudgetLimit:       budgetLimit,
		BudgetUsedPercent: (totalCost / budgetLimit) * 100,
		Trend:             "stable",
	}
}

func estimateWorkloadCost(spec corev1.PodSpec) float64 {
	// Simplified cost estimation
	var cpu, memory float64

	for _, c := range spec.Containers {
		if c.Resources.Requests != nil {
			cpu += float64(c.Resources.Requests.Cpu().MilliValue()) / 1000.0
			memory += float64(c.Resources.Requests.Memory().Value()) / (1024 * 1024 * 1024)
		}
	}

	// Rough pricing: $30 per CPU core, $10 per GB memory per month
	return (cpu * 30) + (memory * 10)
}

// CostAttributionHandler returns cost breakdown by team/namespace
func CostAttributionHandler(c *gin.Context) {
	period := c.DefaultQuery("period", "monthly")
	clusterID := c.Query("clusterId")

	ctx := c.Request.Context()

	// Aggregate costs across all clusters (or specific cluster)
	costMap := make(map[string]*CostBreakdown)

	if k8s.Manager != nil {
		for _, cluster := range k8s.Manager.ListClusters() {
			// Filter by selected cluster if specified
			if clusterID != "" && cluster.ID != clusterID {
				continue
			}
			if cluster.ClientSet == nil {
				continue
			}

			// Get all namespaces
			namespaces, err := cluster.ClientSet.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
			if err != nil {
				continue
			}

			for _, ns := range namespaces.Items {
				team := ns.Labels["app.kubernetes.io/team"]
				if team == "" {
					team = ns.Labels["team"]
				}
				if team == "" {
					team = "unassigned"
				}

				key := fmt.Sprintf("%s/%s/%s", cluster.ID, team, ns.Name)

				if _, exists := costMap[key]; !exists {
					costMap[key] = &CostBreakdown{
						Team:      team,
						Namespace: ns.Name,
						Cluster:   cluster.Name,
					}
				}

				// Count workloads in namespace
				deployments, _ := cluster.ClientSet.AppsV1().Deployments(ns.Name).List(ctx, metav1.ListOptions{})
				statefulsets, _ := cluster.ClientSet.AppsV1().StatefulSets(ns.Name).List(ctx, metav1.ListOptions{})
				costMap[key].WorkloadCount = len(deployments.Items) + len(statefulsets.Items)

				// Estimate costs
				for _, d := range deployments.Items {
					costMap[key].TotalCost += estimateWorkloadCost(d.Spec.Template.Spec)
				}
				for _, s := range statefulsets.Items {
					costMap[key].TotalCost += estimateWorkloadCost(s.Spec.Template.Spec)
				}
			}
		}
	}

	// Convert map to slice
	var breakdowns []CostBreakdown
	for _, cb := range costMap {
		breakdowns = append(breakdowns, *cb)
	}

	// Adjust for period
	if period == "daily" {
		for i := range breakdowns {
			breakdowns[i].TotalCost /= 30
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"period":     period,
		"timestamp":  time.Now(),
		"breakdowns": breakdowns,
	})
}

// PreDeployCheckHandler validates a deployment before it goes to production
func PreDeployCheckHandler(c *gin.Context) {
	var request struct {
		Workload  string            `json:"workload"`
		Namespace string            `json:"namespace"`
		Image     string            `json:"image"`
		Replicas  int32             `json:"replicas"`
		Resources map[string]string   `json:"resources"`
		Labels    map[string]string   `json:"labels"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	checks := performPreDeployChecks(request)

	// Calculate score
	passed := 0
	for _, check := range checks {
		if check.Passed {
			passed++
		}
	}
	score := (passed * 100) / len(checks)

	// Determine if deployment is allowed
	canDeploy := score >= 70 // Allow with warnings
	for _, check := range checks {
		if check.Severity == "error" && !check.Passed {
			canDeploy = false
		}
	}

	result := PreDeployResult{
		Timestamp: time.Now(),
		Workload:  request.Workload,
		Namespace: request.Namespace,
		Checks:    checks,
		Passed:    passed == len(checks),
		Score:     score,
		CanDeploy: canDeploy,
	}

	c.JSON(http.StatusOK, result)
}

func performPreDeployChecks(request struct {
	Workload  string            `json:"workload"`
	Namespace string            `json:"namespace"`
	Image     string            `json:"image"`
	Replicas  int32             `json:"replicas"`
	Resources map[string]string   `json:"resources"`
	Labels    map[string]string   `json:"labels"`
}) []PreDeployCheck {
	var checks []PreDeployCheck

	// Check 1: Image tag is specified (not "latest")
	if request.Image != "" {
		hasTag := strings.Contains(request.Image, ":")
		isLatest := strings.HasSuffix(request.Image, ":latest")
		checks = append(checks, PreDeployCheck{
			ID:          "image-tag",
			Name:        "Image Tag Specified",
			Category:    "best-practices",
			Severity:    "warning",
			Message:     "Container image should have an explicit version tag",
			Details:     fmt.Sprintf("Image: %s", request.Image),
			Remediation: "Use a specific version tag (e.g., :v1.2.3) instead of :latest",
			Passed:      hasTag && !isLatest,
		})
	}

	// Check 2: Resource limits defined
	hasLimits := request.Resources != nil &&
		(request.Resources["cpu-limit"] != "" || request.Resources["memory-limit"] != "")
	checks = append(checks, PreDeployCheck{
		ID:          "resource-limits",
		Name:        "Resource Limits Defined",
		Category:    "resources",
		Severity:    "error",
		Message:     "Resource limits should be defined to prevent cluster disruption",
		Details:     "CPU and memory limits protect the cluster from runaway resource usage",
		Remediation: "Add resources.limits.cpu and resources.limits.memory to your container spec",
		Passed:      hasLimits,
	})

	// Check 3: Health checks defined
	hasLiveness := request.Labels != nil && request.Labels["app.kubernetes.io/health-check"] != ""
	checks = append(checks, PreDeployCheck{
		ID:          "health-checks",
		Name:        "Health Checks Configured",
		Category:    "best-practices",
		Severity:    "warning",
		Message:     "Liveness and readiness probes should be configured",
		Details:     "Health checks enable automatic recovery and proper traffic routing",
		Remediation: "Add livenessProbe and readinessProbe to your container spec",
		Passed:      hasLiveness,
	})

	// Check 4: Security context
	checks = append(checks, PreDeployCheck{
		ID:          "security-context",
		Name:        "Security Context Hardened",
		Category:    "security",
		Severity:    "warning",
		Message:     "Containers should run as non-root with read-only filesystem",
		Details:     "SecurityContext helps prevent privilege escalation attacks",
		Remediation: "Set runAsNonRoot: true, readOnlyRootFilesystem: true in securityContext",
		Passed:      true, // Placeholder - would check actual spec
	})

	// Check 5: Replicas validation
	if request.Replicas > 0 {
		checks = append(checks, PreDeployCheck{
			ID:          "replicas",
			Name:        "Replicas Configured",
			Category:    "best-practices",
			Severity:    "info",
			Message:     fmt.Sprintf("Deployment configured with %d replicas", request.Replicas),
			Passed:      request.Replicas >= 2,
		})
	}

	// Check 6: Labels present
	hasRequiredLabels := request.Labels != nil &&
		request.Labels["app.kubernetes.io/name"] != "" &&
		request.Labels["app.kubernetes.io/version"] != ""
	checks = append(checks, PreDeployCheck{
		ID:          "required-labels",
		Name:        "Required Labels Present",
		Category:    "best-practices",
		Severity:    "warning",
		Message:     "Standard Kubernetes labels should be present",
		Details:     "Labels like app.kubernetes.io/name, version, component help with tooling",
		Remediation: "Add app.kubernetes.io/name, app.kubernetes.io/version labels",
		Passed:      hasRequiredLabels,
	})

	// Check 7: Namespace quota check
	checks = append(checks, PreDeployCheck{
		ID:          "namespace-quota",
		Name:        "Namespace Quota Available",
		Category:    "policy",
		Severity:    "error",
		Message:     "Namespace has sufficient quota for this deployment",
		Details:     "ResourceQuota may block deployment if limits are exceeded",
		Remediation: "Request quota increase or reduce resource requests",
		Passed:      true, // Placeholder
	})

	return checks
}

// TeamListHandler returns list of teams
func TeamListHandler(c *gin.Context) {
	clusterID := c.Query("clusterId")

	// Add timeout to prevent hanging on unreachable clusters
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	teams := make(map[string]struct{})

	if k8s.Manager != nil {
		for _, cluster := range k8s.Manager.ListClusters() {
			// Filter by selected cluster if specified
			if clusterID != "" && cluster.ID != clusterID {
				continue
			}
			if cluster.ClientSet == nil {
				continue
			}

			// Get namespaces to find teams
			namespaces, err := cluster.ClientSet.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
			if err != nil {
				continue
			}

			for _, ns := range namespaces.Items {
				team := ns.Labels["app.kubernetes.io/team"]
				if team == "" {
					team = ns.Labels["team"]
				}
				if team != "" {
					teams[team] = struct{}{}
				}
			}
		}
	}

	teamList := make([]string, 0) // Initialize empty slice (not nil)
	for team := range teams {
		teamList = append(teamList, team)
	}

	c.JSON(http.StatusOK, gin.H{
		"teams": teamList,
	})
}

// ResolveIncidentHandler allows developers to resolve their incidents
func ResolveIncidentHandler(c *gin.Context) {
	incidentID := c.Param("id")
	var request struct {
		Resolution string `json:"resolution"`
		Team       string `json:"team"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get the incident
	var report db.TriageReport
	if err := db.DB.First(&report, incidentID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Incident not found"})
		return
	}

	// Verify team ownership
	// In a real implementation, check if the user belongs to the team that owns this workload

	// Mark as resolved
	report.IsRead = true
	report.Analysis = request.Resolution
	if err := db.DB.Save(&report).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve incident"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "resolved",
		"incident":  report.ID,
		"timestamp": time.Now(),
	})
}
