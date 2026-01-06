package api

import (
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

func getMockMetrics() ResourceMetrics {
	return ResourceMetrics{
		CpuRequest:     0.5,
		CpuLimit:       1.0,
		CpuUsage:       rand.Float64() * 0.8,
		MemoryRequest:  512,
		MemoryLimit:    1024,
		MemoryUsage:    rand.Float64() * 900,
		StorageRequest: 10,
		StorageLimit:   20,
		StorageUsage:   rand.Float64() * 10,
		NetworkIn:      rand.Float64() * 10,
		NetworkOut:     rand.Float64() * 10,
		DiskIo:         rand.Float64() * 5,
	}
}

type ClusterResponse struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Provider string `json:"provider"`
	Status   string `json:"status"`
}

func ClustersHandler(c *gin.Context) {
	if k8s.Manager == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cluster Manager not initialized"})
		return
	}

	clusters := k8s.Manager.ListClusters()
	response := make([]ClusterResponse, 0, len(clusters))

	for _, cls := range clusters {
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
				Metrics:           getMockMetrics(),
				RecentLogs:        []string{},
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
				Metrics:           getMockMetrics(),
				RecentLogs:        []string{},
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
				Metrics:           getMockMetrics(),
				RecentLogs:        []string{},
				Events:            []string{},
				CostPerMonth:      rand.Intn(200) + 50,
			}
			workloads = append(workloads, w)
		}
	}

	c.JSON(http.StatusOK, workloads)
}
