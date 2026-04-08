package api

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/cache"
	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/gin-gonic/gin"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ClusterStatus represents the health and status of a cluster
type ClusterStatus struct {
	ID                string    `json:"id"`
	Name              string    `json:"name"`
	Status            string    `json:"status"` // "Healthy", "Degraded", "Offline"
	Provider          string    `json:"provider"`
	Region            string    `json:"region"`
	Version           string    `json:"version"`
	LastConnected     time.Time `json:"lastConnected"`
	NodeCount         int       `json:"nodeCount"`
	HealthyNodeCount  int       `json:"healthyNodeCount"`
	WorkloadCount     int       `json:"workloadCount"`
	IncidentCount     int       `json:"incidentCount"`
	TotalCPU          float64   `json:"totalCpu"`
	TotalMemory       float64   `json:"totalMemory"`
	UsedCPU           float64   `json:"usedCpu"`
	UsedMemory        float64   `json:"usedMemory"`
	Labels            map[string]string `json:"labels"`
}

// AggregatedWorkload represents a workload across all clusters
type AggregatedWorkload struct {
	ID                 string            `json:"id"`
	Name               string            `json:"name"`
	Namespace          string            `json:"namespace"`
	Kind               string            `json:"kind"`
	ClusterID          string            `json:"clusterId"`
	ClusterName        string            `json:"clusterName"`
	Status             string            `json:"status"`
	Replicas           int32             `json:"replicas"`
	AvailableReplicas  int32             `json:"availableReplicas"`
	CPUUsage           float64           `json:"cpuUsage"`
	MemoryUsage        float64           `json:"memoryUsage"`
	CostPerMonth       float64           `json:"costPerMonth"`
	HasIncidents       bool              `json:"hasIncidents"`
	Labels             map[string]string `json:"labels"`
}

// CrossClusterIncident represents an incident that may span multiple clusters
type CrossClusterIncident struct {
	ID                string            `json:"id"`
	Title             string            `json:"title"`
	Description       string            `json:"description"`
	Severity          string            `json:"severity"` // "Critical", "High", "Medium", "Low"
	Status            string            `json:"status"`   // "Active", "Resolved", "Investigating"
	AffectedClusters  []string          `json:"affectedClusters"`
	AffectedWorkloads []AffectedWorkload `json:"affectedWorkloads"`
	StartedAt         time.Time         `json:"startedAt"`
	ResolvedAt        *time.Time        `json:"resolvedAt,omitempty"`
	RootCause         string            `json:"rootCause,omitempty"`
	Pattern           string            `json:"pattern,omitempty"` // "Cascading", "Correlated", "Isolated"
}

type AffectedWorkload struct {
	WorkloadID   string `json:"workloadId"`
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
	ClusterID    string `json:"clusterId"`
	ClusterName  string `json:"clusterName"`
}

// MultiClusterResponse is the unified dashboard response
type MultiClusterResponse struct {
	Timestamp         time.Time              `json:"timestamp"`
	Clusters          []ClusterStatus        `json:"clusters"`
	Workloads         []AggregatedWorkload   `json:"workloads"`
	Incidents         []CrossClusterIncident `json:"incidents"`
	GlobalSummary     GlobalSummary          `json:"summary"`
	CorrelatedEvents  []CorrelatedEvent      `json:"correlatedEvents"`
}

type GlobalSummary struct {
	TotalClusters      int     `json:"totalClusters"`
	HealthyClusters    int     `json:"healthyClusters"`
	DegradedClusters   int     `json:"degradedClusters"`
	OfflineClusters    int     `json:"offlineClusters"`
	TotalWorkloads     int     `json:"totalWorkloads"`
	HealthyWorkloads   int     `json:"healthyWorkloads"`
	WarningWorkloads   int     `json:"warningWorkloads"`
	CriticalWorkloads  int     `json:"criticalWorkloads"`
	ActiveIncidents    int     `json:"activeIncidents"`
	CriticalIncidents  int     `json:"criticalIncidents"`
	TotalCPU           float64 `json:"totalCpu"`
	TotalMemory        float64 `json:"totalMemory"`
	CPUUtilization     float64 `json:"cpuUtilization"`
	MemoryUtilization  float64 `json:"memoryUtilization"`
	EstimatedMonthlyCost float64 `json:"estimatedMonthlyCost"`
}

type CorrelatedEvent struct {
	ID              string    `json:"id"`
	EventType       string    `json:"eventType"`
	Message         string    `json:"message"`
	Clusters        []string  `json:"clusters"`
	Count           int       `json:"count"`
	FirstSeen       time.Time `json:"firstSeen"`
	LastSeen        time.Time `json:"lastSeen"`
	CorrelationScore float64  `json:"correlationScore"` // 0-1 indicating how strongly correlated
}

// MultiClusterHandler returns aggregated data from all clusters
func MultiClusterHandler(c *gin.Context) {
	// 1. Try Cache
	cacheKey := "multicluster:aggregate"
	if val, err := cache.Get(c.Request.Context(), cacheKey); err == nil {
		c.Header("X-Cache", "HIT")
		c.Data(http.StatusOK, "application/json", []byte(val))
		return
	}

	if k8s.Manager == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cluster manager not initialized"})
		return
	}

	clusters := k8s.Manager.ListClusters()
	if len(clusters) == 0 {
		c.JSON(http.StatusOK, MultiClusterResponse{
			Timestamp: time.Now(),
			Clusters:  []ClusterStatus{},
			Workloads: []AggregatedWorkload{},
			Incidents: []CrossClusterIncident{},
			GlobalSummary: GlobalSummary{},
		})
		return
	}

	ctx := c.Request.Context()

	// Fetch data from all clusters concurrently
	var (
		clusterStatuses []ClusterStatus
		workloads       []AggregatedWorkload
		clusterIncidents map[string][]db.TriageReport
		mu              sync.Mutex
		wg              sync.WaitGroup
	)

	clusterIncidents = make(map[string][]db.TriageReport)

	for _, cluster := range clusters {
		wg.Add(1)
		go func(cls *k8s.ClusterConn) {
			defer wg.Done()

			status := fetchClusterStatus(ctx, cls)
			clusterWorkloads := fetchClusterWorkloads(ctx, cls)
			incidents := fetchClusterIncidents(cls.ID)

			mu.Lock()
			clusterStatuses = append(clusterStatuses, status)
			workloads = append(workloads, clusterWorkloads...)
			clusterIncidents[cls.ID] = incidents
			mu.Unlock()
		}(cluster)
	}

	wg.Wait()

	// Cross-cluster correlation analysis
	incidents := analyzeCrossClusterIncidents(clusterStatuses, clusterIncidents)
	correlatedEvents := findCorrelatedEvents(clusterStatuses)
	summary := calculateGlobalSummary(clusterStatuses, workloads, incidents)

	response := MultiClusterResponse{
		Timestamp:        time.Now(),
		Clusters:         clusterStatuses,
		Workloads:        workloads,
		Incidents:        incidents,
		GlobalSummary:    summary,
		CorrelatedEvents: correlatedEvents,
	}

	c.JSON(http.StatusOK, response)
}

func fetchClusterStatus(ctx context.Context, cluster *k8s.ClusterConn) ClusterStatus {
	status := ClusterStatus{
		ID:            cluster.ID,
		Name:          cluster.Name,
		Status:        "Healthy",
		LastConnected: time.Now(),
		Labels:        make(map[string]string),
	}

	if cluster.ClientSet == nil {
		status.Status = "Offline"
		return status
	}

	// Fetch nodes
	nodes, err := cluster.ClientSet.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		status.Status = "Degraded"
		return status
	}

	status.NodeCount = len(nodes.Items)

	var totalCPU, totalMem float64
	healthyNodes := 0

	for _, node := range nodes.Items {
		// Detect provider and region from node labels
		if status.Provider == "" {
			status.Provider = detectProvider(node.Labels)
			status.Region = node.Labels["topology.kubernetes.io/region"]
		}

		// Check node health
		isHealthy := true
		for _, cond := range node.Status.Conditions {
			if cond.Type == corev1.NodeReady && cond.Status != corev1.ConditionTrue {
				isHealthy = false
			}
		}

		if isHealthy {
			healthyNodes++
		}

		// Accumulate resources
		cpuCap := float64(node.Status.Capacity.Cpu().MilliValue()) / 1000.0
		memCap := float64(node.Status.Capacity.Memory().Value()) / (1024 * 1024 * 1024) // GB
		totalCPU += cpuCap
		totalMem += memCap
	}

	status.HealthyNodeCount = healthyNodes
	status.TotalCPU = totalCPU
	status.TotalMemory = totalMem

	// Get Kubernetes version
	if version, err := cluster.ClientSet.Discovery().ServerVersion(); err == nil {
		status.Version = version.GitVersion
	}

	// Set overall status based on node health percentage
	healthyPercent := float64(healthyNodes) / float64(len(nodes.Items))
	if healthyPercent < 0.5 {
		status.Status = "Degraded"
	}

	return status
}

func fetchClusterWorkloads(ctx context.Context, cluster *k8s.ClusterConn) []AggregatedWorkload {
	var workloads []AggregatedWorkload

	if cluster.ClientSet == nil {
		return workloads
	}

	// Fetch deployments
	deployments, err := cluster.ClientSet.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, d := range deployments.Items {
			status := "Healthy"
			if d.Status.AvailableReplicas < d.Status.Replicas {
				if d.Status.AvailableReplicas == 0 {
					status = "Critical"
				} else {
					status = "Warning"
				}
			}

			workloads = append(workloads, AggregatedWorkload{
				ID:                fmt.Sprintf("%s/%s/%s", cluster.ID, d.Namespace, d.Name),
				Name:              d.Name,
				Namespace:         d.Namespace,
				Kind:              "Deployment",
				ClusterID:         cluster.ID,
				ClusterName:       cluster.Name,
				Status:            status,
				Replicas:          d.Status.Replicas,
				AvailableReplicas: d.Status.AvailableReplicas,
				Labels:            d.Labels,
			})
		}
	}

	// Fetch StatefulSets
	statefulsets, err := cluster.ClientSet.AppsV1().StatefulSets("").List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, s := range statefulsets.Items {
			status := "Healthy"
			if s.Status.ReadyReplicas < s.Status.Replicas {
				if s.Status.ReadyReplicas == 0 {
					status = "Critical"
				} else {
					status = "Warning"
				}
			}

			workloads = append(workloads, AggregatedWorkload{
				ID:                fmt.Sprintf("%s/%s/%s", cluster.ID, s.Namespace, s.Name),
				Name:              s.Name,
				Namespace:         s.Namespace,
				Kind:              "StatefulSet",
				ClusterID:         cluster.ID,
				ClusterName:       cluster.Name,
				Status:            status,
				Replicas:          s.Status.Replicas,
				AvailableReplicas: s.Status.ReadyReplicas,
				Labels:            s.Labels,
			})
		}
	}

	return workloads
}

func fetchClusterIncidents(clusterID string) []db.TriageReport {
	var reports []db.TriageReport
	db.DB.Where("cluster_id = ? AND is_read = ?", clusterID, false).Find(&reports)
	return reports
}

func analyzeCrossClusterIncidents(clusterStatuses []ClusterStatus, incidentsByCluster map[string][]db.TriageReport) []CrossClusterIncident {
	var crossClusterIncidents []CrossClusterIncident

	// Group incidents by type to find patterns
	incidentMap := make(map[string][]db.TriageReport)
	for _, reports := range incidentsByCluster {
		for _, report := range reports {
			key := fmt.Sprintf("%s:%s", report.IncidentType, report.WorkloadName)
			incidentMap[key] = append(incidentMap[key], report)
		}
	}

	// Identify cross-cluster patterns
	for _, reports := range incidentMap {
		if len(reports) > 1 {
			// Same incident type on same workload name across multiple clusters
			var affectedClusters []string
			var affectedWorkloads []AffectedWorkload

			for _, r := range reports {
				affectedClusters = append(affectedClusters, r.ClusterID)
				affectedWorkloads = append(affectedWorkloads, AffectedWorkload{
					WorkloadID:   fmt.Sprintf("%s/%s", r.ClusterID, r.WorkloadName),
					Name:         r.WorkloadName,
					Namespace:    r.Namespace,
					ClusterID:    r.ClusterID,
					ClusterName:  r.ClusterID, // Could look up actual name
				})
			}

			incident := CrossClusterIncident{
				ID:                fmt.Sprintf("cci-%d", len(crossClusterIncidents)+1),
				Title:             fmt.Sprintf("%s on %s", reports[0].IncidentType, reports[0].WorkloadName),
				Description:       reports[0].Analysis,
				Severity:          reports[0].Severity,
				Status:            "Active",
				AffectedClusters:  affectedClusters,
				AffectedWorkloads: affectedWorkloads,
				StartedAt:         reports[0].CreatedAt,
				Pattern:           "Correlated",
			}

			if len(affectedClusters) > 2 {
				incident.Pattern = "Cascading"
				incident.Title = "[CASCADING] " + incident.Title
			}

			crossClusterIncidents = append(crossClusterIncidents, incident)
		}
	}

	return crossClusterIncidents
}

func findCorrelatedEvents(clusterStatuses []ClusterStatus) []CorrelatedEvent {
	// This is a simplified implementation
	// In production, this would analyze events across clusters for correlation
	var events []CorrelatedEvent

	// Check for common patterns like "ImagePullBackOff across clusters"
	// or "multiple clusters experiencing scheduling delays"

	return events
}

func calculateGlobalSummary(clusters []ClusterStatus, workloads []AggregatedWorkload, incidents []CrossClusterIncident) GlobalSummary {
	summary := GlobalSummary{
		TotalClusters: len(clusters),
	}

	var totalCPU, totalMem, usedCPU, usedMem float64

	for _, c := range clusters {
		switch c.Status {
		case "Healthy":
			summary.HealthyClusters++
		case "Degraded":
			summary.DegradedClusters++
		case "Offline":
			summary.OfflineClusters++
		}

		totalCPU += c.TotalCPU
		totalMem += c.TotalMemory
		usedCPU += c.UsedCPU
		usedMem += c.UsedMemory
	}

	summary.TotalWorkloads = len(workloads)
	summary.TotalCPU = totalCPU
	summary.TotalMemory = totalMem

	for _, w := range workloads {
		switch w.Status {
		case "Healthy":
			summary.HealthyWorkloads++
		case "Warning":
			summary.WarningWorkloads++
		case "Critical":
			summary.CriticalWorkloads++
		}

		// Rough cost estimation
		summary.EstimatedMonthlyCost += w.CostPerMonth
	}

	if totalCPU > 0 {
		summary.CPUUtilization = (usedCPU / totalCPU) * 100
	}
	if totalMem > 0 {
		summary.MemoryUtilization = (usedMem / totalMem) * 100
	}

	summary.ActiveIncidents = len(incidents)
	for _, i := range incidents {
		if i.Severity == "Critical" || i.Severity == "High" {
			summary.CriticalIncidents++
		}
	}

	return summary
}

func detectProvider(nodeLabels map[string]string) string {
	// Detect cloud provider from node labels
	if _, ok := nodeLabels["eks.amazonaws.com/nodegroup"]; ok {
		return "EKS"
	}
	if _, ok := nodeLabels["cloud.google.com/gke-nodepool"]; ok {
		return "GKE"
	}
	if _, ok := nodeLabels["kubernetes.azure.com/cluster"]; ok {
		return "AKS"
	}
	return "On-Prem"
}

// ClusterHealthCheckHandler performs a detailed health check on a specific cluster
func ClusterHealthCheckHandler(c *gin.Context) {
	clusterID := c.Param("id")

	cluster, err := k8s.Manager.GetCluster(clusterID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	health := performDetailedHealthCheck(ctx, cluster)

	c.JSON(http.StatusOK, health)
}

type DetailedClusterHealth struct {
	ClusterID          string            `json:"clusterId"`
	Status             string            `json:"status"`
	Checks             []HealthCheck     `json:"checks"`
	Components         ComponentStatus   `json:"components"`
	Recommendations    []string          `json:"recommendations"`
}

type HealthCheck struct {
	Name      string `json:"name"`
	Status    string `json:"status"` // "Pass", "Warning", "Fail"
	Message   string `json:"message"`
	Details   string `json:"details,omitempty"`
}

type ComponentStatus struct {
	ControlPlane   string `json:"controlPlane"`
	Nodes          string `json:"nodes"`
	Networking     string `json:"networking"`
	Storage        string `json:"storage"`
}

func performDetailedHealthCheck(ctx context.Context, cluster *k8s.ClusterConn) DetailedClusterHealth {
	health := DetailedClusterHealth{
		ClusterID: cluster.ID,
		Status:    "Healthy",
		Checks:    []HealthCheck{},
		Recommendations: []string{},
	}

	if cluster.ClientSet == nil {
		health.Status = "Offline"
		health.Checks = append(health.Checks, HealthCheck{
			Name:    "Connectivity",
			Status:  "Fail",
			Message: "Cannot connect to cluster API server",
		})
		return health
	}

	// Check API server responsiveness
	start := time.Now()
	_, err := cluster.ClientSet.Discovery().ServerVersion()
	latency := time.Since(start)

	if err != nil {
		health.Status = "Degraded"
		health.Checks = append(health.Checks, HealthCheck{
			Name:    "API Server",
			Status:  "Fail",
			Message: "API server is not responding",
			Details: err.Error(),
		})
	} else {
		status := "Pass"
		if latency > 2*time.Second {
			status = "Warning"
			health.Recommendations = append(health.Recommendations, "API server latency is high, check control plane resources")
		}
		health.Checks = append(health.Checks, HealthCheck{
			Name:    "API Server",
			Status:  status,
			Message: fmt.Sprintf("API server responding (latency: %v)", latency),
		})
	}

	// Check nodes
	nodes, err := cluster.ClientSet.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		health.Checks = append(health.Checks, HealthCheck{
			Name:    "Nodes",
			Status:  "Fail",
			Message: "Cannot list nodes",
		})
		health.Components.Nodes = "Unknown"
	} else {
		readyCount := 0
		for _, n := range nodes.Items {
			for _, c := range n.Status.Conditions {
				if c.Type == corev1.NodeReady && c.Status == corev1.ConditionTrue {
					readyCount++
				}
			}
		}

		status := "Pass"
		msg := fmt.Sprintf("%d/%d nodes ready", readyCount, len(nodes.Items))

		if readyCount < len(nodes.Items) {
			status = "Warning"
			unready := len(nodes.Items) - readyCount
			msg = fmt.Sprintf("%d nodes not ready", unready)
			health.Recommendations = append(health.Recommendations, fmt.Sprintf("%d nodes are not in Ready state", unready))
		}

		health.Checks = append(health.Checks, HealthCheck{
			Name:    "Nodes",
			Status:  status,
			Message: msg,
		})
		health.Components.Nodes = status
	}

	// Check for stuck pods
	pods, err := cluster.ClientSet.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err == nil {
		stuckPods := 0
		for _, p := range pods.Items {
			if p.Status.Phase == corev1.PodPending {
				// Check if pending for > 5 minutes
				if time.Since(p.CreationTimestamp.Time) > 5*time.Minute {
					stuckPods++
				}
			}
		}

		if stuckPods > 0 {
			health.Checks = append(health.Checks, HealthCheck{
				Name:    "Stuck Pods",
				Status:  "Warning",
				Message: fmt.Sprintf("%d pods stuck in Pending for > 5 minutes", stuckPods),
			})
			health.Recommendations = append(health.Recommendations, fmt.Sprintf("Investigate %d pods stuck in Pending state", stuckPods))
		}
	}

	// Overall status
	for _, check := range health.Checks {
		if check.Status == "Fail" {
			health.Status = "Degraded"
			break
		}
	}

	return health
}
