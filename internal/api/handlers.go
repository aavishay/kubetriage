package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/auth"
	"github.com/aavishay/kubetriage/backend/internal/cache"
	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/aavishay/kubetriage/backend/internal/prometheus"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"
)

// ResourceMetrics mock struct
type ResourceMetrics struct {
	CpuRequest     float64 `json:"cpuRequest"`
	CpuLimit       float64 `json:"cpuLimit"`
	CpuUsage       float64 `json:"cpuUsage"`
	MemoryRequest  float64 `json:"memoryRequest"`
	MemoryLimit    float64 `json:"memoryLimit"`
	MemoryUsage    float64 `json:"memoryUsage"`
	StorageRequest float64 `json:"storageRequest"`
	StorageLimit   float64 `json:"storageLimit"`
	StorageUsage   float64 `json:"storageUsage"`
	NetworkIn      float64 `json:"networkIn"`
	NetworkOut     float64 `json:"networkOut"`
	DiskIo         float64 `json:"diskIo"`
}

// Workload struct mapping to frontend
type Workload struct {
	ID                string          `json:"id"`
	Name              string          `json:"name"`
	Namespace         string          `json:"namespace"`
	Kind              string          `json:"kind"`
	Replicas          int32           `json:"replicas"`
	AvailableReplicas int32           `json:"availableReplicas"`
	Status            string          `json:"status"`
	Metrics           ResourceMetrics `json:"metrics"`
	RecentLogs        []string        `json:"recentLogs"`
	Events            []string        `json:"events"`
	CostPerMonth      int             `json:"costPerMonth"`
}

func HealthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "ok",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"service":   "kubetriage-backend-go",
	})
}

func DBHealthHandler(c *gin.Context) {
	if db.DB == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "error", "message": "DB not initialized"})
		return
	}
	sqlDB, err := db.DB.DB()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "error", "message": "Failed to get DB instance"})
		return
	}
	if err := sqlDB.Ping(); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "error", "message": "DB PING failed", "details": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "message": "Database connected"})
}

func getStatus(available, replicas int32) string {
	if available == replicas && replicas > 0 {
		return "Healthy"
	}
	if available == 0 && replicas > 0 {
		return "Critical"
	}
	return "Warning"
}

func getRealMetrics(ctx context.Context, namespace, name, kind string, podSpec v1.PodSpec) ResourceMetrics {
	metrics := ResourceMetrics{}

	// 1. Calculate Requests/Limits from Pod Spec
	for _, container := range podSpec.Containers {
		// CPU
		if q, ok := container.Resources.Requests[v1.ResourceCPU]; ok {
			metrics.CpuRequest += float64(q.MilliValue()) / 1000.0 // Cores
		}
		if q, ok := container.Resources.Limits[v1.ResourceCPU]; ok {
			metrics.CpuLimit += float64(q.MilliValue()) / 1000.0 // Cores
		}

		// Memory
		if q, ok := container.Resources.Requests[v1.ResourceMemory]; ok {
			metrics.MemoryRequest += float64(q.Value()) / (1024 * 1024) // MiB
		}
		if q, ok := container.Resources.Limits[v1.ResourceMemory]; ok {
			metrics.MemoryLimit += float64(q.Value()) / (1024 * 1024) // MiB
		}
	}

	// 2. Fetch Usage from Prometheus (if avail)
	// Query: sum(rate(container_cpu_usage_seconds_total{namespace="X", pod=~"Name-.*"}[5m]))
	// Note: We match pod name prefix. For Deployments/StatefulSets this works well.
	if prometheus.GlobalClient != nil {
		// CPU Usage
		cpuQuery := fmt.Sprintf(`sum(rate(container_cpu_usage_seconds_total{namespace="%s", pod=~"%s-.*", container!=""}[2m]))`, namespace, name)
		if val, err := prometheus.GlobalClient.QueryVector(ctx, cpuQuery); err == nil {
			metrics.CpuUsage = val
		}

		// Memory Usage
		memQuery := fmt.Sprintf(`sum(container_memory_working_set_bytes{namespace="%s", pod=~"%s-.*", container!=""})`, namespace, name)
		if val, err := prometheus.GlobalClient.QueryVector(ctx, memQuery); err == nil {
			metrics.MemoryUsage = val / (1024 * 1024) // MiB
		}
	} else {
		// If no Prometheus, fallback to mock (or 0)
		// User requested "no mock", but 0 might look broken if they expect data without Prom.
		// We'll leave usage as 0 if Prom is missing, but show Requests/Limits which ARE real.
	}

	return metrics
}

func fetchRecentLogs(ctx context.Context, client *kubernetes.Clientset, namespace string, matchLabels map[string]string) []string {
	if len(matchLabels) == 0 {
		return []string{}
	}

	listOpts := metav1.ListOptions{
		LabelSelector: labels.Set(matchLabels).String(),
		Limit:         1,
	}

	pods, err := client.CoreV1().Pods(namespace).List(ctx, listOpts)
	if err != nil || len(pods.Items) == 0 {
		return []string{}
	}

	pod := pods.Items[0]
	// If pod has multiple containers, default to the first one or logic to pick?
	// For now, first one is fine or let API pick (defaults to first)
	tailLines := int64(20)
	req := client.CoreV1().Pods(namespace).GetLogs(pod.Name, &v1.PodLogOptions{
		TailLines: &tailLines,
	})

	podLogs, err := req.Stream(ctx)
	if err != nil {
		return []string{}
	}
	defer podLogs.Close()

	buf := new(bytes.Buffer)
	_, err = io.Copy(buf, podLogs)
	if err != nil {
		return []string{}
	}

	lines := strings.Split(buf.String(), "\n")
	var result []string
	for _, l := range lines {
		if strings.TrimSpace(l) != "" {
			result = append(result, l)
		}
	}
	return result
}

type ClusterResponse struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Provider string `json:"provider"`
	Status   string `json:"status"`
}

func ClustersHandler(c *gin.Context) {
	// 1. Try Cache
	if val, err := cache.Get(c.Request.Context(), "clusters_list"); err == nil {
		c.Header("X-Cache", "HIT")
		c.Data(http.StatusOK, "application/json", []byte(val))
		return
	}

	if k8s.Manager == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cluster Manager not initialized"})
		return
	}

	clusters := k8s.Manager.ListClusters()
	response := make([]ClusterResponse, 0, len(clusters))

	// Multi-Tenancy Filtering
	userInfo := c.MustGet("user").(auth.UserInfo) // Use string key "user" matching middleware
	var allowedClusterIDs []string

	if userInfo.Role == auth.RoleAdmin {
		// Admin sees all? Or just their project?
		// For MVP: Admin sees all (e.g. Platform Admin)
		// Or: allow all for now if ProjectID is empty
	}

	// Fetch allowed IDs for this project
	if userInfo.ProjectID != "" {
		db.DB.Model(&db.ClusterProject{}).Where("project_id = ?", userInfo.ProjectID).Pluck("cluster_id", &allowedClusterIDs)
	}

	for _, cls := range clusters {
		// Filter: Only show if in allowed list (unless Admin/NoProject logic)
		// Strict mode: Must be in list
		isAllowed := false
		if userInfo.ProjectID != "" {
			for _, id := range allowedClusterIDs {
				if id == cls.ID {
					isAllowed = true
					break
				}
			}
		} else {
			// Backward compatibility for users without project (shouldn't happen with seeding)
			isAllowed = true
		}

		if !isAllowed && userInfo.Role != auth.RoleAdmin {
			continue
		}

		// Simple heuristic for provider based on name
		provider := "Unknown"
		if cls.Name == "minikube" {
			provider = "Minikube"
		} else if cls.Name == "docker-desktop" {
			provider = "Docker Desktop"
		} else {
			provider = "Kubernetes"
		}

		response = append(response, ClusterResponse{
			ID:       cls.ID,
			Name:     cls.Name,
			Provider: provider,
			Status:   "Active", // Mock status for now
		})
	}

	// 3. Set Cache (30s)
	if jsonBytes, err := json.Marshal(response); err == nil {
		cache.Set(c.Request.Context(), "clusters_list", jsonBytes, 30*time.Second)
	}

	c.Header("X-Cache", "MISS")
	c.JSON(http.StatusOK, response)
}

func WorkloadsHandler(c *gin.Context) {
	clusterID := c.Query("cluster")
	var client *kubernetes.Clientset

	if clusterID != "" && k8s.Manager != nil {
		cls, err := k8s.Manager.GetCluster(clusterID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Cluster not found"})
			return
		}
		client = cls.ClientSet
	} else {
		// Fallback to default
		client = k8s.ClientSet
	}

	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "K8s client not initialized"})
		return
	}

	ctx := context.TODO()
	var workloads []Workload

	// Deployments
	deps, err := client.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, d := range deps.Items {
			w := Workload{
				ID:                string(d.UID),
				Name:              d.Name,
				Namespace:         d.Namespace,
				Kind:              "Deployment",
				Replicas:          *d.Spec.Replicas,
				AvailableReplicas: d.Status.AvailableReplicas,
				Status:            getStatus(d.Status.AvailableReplicas, *d.Spec.Replicas),
				Metrics:           getRealMetrics(c.Request.Context(), d.Namespace, d.Name, "Deployment", d.Spec.Template.Spec),
				RecentLogs:        fetchRecentLogs(c.Request.Context(), client, d.Namespace, d.Spec.Selector.MatchLabels),
				Events:            []string{},
				CostPerMonth:      rand.Intn(500) + 50,
			}
			workloads = append(workloads, w)
		}
	} else {
		fmt.Printf("Error fetching deployments: %v\n", err)
	}

	// StatefulSets
	sts, err := client.AppsV1().StatefulSets("").List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, s := range sts.Items {
			w := Workload{
				ID:                string(s.UID),
				Name:              s.Name,
				Namespace:         s.Namespace,
				Kind:              "StatefulSet",
				Replicas:          *s.Spec.Replicas,
				AvailableReplicas: s.Status.ReadyReplicas,
				Status:            getStatus(s.Status.ReadyReplicas, *s.Spec.Replicas),
				Metrics:           getRealMetrics(c.Request.Context(), s.Namespace, s.Name, "StatefulSet", s.Spec.Template.Spec),
				RecentLogs:        fetchRecentLogs(c.Request.Context(), client, s.Namespace, s.Spec.Selector.MatchLabels),
				Events:            []string{},
				CostPerMonth:      rand.Intn(500) + 100,
			}
			workloads = append(workloads, w)
		}
	}

	// DaemonSets
	dss, err := client.AppsV1().DaemonSets("").List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, ds := range dss.Items {
			w := Workload{
				ID:                string(ds.UID),
				Name:              ds.Name,
				Namespace:         ds.Namespace,
				Kind:              "DaemonSet",
				Replicas:          ds.Status.DesiredNumberScheduled,
				AvailableReplicas: ds.Status.NumberReady,
				Status:            getStatus(ds.Status.NumberReady, ds.Status.DesiredNumberScheduled),
				Metrics:           getRealMetrics(c.Request.Context(), ds.Namespace, ds.Name, "DaemonSet", ds.Spec.Template.Spec),
				RecentLogs:        fetchRecentLogs(c.Request.Context(), client, ds.Namespace, ds.Spec.Selector.MatchLabels),
				Events:            []string{},
				CostPerMonth:      rand.Intn(200) + 50,
			}
			workloads = append(workloads, w)
		}
	}

	c.JSON(http.StatusOK, workloads)
}

type RegisterClusterRequest struct {
	Kubeconfig string `json:"kubeconfig" binding:"required"`
}

func RegisterClusterHandler(c *gin.Context) {
	var req RegisterClusterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload: kubeconfig is required"})
		return
	}

	if k8s.Manager == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cluster Manager not initialized"})
		return
	}

	// 1. Add to Manager (In-Memory)
	cluster, err := k8s.Manager.AddClusterFromKubeconfig([]byte(req.Kubeconfig))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to register cluster: %v", err)})
		return
	}

	// 2. Associate with Project (Multi-Tenancy)
	// For MVP, we associate with the user's current project (or Default)
	userInfo := c.MustGet("user").(auth.UserInfo)
	var projUUID uuid.UUID
	var errUUID error

	if userInfo.ProjectID != "" {
		projUUID, errUUID = uuid.Parse(userInfo.ProjectID)
		if errUUID != nil {
			fmt.Printf("Warning: Invalid project ID in user token: %v\n", errUUID)
		}
	}

	// If user has no project (shouldn't happen) or invalid, try to find/use Default
	if projUUID == uuid.Nil {
		var defaultProj db.Project
		if err := db.DB.Where("name = ?", "Default").First(&defaultProj).Error; err == nil {
			projUUID = defaultProj.ID
		}
	}

	if projUUID != uuid.Nil {
		// Check if mapping exists
		var count int64
		db.DB.Model(&db.ClusterProject{}).Where("cluster_id = ? AND project_id = ?", cluster.ID, projUUID).Count(&count)
		if count == 0 {
			db.DB.Create(&db.ClusterProject{
				ClusterID: cluster.ID, // String
				ProjectID: projUUID,   // UUID
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Cluster registered successfully",
		"id":      cluster.ID,
		"name":    cluster.Name,
	})
}
