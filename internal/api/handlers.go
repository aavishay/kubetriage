package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/aavishay/kubetriage/backend/internal/cache"
	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/aavishay/kubetriage/backend/internal/prometheus"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/common/model"
	autoscalingv2 "k8s.io/api/autoscaling/v2"
	corev1 "k8s.io/api/core/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	metricsv1beta1 "k8s.io/metrics/pkg/apis/metrics/v1beta1"
)

// ResourceMetrics mock struct
type ResourceMetrics struct {
	CpuRequest        float64 `json:"cpuRequest"`
	CpuLimit          float64 `json:"cpuLimit"`
	CpuLimitPerPod    float64 `json:"cpuLimitPerPod"`
	CpuUsage          float64 `json:"cpuUsage"`
	CpuMaxPodUsage    float64 `json:"cpuMaxPodUsage"`
	CpuHotPodP99      float64 `json:"cpuHotPodP99"`
	MemoryRequest     float64 `json:"memoryRequest"`
	MemoryLimit       float64 `json:"memoryLimit"`
	MemoryLimitPerPod float64 `json:"memoryLimitPerPod"`
	MemoryUsage       float64 `json:"memoryUsage"`
	MemoryMaxPodUsage float64 `json:"memoryMaxPodUsage"`
	MemoryHotPodP99   float64 `json:"memoryHotPodP99"`
	StorageRequest        float64 `json:"storageRequest"`
	StorageLimit          float64 `json:"storageLimit"`
	StorageLimitPerPod    float64 `json:"storageLimitPerPod"`
	StorageUsage          float64 `json:"storageUsage"`
	StorageMaxPodUsage    float64 `json:"storageMaxPodUsage"`
	NetworkIn             float64 `json:"networkIn"`
	NetworkOut     float64 `json:"networkOut"`
	DiskIo         float64 `json:"diskIo"`
	CpuAvg         float64 `json:"cpuAvg"`
	CpuP95         float64 `json:"cpuP95"`
	CpuP99         float64 `json:"cpuP99"`
	MemoryAvg      float64 `json:"memoryAvg"`
	MemoryP95      float64 `json:"memoryP95"`
	MemoryP99      float64 `json:"memoryP99"`
	// GPU Metrics
	GpuRequest     float64 `json:"gpuRequest"`     // Number of GPUs requested
	GpuLimit       float64 `json:"gpuLimit"`       // Number of GPUs limited
	GpuLimitPerPod float64 `json:"gpuLimitPerPod"`
	GpuUsage       float64 `json:"gpuUsage"`       // GPU utilization in percentage
	GpuMaxPodUsage float64 `json:"gpuMaxPodUsage"`
	GpuMemoryUsage float64 `json:"gpuMemoryUsage"` // GPU memory usage in MiB
	GpuMemoryTotal float64 `json:"gpuMemoryTotal"` // GPU memory total in MiB
	GpuTemperature float64 `json:"gpuTemperature"` // GPU temperature in Celsius
	GpuPower       float64 `json:"gpuPower"`       // GPU power usage in Watts
}

type K8sEvent struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Reason   string `json:"reason"`
	Message  string `json:"message"`
	LastSeen string `json:"lastSeen"`
}

// PodSaturation carries per-pod resource usage and lifecycle signals so the
// dashboard can surface individual pods (e.g. OOMKilled, CPU-throttled) rather
// than only aggregated workload metrics.
type PodSaturation struct {
	Name              string          `json:"name"`
	Namespace         string          `json:"namespace"`
	ClusterID         string          `json:"clusterId"`
	Node              string          `json:"node,omitempty"`
	Phase             string          `json:"phase"`
	Status            string          `json:"status"` // Healthy | Warning | Critical
	RestartCount      int32           `json:"restartCount"`
	WaitingReason     string          `json:"waitingReason,omitempty"`
	TerminatedReason  string          `json:"terminatedReason,omitempty"`
	CpuThrottled      bool            `json:"cpuThrottled"`
	CpuThrottleRatio  float64         `json:"cpuThrottleRatio"`
	Metrics           ResourceMetrics   `json:"metrics"`
	OwnerWorkload     string          `json:"ownerWorkload"`
	OwnerKind         string          `json:"ownerKind"`
}

// Workload struct mapping to frontend
type Workload struct {
	ID                 string            `json:"id"`
	ClusterID          string            `json:"clusterId"`
	Name               string            `json:"name"`
	Namespace          string            `json:"namespace"`
	Kind               string            `json:"kind"`
	Replicas           int32             `json:"replicas"`
	AvailableReplicas  int32             `json:"availableReplicas"`
	PodCount           int32             `json:"podCount"`
	Status             string            `json:"status"`
	Metrics            ResourceMetrics   `json:"metrics"`
	RecentLogs         []string          `json:"recentLogs"`
	PodNames           []string          `json:"podNames"`
	Pods               []PodSaturation   `json:"pods,omitempty"`
	Events             []K8sEvent        `json:"events"`
	CostPerMonth       int               `json:"costPerMonth"`
	Scaling            ScalingInfo       `json:"scaling"`
	SchedulerLogs      []string          `json:"schedulerLogs,omitempty"`
	Provisioning       *ProvisioningInfo `json:"provisioning,omitempty"`
	ProvisioningStatus string            `json:"provisioningStatus,omitempty"` // e.g. "Provisioning", "Scheduled"
	Recommendation     *Recommendation   `json:"recommendation,omitempty"`
}

type Recommendation struct {
	Action     string `json:"action"` // "Upsize", "Downsize", "None"
	Confidence int    `json:"confidence"`
	Reason     string `json:"reason"`
}

type ProvisioningInfo struct {
	Enabled           bool     `json:"enabled"`
	NodePools         []string `json:"nodePools"`
	NodeClaims        []string `json:"nodeClaims"`
	Misconfigurations []string `json:"misconfigurations,omitempty"`
}

type ScalingInfo struct {
	Enabled           bool        `json:"enabled"`
	Min               int32       `json:"min"`
	Max               int32       `json:"max"`
	Current           int32       `json:"current"`
	KedaReady         bool        `json:"kedaReady"`
	Active            bool        `json:"active"`
	Paused            bool        `json:"paused"`
	Fallback          bool        `json:"fallback"`
	Config            *KedaConfig `json:"config,omitempty"`
	Misconfigurations []string    `json:"misconfigurations,omitempty"`
}

type KedaConfig struct {
	Name     string   `json:"name"`
	Triggers []string `json:"triggers"`
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
	if available >= replicas {
		return "Healthy"
	}
	if available == 0 && replicas > 0 {
		return "Critical"
	}
	return "Warning"
}

func getRealMetrics(ctx context.Context, clusterID, namespace, name, kind string, podSpec v1.PodSpec, window string, matchLabels map[string]string, replicas int32) ResourceMetrics {
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

		// Ephemeral Storage
		if q, ok := container.Resources.Requests[v1.ResourceEphemeralStorage]; ok {
			metrics.StorageRequest += float64(q.Value()) / (1024 * 1024 * 1024) // GiB
		}
		if q, ok := container.Resources.Limits[v1.ResourceEphemeralStorage]; ok {
			metrics.StorageLimit += float64(q.Value()) / (1024 * 1024 * 1024) // GiB
		}

		// GPU Resources (nvidia.com/gpu, amd.com/gpu, etc.)
		for resourceName, q := range container.Resources.Requests {
			if strings.Contains(string(resourceName), "gpu") || strings.Contains(string(resourceName), "nvidia.com") {
				metrics.GpuRequest += float64(q.Value())
			}
		}
		for resourceName, q := range container.Resources.Limits {
			if strings.Contains(string(resourceName), "gpu") || strings.Contains(string(resourceName), "nvidia.com") {
				metrics.GpuLimit += float64(q.Value())
			}
		}
	}

	// 1.5 Scale Limits/Requests by Replicas
	if replicas > 1 {
		scale := float64(replicas)
		metrics.CpuLimitPerPod = metrics.CpuLimit
		metrics.MemoryLimitPerPod = metrics.MemoryLimit
		metrics.StorageLimitPerPod = metrics.StorageLimit
		metrics.GpuLimitPerPod = metrics.GpuLimit
		metrics.CpuRequest *= scale
		metrics.CpuLimit *= scale
		metrics.MemoryRequest *= scale
		metrics.MemoryLimit *= scale
		metrics.StorageRequest *= scale
		metrics.StorageLimit *= scale
		metrics.GpuRequest *= scale
		metrics.GpuLimit *= scale
	} else {
		metrics.CpuLimitPerPod = metrics.CpuLimit
		metrics.MemoryLimitPerPod = metrics.MemoryLimit
		metrics.StorageLimitPerPod = metrics.StorageLimit
		metrics.GpuLimitPerPod = metrics.GpuLimit
	}

	// 2. Fetch Usage from Prometheus (if avail)
	if prometheus.GlobalClient != nil {
		// CPU Usage
		cpuQuery := fmt.Sprintf(`sum(rate(container_cpu_usage_seconds_total{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$", container!=""}[2m]))`, namespace, name)
		if val, err := prometheus.GlobalClient.QueryVector(ctx, cpuQuery); err == nil && val > 0 {
			metrics.CpuUsage = val
		}

		// Per-pod P99 CPU and memory: identify the most overloaded pod per resource.
		cpuP99ByPod := queryPodResourceP99(ctx, namespace, name, "cpu", window)
		for _, v := range cpuP99ByPod {
			if v > metrics.CpuHotPodP99 {
				metrics.CpuHotPodP99 = v
			}
		}
		memP99ByPod := queryPodResourceP99(ctx, namespace, name, "memory", window)
		for _, v := range memP99ByPod {
			vMiB := v / (1024 * 1024)
			if vMiB > metrics.MemoryHotPodP99 {
				metrics.MemoryHotPodP99 = vMiB
			}
		}

		// Memory Usage
		memQuery := fmt.Sprintf(`sum(container_memory_working_set_bytes{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$", container!=""})`, namespace, name)
		if val, err := prometheus.GlobalClient.QueryVector(ctx, memQuery); err == nil {
			metrics.MemoryUsage = val / (1024 * 1024) // MiB
		}

		// Storage Usage (Ephemeral)
		storageQuery := fmt.Sprintf(`sum(container_fs_usage_bytes{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$", container!=""})`, namespace, name)
		if val, err := prometheus.GlobalClient.QueryVector(ctx, storageQuery); err == nil {
			metrics.StorageUsage = val / (1024 * 1024 * 1024) // GiB
		}

		// Network
		netInQuery := fmt.Sprintf(`sum(rate(container_network_receive_bytes_total{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$"}[2m]))`, namespace, name)
		if val, err := prometheus.GlobalClient.QueryVector(ctx, netInQuery); err == nil {
			metrics.NetworkIn = val / (1024 * 1024) // MB/s
		}
		netOutQuery := fmt.Sprintf(`sum(rate(container_network_transmit_bytes_total{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$"}[2m]))`, namespace, name)
		if val, err := prometheus.GlobalClient.QueryVector(ctx, netOutQuery); err == nil {
			metrics.NetworkOut = val / (1024 * 1024) // MB/s
		}

		// Advanced Metrics (Avg/P95/P99)
		subStep := "5m"
		if window == "5m" || window == "10m" || window == "15m" || window == "30m" {
			subStep = "1m"
		}
		if window == "1m" {
			subStep = "10s"
		}

		cpuAvgQuery := fmt.Sprintf(`avg_over_time(sum(rate(container_cpu_usage_seconds_total{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$", container!=""}[2m]))[%s:%s])`, namespace, name, window, subStep)
		if val, err := prometheus.GlobalClient.QueryVector(ctx, cpuAvgQuery); err == nil {
			metrics.CpuAvg = val
		}

		memAvgQuery := fmt.Sprintf(`avg_over_time(sum(container_memory_working_set_bytes{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$", container!=""})[%s:%s])`, namespace, name, window, subStep)
		if val, err := prometheus.GlobalClient.QueryVector(ctx, memAvgQuery); err == nil {
			metrics.MemoryAvg = val / (1024 * 1024)
		}

		// GPU Metrics (NVIDIA DCGM exporter or similar)
		// GPU Utilization percentage
		gpuUtilQuery := fmt.Sprintf(`avg_over_time(sum(dcgm_gpu_utilization{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$"})[%s:%s])`, namespace, name, window, subStep)
		if val, err := prometheus.GlobalClient.QueryVector(ctx, gpuUtilQuery); err == nil {
			metrics.GpuUsage = val
		} else {
			// Fallback to nvidia_gpu_utilization
			gpuUtilQuery = fmt.Sprintf(`avg_over_time(sum(nvidia_gpu_utilization_gpu{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$"})[%s:%s])`, namespace, name, window, subStep)
			if val, err := prometheus.GlobalClient.QueryVector(ctx, gpuUtilQuery); err == nil {
				metrics.GpuUsage = val
			}
		}

		// GPU Memory Usage
		gpuMemQuery := fmt.Sprintf(`avg_over_time(sum(dcgm_fb_used{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$"})[%s:%s])`, namespace, name, window, subStep)
		if val, err := prometheus.GlobalClient.QueryVector(ctx, gpuMemQuery); err == nil {
			metrics.GpuMemoryUsage = val
		} else {
			// Fallback to nvidia_gpu_memory_used
			gpuMemQuery = fmt.Sprintf(`avg_over_time(sum(nvidia_gpu_memory_used_bytes{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$"})[%s:%s])`, namespace, name, window, subStep)
			if val, err := prometheus.GlobalClient.QueryVector(ctx, gpuMemQuery); err == nil {
				metrics.GpuMemoryUsage = val / (1024 * 1024) // Convert to MiB
			}
		}

		// GPU Memory Total
		gpuMemTotalQuery := fmt.Sprintf(`avg_over_time(sum(dcgm_fb_free{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$"} + dcgm_fb_used{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$"})[%s:%s])`, namespace, name, namespace, name, window, subStep)
		if val, err := prometheus.GlobalClient.QueryVector(ctx, gpuMemTotalQuery); err == nil {
			metrics.GpuMemoryTotal = val
		} else {
			// Fallback to nvidia_gpu_memory_total
			gpuMemTotalQuery = fmt.Sprintf(`avg_over_time(sum(nvidia_gpu_memory_total_bytes{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$"})[%s:%s])`, namespace, name, window, subStep)
			if val, err := prometheus.GlobalClient.QueryVector(ctx, gpuMemTotalQuery); err == nil {
				metrics.GpuMemoryTotal = val / (1024 * 1024) // Convert to MiB
			}
		}

		// GPU Temperature
		gpuTempQuery := fmt.Sprintf(`avg_over_time(sum(dcgm_temperature_gpu{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$"})[%s:%s])`, namespace, name, window, subStep)
		if val, err := prometheus.GlobalClient.QueryVector(ctx, gpuTempQuery); err == nil {
			metrics.GpuTemperature = val
		} else {
			// Fallback to nvidia_gpu_temperature
			gpuTempQuery = fmt.Sprintf(`avg_over_time(sum(nvidia_gpu_temperature_gpu{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$"})[%s:%s])`, namespace, name, window, subStep)
			if val, err := prometheus.GlobalClient.QueryVector(ctx, gpuTempQuery); err == nil {
				metrics.GpuTemperature = val
			}
		}

		// GPU Power Usage
		gpuPowerQuery := fmt.Sprintf(`avg_over_time(sum(dcgm_power_usage{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$"})[%s:%s])`, namespace, name, window, subStep)
		if val, err := prometheus.GlobalClient.QueryVector(ctx, gpuPowerQuery); err == nil {
			metrics.GpuPower = val
		} else {
			// Fallback to nvidia_gpu_power
			gpuPowerQuery = fmt.Sprintf(`avg_over_time(sum(nvidia_gpu_power_usage_milliwatts{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$"})[%s:%s])`, namespace, name, window, subStep)
			if val, err := prometheus.GlobalClient.QueryVector(ctx, gpuPowerQuery); err == nil {
				metrics.GpuPower = val / 1000 // Convert mW to W
			}
		}
	}

	// 4. Fallback: Metrics Server (Real Data)
	// If usage is still 0 (Prometheus failed or missing), try Kubernetes Metrics API
	if (metrics.CpuUsage == 0 || metrics.MemoryUsage == 0 || metrics.StorageUsage == 0) && len(matchLabels) > 0 && clusterID != "" {
		mgr := k8s.GetClusterManager()
		if mgr != nil {
			// VPN MODE: Connect to selected cluster on-demand, then get metrics client
			cls, err := mgr.GetOrConnectCluster(clusterID)
			if err == nil && cls != nil && cls.MetricsClient != nil {
				selector := ""
				for k, v := range matchLabels {
					if selector != "" {
						selector += ","
					}
					selector += fmt.Sprintf("%s=%s", k, v)
				}

				podMetrics, err := cls.MetricsClient.MetricsV1beta1().PodMetricses(namespace).List(ctx, metav1.ListOptions{LabelSelector: selector})
				if err == nil {
					var cpuTotal float64
					var memTotal float64
					var storageTotal float64

					for _, pm := range podMetrics.Items {
						for _, c := range pm.Containers {
							if metrics.CpuUsage == 0 {
								cpuTotal += float64(c.Usage.Cpu().MilliValue()) / 1000.0 // Cores
							}
							if metrics.MemoryUsage == 0 {
								memTotal += float64(c.Usage.Memory().Value()) / (1024 * 1024) // MiB
							}
							if metrics.StorageUsage == 0 {
								if q, ok := c.Usage[v1.ResourceEphemeralStorage]; ok {
									storageTotal += float64(q.Value()) / (1024 * 1024 * 1024) // GiB
								}
							}
						}
					}

					if cpuTotal > 0 || memTotal > 0 || storageTotal > 0 {
						if metrics.CpuUsage == 0 {
							metrics.CpuUsage = cpuTotal
						}
						if metrics.MemoryUsage == 0 {
							metrics.MemoryUsage = memTotal
						}
						if metrics.StorageUsage == 0 {
							metrics.StorageUsage = storageTotal
						}
					}
				}
			}
		}
	}

	// 5. Final fallback: Kubelet stats summary for ephemeral storage
	// The Kubernetes Metrics API only provides CPU/Memory. Ephemeral storage
	// is available via each node's kubelet /stats/summary endpoint.
	if metrics.StorageUsage == 0 && len(matchLabels) > 0 && clusterID != "" {
		mgr := k8s.GetClusterManager()
		if mgr != nil {
			cls, err := mgr.GetOrConnectCluster(clusterID)
			if err == nil && cls != nil && cls.ClientSet != nil {
				usage := fetchEphemeralStorageFromKubelet(ctx, cls.ClientSet, namespace, matchLabels)
				if usage > 0 {
					metrics.StorageUsage = usage
				}
			}
		}
	}

	return metrics
}

// getPodRequestsAndLimits sums container-level requests and limits for a single pod.
func getPodRequestsAndLimits(podSpec v1.PodSpec) ResourceMetrics {
	m := ResourceMetrics{}
	for _, c := range podSpec.Containers {
		if q, ok := c.Resources.Requests[v1.ResourceCPU]; ok {
			m.CpuRequest += float64(q.MilliValue()) / 1000.0
		}
		if q, ok := c.Resources.Limits[v1.ResourceCPU]; ok {
			m.CpuLimit += float64(q.MilliValue()) / 1000.0
		}
		if q, ok := c.Resources.Requests[v1.ResourceMemory]; ok {
			m.MemoryRequest += float64(q.Value()) / (1024 * 1024)
		}
		if q, ok := c.Resources.Limits[v1.ResourceMemory]; ok {
			m.MemoryLimit += float64(q.Value()) / (1024 * 1024)
		}
		if q, ok := c.Resources.Requests[v1.ResourceEphemeralStorage]; ok {
			m.StorageRequest += float64(q.Value()) / (1024 * 1024 * 1024)
		}
		if q, ok := c.Resources.Limits[v1.ResourceEphemeralStorage]; ok {
			m.StorageLimit += float64(q.Value()) / (1024 * 1024 * 1024)
		}
		for resourceName, q := range c.Resources.Requests {
			if strings.Contains(string(resourceName), "gpu") || strings.Contains(string(resourceName), "nvidia.com") {
				m.GpuRequest += float64(q.Value())
			}
		}
		for resourceName, q := range c.Resources.Limits {
			if strings.Contains(string(resourceName), "gpu") || strings.Contains(string(resourceName), "nvidia.com") {
				m.GpuLimit += float64(q.Value())
			}
		}
	}
	return m
}

// podContainerStatus extracts the most severe container status signals from a pod.
func podContainerStatus(pod corev1.Pod) (waitingReason, terminatedReason string, restartCount int32) {
	for _, cs := range pod.Status.ContainerStatuses {
		restartCount += cs.RestartCount
		if cs.State.Waiting != nil && cs.State.Waiting.Reason != "" {
			if waitingReason == "" {
				waitingReason = cs.State.Waiting.Reason
			}
		}
		if cs.LastTerminationState.Terminated != nil && cs.LastTerminationState.Terminated.Reason != "" {
			if terminatedReason == "" {
				terminatedReason = cs.LastTerminationState.Terminated.Reason
			}
		}
	}
	return
}

// podPhaseStatus maps pod phase and container signals to a dashboard severity.
func podPhaseStatus(phase string, waitingReason, terminatedReason string) string {
	if terminatedReason == "OOMKilled" || terminatedReason == "Error" || waitingReason == "CrashLoopBackOff" || waitingReason == "ImagePullBackOff" || waitingReason == "ErrImagePull" || waitingReason == "CreateContainerError" || waitingReason == "CreateContainerConfigError" || phase == "Failed" || phase == "Unknown" {
		return "Critical"
	}
	if phase == "Pending" || waitingReason != "" || terminatedReason != "" {
		return "Warning"
	}
	return "Healthy"
}

// queryPodCPUThrottling returns a map of pod name -> throttle ratio for pods in the namespace.
// It is best-effort: errors are ignored and an empty map is returned. The query is scoped to
// the whole namespace so a single call can serve all workloads in that namespace.
func queryPodCPUThrottling(ctx context.Context, namespace string) map[string]float64 {
	if prometheus.GlobalClient == nil {
		return nil
	}
	throttledQuery := fmt.Sprintf(`sum by (pod) (rate(container_cpu_cfs_throttled_seconds_total{namespace="%s", container!=""}[2m]))`, namespace)
	rawTotalQuery := fmt.Sprintf(`sum by (pod) (rate(container_cpu_cfs_periods_total{namespace="%s", container!=""}[2m]))`, namespace)

	throttledResult, err := prometheus.GlobalClient.QueryVectorRaw(ctx, throttledQuery)
	if err != nil {
		return nil
	}
	throttledVector, ok := throttledResult.(model.Vector)
	if !ok {
		return nil
	}

	totalResult, err := prometheus.GlobalClient.QueryVectorRaw(ctx, rawTotalQuery)
	if err != nil {
		return nil
	}
	totalVector, ok := totalResult.(model.Vector)
	if !ok {
		return nil
	}

	totalByPod := make(map[string]float64, len(totalVector))
	for _, s := range totalVector {
		podName := string(s.Metric["pod"])
		if podName != "" {
			totalByPod[podName] = float64(s.Value)
		}
	}

	out := make(map[string]float64, len(throttledVector))
	for _, s := range throttledVector {
		podName := string(s.Metric["pod"])
		if podName == "" {
			continue
		}
		throttled := float64(s.Value)
		total := totalByPod[podName]
		if total > 0 {
			out[podName] = throttled / total
		} else if throttled > 0 {
			out[podName] = 1.0
		}
	}
	return out
}

// buildPodSaturationList creates a capped, severity-sorted list of PodSaturation entries
// for pods matching the workload's selector. All non-healthy pods are kept; only the
// top-N healthy pods by resource saturation are included to limit response size.
// It also returns the per-pod maxima observed across *all* matched pods (before capping)
// and the total matched pod count so callers can size the workload correctly.
func buildPodSaturationList(ctx context.Context, clusterID, namespace, ownerName, ownerKind string, matchLabels map[string]string, allPods []corev1.Pod, podSpec v1.PodSpec, podMetricsByName map[string]metricsv1beta1.PodMetrics, throttleByPod map[string]float64, maxHealthy int) ([]PodSaturation, ResourceMetrics, int) {
	selector := labels.SelectorFromSet(labels.Set(matchLabels))
	var matched []corev1.Pod
	for _, p := range allPods {
		if p.Namespace != namespace {
			continue
		}
		if selector.Matches(labels.Set(p.Labels)) {
			matched = append(matched, p)
		}
	}
	if len(matched) == 0 {
		return nil, ResourceMetrics{}, 0
	}

	requestsAndLimits := getPodRequestsAndLimits(podSpec)
	maxMetrics := ResourceMetrics{}

	pods := make([]PodSaturation, 0, len(matched))
	for _, pod := range matched {
		waitingReason, terminatedReason, restartCount := podContainerStatus(pod)
		status := podPhaseStatus(string(pod.Status.Phase), waitingReason, terminatedReason)
		if status == "Healthy" && restartCount > 0 {
			status = "Warning"
		}

		metrics := requestsAndLimits
		pm, hasMetrics := podMetricsByName[pod.Name]
		if hasMetrics {
			for _, c := range pm.Containers {
				metrics.CpuUsage += float64(c.Usage.Cpu().MilliValue()) / 1000.0
				metrics.MemoryUsage += float64(c.Usage.Memory().Value()) / (1024 * 1024)
				if q, ok := c.Usage[v1.ResourceEphemeralStorage]; ok {
					metrics.StorageUsage += float64(q.Value()) / (1024 * 1024 * 1024)
				}
			}
		}

		if metrics.CpuUsage > maxMetrics.CpuMaxPodUsage {
			maxMetrics.CpuMaxPodUsage = metrics.CpuUsage
		}
		if metrics.MemoryUsage > maxMetrics.MemoryMaxPodUsage {
			maxMetrics.MemoryMaxPodUsage = metrics.MemoryUsage
		}
		if metrics.StorageUsage > maxMetrics.StorageMaxPodUsage {
			maxMetrics.StorageMaxPodUsage = metrics.StorageUsage
		}
		if metrics.GpuUsage > maxMetrics.GpuMaxPodUsage {
			maxMetrics.GpuMaxPodUsage = metrics.GpuUsage
		}

		cpuThrottleRatio := throttleByPod[pod.Name]
		cpuThrottled := cpuThrottleRatio > 0.05
		if cpuThrottled && status == "Healthy" {
			status = "Warning"
		}

		pods = append(pods, PodSaturation{
			Name:             pod.Name,
			Namespace:        pod.Namespace,
			ClusterID:        clusterID,
			Node:             pod.Spec.NodeName,
			Phase:            string(pod.Status.Phase),
			Status:           status,
			RestartCount:     restartCount,
			WaitingReason:    waitingReason,
			TerminatedReason: terminatedReason,
			CpuThrottled:     cpuThrottled,
			CpuThrottleRatio: cpuThrottleRatio,
			Metrics:          metrics,
			OwnerWorkload:    ownerName,
			OwnerKind:        ownerKind,
		})
	}

	// Sort by severity then by CPU saturation descending (CPU is the most common tab).
	sort.Slice(pods, func(i, j int) bool {
		severityOrder := map[string]int{"Critical": 0, "Warning": 1, "Healthy": 2}
		if severityOrder[pods[i].Status] != severityOrder[pods[j].Status] {
			return severityOrder[pods[i].Status] < severityOrder[pods[j].Status]
		}
		iSat := 0.0
		jSat := 0.0
		if pods[i].Metrics.CpuLimit > 0 {
			iSat = pods[i].Metrics.CpuUsage / pods[i].Metrics.CpuLimit
		}
		if pods[j].Metrics.CpuLimit > 0 {
			jSat = pods[j].Metrics.CpuUsage / pods[j].Metrics.CpuLimit
		}
		return iSat > jSat
	})

	// Cap healthy pods.
	var result []PodSaturation
	healthyCount := 0
	for _, p := range pods {
		if p.Status == "Healthy" {
			if healthyCount >= maxHealthy {
				continue
			}
			healthyCount++
		}
		result = append(result, p)
	}
	return result, maxMetrics, len(matched)
}

// queryPodResourceP99 returns a map of pod name -> P99 usage over the given window.
// It is best-effort: if Prometheus is unavailable or the query fails, it returns nil.
// For CPU, the P99 is computed over per-pod rate samples. For memory, it is computed
// over raw working-set bytes.
func queryPodResourceP99(ctx context.Context, namespace, name, resource, window string) map[string]float64 {
	if prometheus.GlobalClient == nil {
		return nil
	}

	var query string
	switch resource {
	case "cpu":
		// Subquery: evaluate rate every 1m over the window, then take the 99th percentile per pod.
		query = fmt.Sprintf(`quantile_over_time(0.99, rate(container_cpu_usage_seconds_total{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$", container!=""}[2m])[%s:1m])`, namespace, name, window)
	case "memory":
		query = fmt.Sprintf(`quantile_over_time(0.99, container_memory_working_set_bytes{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$", container!=""}[%s])`, namespace, name, window)
	default:
		return nil
	}

	result, err := prometheus.GlobalClient.QueryVectorRaw(ctx, query)
	if err != nil {
		return nil
	}
	vector, ok := result.(model.Vector)
	if !ok {
		return nil
	}

	out := make(map[string]float64, len(vector))
	for _, s := range vector {
		podName := string(s.Metric["pod"])
		if podName != "" {
			out[podName] = float64(s.Value)
		}
	}
	return out
}

// fetchEphemeralStorageFromKubelet queries each node's kubelet stats/summary
// endpoint to get per-pod ephemeral storage usage. This is required because
// the Kubernetes Metrics API (metrics.k8s.io) does not expose storage metrics.
func fetchEphemeralStorageFromKubelet(ctx context.Context, client *kubernetes.Clientset, namespace string, matchLabels map[string]string) float64 {
	pods, err := client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labels.Set(matchLabels).String(),
	})
	if err != nil || len(pods.Items) == 0 {
		return 0
	}

	targetPods := make(map[string]bool)
	nodesToQuery := make(map[string]bool)
	for _, pod := range pods.Items {
		targetPods[pod.Name] = true
		if pod.Spec.NodeName != "" {
			nodesToQuery[pod.Spec.NodeName] = true
		}
	}

	var total float64
	for node := range nodesToQuery {
		data, err := client.CoreV1().RESTClient().Get().AbsPath("api", "v1", "nodes", node, "proxy", "stats", "summary").Do(ctx).Raw()
		if err != nil {
			continue
		}

		var summary map[string]interface{}
		if err := json.Unmarshal(data, &summary); err != nil {
			continue
		}

		podsList, ok := summary["pods"].([]interface{})
		if !ok {
			continue
		}

		for _, p := range podsList {
			podMap, ok := p.(map[string]interface{})
			if !ok {
				continue
			}

			podRef, ok := podMap["podRef"].(map[string]interface{})
			if !ok {
				continue
			}

			podName, _ := podRef["name"].(string)
			podNS, _ := podRef["namespace"].(string)

			if podNS != namespace || !targetPods[podName] {
				continue
			}

			ephemeral, ok := podMap["ephemeral-storage"].(map[string]interface{})
			if !ok {
				continue
			}

			if usedBytes, ok := ephemeral["usedBytes"].(float64); ok {
				total += usedBytes
			}
		}
	}

	return total / (1024 * 1024 * 1024) // GiB
}

func fetchRecentLogs(ctx context.Context, client *kubernetes.Clientset, namespace string, matchLabels map[string]string, pods []corev1.Pod) []string {
	if len(matchLabels) == 0 && len(pods) == 0 {
		return []string{}
	}

	if pods == nil {
		listOpts := metav1.ListOptions{
			LabelSelector: labels.Set(matchLabels).String(),
			Limit:         10,
		}
		podList, err := client.CoreV1().Pods(namespace).List(ctx, listOpts)
		if err != nil || len(podList.Items) == 0 {
			return []string{}
		}
		pods = podList.Items
	}

	var matchingPods []corev1.Pod
	if len(matchLabels) > 0 {
		selector := labels.SelectorFromSet(labels.Set(matchLabels))
		for _, p := range pods {
			if p.Namespace == namespace && selector.Matches(labels.Set(p.Labels)) {
				matchingPods = append(matchingPods, p)
			}
		}
	} else {
		matchingPods = pods
	}
	if len(matchingPods) == 0 {
		return []string{}
	}

	tailLines := int64(20)

	// Try pods in order, preferring Running pods. For CrashLoopBackOff, also try previous container logs.
	for _, pod := range matchingPods {
		podName := pod.Name
		isRunning := pod.Status.Phase == corev1.PodRunning && len(pod.Status.ContainerStatuses) > 0 && pod.Status.ContainerStatuses[0].Ready

		tryLogs := func(previous bool) []string {
			req := client.CoreV1().Pods(namespace).GetLogs(podName, &v1.PodLogOptions{
				TailLines: &tailLines,
				Previous:  previous,
			})
			podLogs, err := req.Stream(ctx)
			if err != nil {
				return nil
			}
			defer podLogs.Close()

			buf := new(bytes.Buffer)
			if _, err = io.Copy(buf, podLogs); err != nil {
				return nil
			}

			lines := strings.Split(buf.String(), "\n")
			var result []string
			for _, l := range lines {
				if strings.TrimSpace(l) != "" {
					result = append(result, l)
				}
			}
			if len(result) > 0 {
				return result
			}
			return nil
		}

		if isRunning {
			if logs := tryLogs(false); logs != nil {
				return logs
			}
		} else {
			// For non-running / crashlooping pods, current logs might be empty; prefer previous container logs.
			if logs := tryLogs(true); logs != nil {
				return logs
			}
			if logs := tryLogs(false); logs != nil {
				return logs
			}
		}
	}

	return []string{}
}

func fetchPodNames(ctx context.Context, client *kubernetes.Clientset, namespace string, matchLabels map[string]string, pods []corev1.Pod) []string {
	if len(matchLabels) == 0 {
		return []string{}
	}

	if pods == nil {
		listOpts := metav1.ListOptions{
			LabelSelector: labels.Set(matchLabels).String(),
			Limit:         50, // Limit to prevent huge lists
		}
		var err error
		podList, err := client.CoreV1().Pods(namespace).List(ctx, listOpts)
		if err != nil {
			return []string{}
		}
		pods = podList.Items
	}

	selector := labels.SelectorFromSet(labels.Set(matchLabels))
	var names []string
	for _, p := range pods {
		if p.Namespace == namespace && selector.Matches(labels.Set(p.Labels)) {
			names = append(names, p.Name)
		}
	}
	return names
}

func fetchRecentEvents(ctx context.Context, client *kubernetes.Clientset, namespace, name, kind string, events []corev1.Event) []K8sEvent {
	if events == nil {
		// Query events involving this object
		// We use field selectors to match involvedObject.name and involvedObject.kind
		selector := fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=%s", name, kind)

		eventList, err := client.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{
			FieldSelector: selector,
			Limit:         10,
		})
		if err != nil {
			return []K8sEvent{}
		}
		events = eventList.Items
	}

	var result []K8sEvent
	count := 0
	for _, e := range events {
		if e.Namespace != namespace {
			continue
		}
		if e.InvolvedObject.Name != name || e.InvolvedObject.Kind != kind {
			continue
		}
		result = append(result, K8sEvent{
			ID:       string(e.UID),
			Type:     e.Type,
			Reason:   e.Reason,
			Message:  e.Message,
			LastSeen: e.LastTimestamp.Format("15:04:05"),
		})
		count++
		if count >= 10 {
			break
		}
	}
	// Ensure we never return nil
	if result == nil {
		return []K8sEvent{}
	}
	return result
}

// Global cache for Karpenter Pod Name to avoid listing every time
var karpenterPodCache string
var karpenterCacheTime time.Time

func fetchKarpenterLogs(ctx context.Context, client *kubernetes.Clientset, workloadName string) []string {
	// Only refresh cache every minute
	if time.Since(karpenterCacheTime) > time.Minute || karpenterPodCache == "" {
		// Try to find Karpenter
		nsList := []string{"karpenter", "kube-system"}
		found := false
		for _, ns := range nsList {
			pods, err := client.CoreV1().Pods(ns).List(ctx, metav1.ListOptions{
				LabelSelector: "app.kubernetes.io/name=karpenter",
				Limit:         1,
			})
			if err == nil && len(pods.Items) > 0 {
				karpenterPodCache = fmt.Sprintf("%s/%s", ns, pods.Items[0].Name)
				karpenterCacheTime = time.Now()
				found = true
				break
			}
		}
		if !found {
			karpenterPodCache = "none" // mark as checked
			karpenterCacheTime = time.Now()
		}
	}

	if karpenterPodCache == "none" || karpenterPodCache == "" {
		return []string{}
	}

	parts := strings.Split(karpenterPodCache, "/")
	if len(parts) != 2 {
		return []string{}
	}
	ns, name := parts[0], parts[1]

	// Fetch logs
	tailLines := int64(50)
	req := client.CoreV1().Pods(ns).GetLogs(name, &v1.PodLogOptions{
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

	allLogs := strings.Split(buf.String(), "\n")

	// Filtering: We only want logs relevant to this workload if possible,
	// OR generic errors. For now, return recent controller logs as "System Context".
	// Ideally we grep for `workloadName` but Karpenter logs might reference the POD name, not the workload name.
	// Since we don't easily have the pending pod name here (we are iterating workloads, not pods),
	// we'll return the raw tail for the AI to parse.
	var result []string
	for _, l := range allLogs {
		if strings.TrimSpace(l) != "" {
			result = append(result, l)
		}
	}
	return result
}

func fetchKarpenterProvisioning(ctx context.Context, dynClient dynamic.Interface, workloadName string) *ProvisioningInfo {
	info := &ProvisioningInfo{
		Enabled: false,
	}

	if dynClient == nil {
		return info
	}

	// 1. Check for Karpenter NodePools
	gvrNP := schema.GroupVersionResource{Group: "karpenter.sh", Version: "v1beta1", Resource: "nodepools"}
	nps, err := dynClient.Resource(gvrNP).List(ctx, metav1.ListOptions{})
	if err != nil {
		// Fallback to older Provisioner
		gvrProv := schema.GroupVersionResource{Group: "karpenter.sh", Version: "v1alpha5", Resource: "provisioners"}
		nps, err = dynClient.Resource(gvrProv).List(ctx, metav1.ListOptions{})
	}

	if err == nil && len(nps.Items) > 0 {
		info.Enabled = true
		for _, np := range nps.Items {
			info.NodePools = append(info.NodePools, np.GetName())

			// Basic Misconfiguration Check for NodePools
			spec, _ := np.Object["spec"].(map[string]interface{})
			if spec != nil {
				template, _ := spec["template"].(map[string]interface{})
				if template != nil {
					tSpec, _ := template["spec"].(map[string]interface{})
					if tSpec != nil {
						requirements, _ := tSpec["requirements"].([]interface{})
						if len(requirements) == 0 {
							info.Misconfigurations = append(info.Misconfigurations, fmt.Sprintf("NodePool %s has no requirements defined (may scale too broadly)", np.GetName()))
						}
					}
				}
			}
		}
	}

	// 2. Check for NodeClaims (Pending or Drifted)
	gvrNC := schema.GroupVersionResource{Group: "karpenter.sh", Version: "v1beta1", Resource: "nodeclaims"}
	ncs, err := dynClient.Resource(gvrNC).List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, nc := range ncs.Items {
			status, _ := nc.Object["status"].(map[string]interface{})
			if status != nil {
				conditions, _ := status["conditions"].([]interface{})
				isReady := false
				isDrifted := false
				for _, c := range conditions {
					if cMap, ok := c.(map[string]interface{}); ok {
						if cMap["type"] == "Ready" && cMap["status"] == "True" {
							isReady = true
						}
						if cMap["type"] == "Drifted" && cMap["status"] == "True" {
							isDrifted = true
						}
					}
				}
				if !isReady {
					info.NodeClaims = append(info.NodeClaims, nc.GetName()+" (Pending)")
				}
				if isDrifted {
					info.Misconfigurations = append(info.Misconfigurations, fmt.Sprintf("NodeClaim %s is drifted and needs replacement", nc.GetName()))
				}
			}
		}
	}

	return info
}

func analyzeScheduling(events []K8sEvent, spec v1.PodSpec, prov *ProvisioningInfo) string {
	// 1. Check if Karpenter is actively doing something
	if prov != nil && len(prov.NodeClaims) > 0 {
		// If ANY NodeClaim is pending, we assume cluster is scaling up
		for _, nc := range prov.NodeClaims {
			if strings.Contains(nc, "Pending") {
				return "Provisioning Nodes"
			}
		}
	}

	// 2. Check Events for why we are pending
	for _, e := range events {
		if e.Reason == "FailedScheduling" {
			msg := strings.ToLower(e.Message)

			// Resource Constraints
			if strings.Contains(msg, "insufficient") {
				return "Waiting for Resources"
			}

			// Taints & Tolerations
			if strings.Contains(msg, "taint") && strings.Contains(msg, "not tolerated") {
				if prov != nil {
					prov.Misconfigurations = append(prov.Misconfigurations, fmt.Sprintf("Scheduling Failed: Pod does not tolerate node taints. (Event: %s)", e.Message))
				}
				// Check which tolerations are missing?
				// Simple heuristic: If no tolerations, suggest adding them.
				if len(spec.Tolerations) == 0 && prov != nil {
					prov.Misconfigurations = append(prov.Misconfigurations, "Hint: Pod has NO tolerations defined.")
				}
				return "Blocked: Taints"
			}

			// Affinity
			if strings.Contains(msg, "affinity") || strings.Contains(msg, "anti-affinity") {
				if prov != nil {
					prov.Misconfigurations = append(prov.Misconfigurations, fmt.Sprintf("Scheduling Failed: Affinity rules not satisfied. (Event: %s)", e.Message))
				}
				return "Blocked: Affinity"
			}

			// Node Selector
			if strings.Contains(msg, "node(s) didn't match pod's node affinity/selector") || strings.Contains(msg, "node selector") {
				if prov != nil {
					prov.Misconfigurations = append(prov.Misconfigurations, fmt.Sprintf("Scheduling Failed: Node Selector/Affinity mismatch. (Event: %s)", e.Message))
				}
				return "Blocked: Node Selector"
			}

			return "Unscheduled"
		}
		if e.Reason == "TriggeredScaleUp" {
			return "Scaling Up"
		}
	}
	return ""
}

// Helper to fetch KEDA ScaledObject
func fetchKedaScaling(ctx context.Context, dynClient dynamic.Interface, namespace, workloadName string, scaledObjects []unstructured.Unstructured) ScalingInfo {
	info := ScalingInfo{
		Enabled: false,
		Min:     0,
		Max:     0,
		Current: 0,
	}

	if dynClient == nil {
		return info
	}

	if scaledObjects == nil {
		gvr := schema.GroupVersionResource{
			Group:    "keda.sh",
			Version:  "v1alpha1",
			Resource: "scaledobjects",
		}
		sos, err := dynClient.Resource(gvr).Namespace(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return info
		}
		scaledObjects = sos.Items
	}

	for _, item := range scaledObjects {
		spec, ok := item.Object["spec"].(map[string]interface{})
		if !ok {
			continue
		}
		target, ok := spec["scaleTargetRef"].(map[string]interface{})
		if !ok {
			continue
		}

		targetName, _ := target["name"].(string)
		if targetName == workloadName {
			info.Enabled = true
			if min, ok := spec["minReplicaCount"].(int64); ok {
				info.Min = int32(min)
			}
			if max, ok := spec["maxReplicaCount"].(int64); ok {
				info.Max = int32(max)
			}

			// Extract triggers
			var triggers []string
			if trigs, ok := spec["triggers"].([]interface{}); ok {
				for _, t := range trigs {
					if tMap, ok := t.(map[string]interface{}); ok {
						if typeStr, ok := tMap["type"].(string); ok {
							triggers = append(triggers, typeStr)
						}
					}
				}
			}

			// Current replica count from KEDA status
			if status, ok := item.Object["status"].(map[string]interface{}); ok {
				if rc, ok := status["replicaCount"].(int64); ok {
					info.Current = int32(rc)
				} else if rc, ok := status["replicaCount"].(float64); ok {
					info.Current = int32(rc)
				}
			}

			// Check Status & Conditions
			if status, ok := item.Object["status"].(map[string]interface{}); ok {

				if conditions, ok := status["conditions"].([]interface{}); ok {
					for _, c := range conditions {
						if cMap, ok := c.(map[string]interface{}); ok {
							cType := cMap["type"]
							cStatus := cMap["status"]
							cReason, _ := cMap["reason"].(string)
							cMsg, _ := cMap["message"].(string)

							switch cType {
							case "Ready":
								if cStatus == "True" {
									info.KedaReady = true
								} else {
									info.Misconfigurations = append(info.Misconfigurations, fmt.Sprintf("KEDA Not Ready: %s (%s)", cReason, cMsg))
								}
							case "Active":
								info.Active = (cStatus == "True")
							case "Fallback":
								info.Fallback = (cStatus == "True")
								if info.Fallback {
									info.Misconfigurations = append(info.Misconfigurations, "KEDA is in Fallback mode (triggers failing)")
								}
							case "Paused":
								info.Paused = (cStatus == "True")
								if info.Paused {
									info.Misconfigurations = append(info.Misconfigurations, "KEDA Scaling is Paused")
								}
							}
						}
					}
				}
			}

			info.Config = &KedaConfig{
				Name:     item.GetName(),
				Triggers: triggers,
			}
			break
		}
	}

	return info
}

// Helper to fetch standard HorizontalPodAutoscaler
func fetchHPAScaling(ctx context.Context, client *kubernetes.Clientset, namespace, workloadName string, hpas []autoscalingv2.HorizontalPodAutoscaler) ScalingInfo {
	info := ScalingInfo{
		Enabled: false,
		Min:     0,
		Max:     0,
		Current: 0,
	}

	if client == nil {
		return info
	}

	if hpas == nil {
		hpaList, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			return info
		}
		hpas = hpaList.Items
	}

	for _, hpa := range hpas {
		if hpa.Spec.ScaleTargetRef.Name == workloadName {
			info.Enabled = true
			if hpa.Spec.MinReplicas != nil {
				info.Min = *hpa.Spec.MinReplicas
			}
			info.Max = hpa.Spec.MaxReplicas
			info.Current = hpa.Status.CurrentReplicas

			// Extract triggers (metrics)
			var triggers []string
			for _, m := range hpa.Spec.Metrics {
				triggers = append(triggers, string(m.Type))
			}

			// Check Conditions
			for _, cond := range hpa.Status.Conditions {
				switch cond.Type {
				case autoscalingv2.ScalingActive:
					if cond.Status == corev1.ConditionTrue {
						info.KedaReady = true
						info.Active = true
					} else {
						info.Misconfigurations = append(info.Misconfigurations, fmt.Sprintf("HPA Scaling Not Active: %s (%s)", cond.Reason, cond.Message))
					}
				case autoscalingv2.AbleToScale:
					if cond.Status != corev1.ConditionTrue {
						info.Misconfigurations = append(info.Misconfigurations, fmt.Sprintf("HPA Unable to Scale: %s (%s)", cond.Reason, cond.Message))
					}
				case autoscalingv2.ScalingLimited:
					if cond.Status == corev1.ConditionTrue {
						info.Misconfigurations = append(info.Misconfigurations, fmt.Sprintf("HPA Scaling Limited: %s (%s)", cond.Reason, cond.Message))
					}
				}
			}

			// Check for being stuck at max
			if info.Current >= info.Max && info.Max > 0 {
				info.Misconfigurations = append(info.Misconfigurations, "HPA is at Max Replicas (Saturation Risk)")
			}

			info.Config = &KedaConfig{
				Name:     hpa.Name,
				Triggers: triggers,
			}
			break
		}
	}

	return info
}

type ClusterResponse struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Provider    string `json:"provider"`
	Status      string `json:"status"`
}

func getScalingInfo(ctx context.Context, client *kubernetes.Clientset, dynClient dynamic.Interface, namespace, name string, hpas []autoscalingv2.HorizontalPodAutoscaler, scaledObjects []unstructured.Unstructured) ScalingInfo {
	keda := fetchKedaScaling(ctx, dynClient, namespace, name, scaledObjects)
	hpa := fetchHPAScaling(ctx, client, namespace, name, hpas)

	if !keda.Enabled && !hpa.Enabled {
		return ScalingInfo{Enabled: false}
	}

	// Merge logic: KEDA usually wins if enabled, but HPA might have more real-time status
	// from the HPA controller itself.
	res := hpa
	if keda.Enabled {
		res.Enabled = true
		// KEDA is the authoritative scaler when present; use its replica bounds and current count.
		if keda.Max > 0 {
			res.Min = keda.Min
			res.Max = keda.Max
			res.Current = keda.Current
		}
		res.KedaReady = keda.KedaReady
		res.Fallback = keda.Fallback
		res.Paused = keda.Paused
		if res.Config == nil {
			res.Config = keda.Config
		} else if keda.Config != nil {
			// Merge triggers, avoid duplicates
			triggerMap := make(map[string]bool)
			for _, t := range res.Config.Triggers {
				triggerMap[t] = true
			}
			for _, t := range keda.Config.Triggers {
				if !triggerMap[t] {
					res.Config.Triggers = append(res.Config.Triggers, t)
				}
			}
		}
		// Merge misconfigurations
		res.Misconfigurations = append(res.Misconfigurations, keda.Misconfigurations...)
	}

	return res
}

func calculateRecommendation(metrics ResourceMetrics) *Recommendation {
	// Simple Heuristic Logic for MVP
	// If Usage < 30% of Request -> DOWNSIZE
	// If Usage > 85% of Limit -> UPSIZE

	// CPU
	cpuUtil := 0.0
	if metrics.CpuRequest > 0 {
		cpuUtil = metrics.CpuUsage / metrics.CpuRequest
	} else if metrics.CpuLimit > 0 {
		cpuUtil = metrics.CpuUsage / metrics.CpuLimit
	}

	// Memory
	memUtil := 0.0
	if metrics.MemoryRequest > 0 {
		memUtil = metrics.MemoryUsage / metrics.MemoryRequest
	} else if metrics.MemoryLimit > 0 {
		memUtil = metrics.MemoryUsage / metrics.MemoryLimit
	}

	// Logic
	if (cpuUtil > 0.85 || memUtil > 0.85) && (metrics.CpuUsage > 0 || metrics.MemoryUsage > 0) {
		return &Recommendation{
			Action:     "Upsize",
			Confidence: 90,
			Reason:     fmt.Sprintf("High utilization detected (CPU: %.0f%%, Mem: %.0f%%). Risk of throttle/OOM.", cpuUtil*100, memUtil*100),
		}
	}

	if (cpuUtil > 0 && cpuUtil < 0.30) && (memUtil > 0 && memUtil < 0.30) {
		return &Recommendation{
			Action:     "Downsize",
			Confidence: 75,
			Reason:     fmt.Sprintf("Low utilization (CPU: %.0f%%, Mem: %.0f%%). Resources are over-provisioned.", cpuUtil*100, memUtil*100),
		}
	}

	return &Recommendation{
		Action:     "None",
		Confidence: 100,
		Reason:     "Workload is right-sized.",
	}
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

		// Use display name if set, otherwise fall back to cluster name
		displayName := cls.DisplayName
		if displayName == "" {
			displayName = cls.Name
		}

		response = append(response, ClusterResponse{
			ID:          cls.ID,
			Name:        cls.Name,
			DisplayName: displayName,
			Provider:    provider,
			Status:      "Active", // Mock status for now
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
	window := c.Query("window")
	if window == "" {
		window = "1h"
	}
	var client *kubernetes.Clientset

	// VPN MODE: Connect to selected cluster on-demand
	if clusterID != "" && k8s.Manager != nil {
		cls, err := k8s.Manager.GetOrConnectCluster(clusterID)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":   fmt.Sprintf("Cannot connect to cluster: %v", err),
				"message": "Cluster may be behind a VPN. Please connect to the VPN and try again.",
			})
			return
		}
		client = cls.ClientSet
	} else {
		// Fallback to default
		client = k8s.ClientSet
	}

	// Get Dynamic Client (safely)
	var dynClient dynamic.Interface
	if clusterID != "" && k8s.Manager != nil {
		// GetOrConnectCluster already connected above, just get the cluster
		if cls, err := k8s.Manager.GetCluster(clusterID); err == nil {
			dynClient = cls.DynamicClient
		}
	} else if k8s.GlobalManager != nil && len(k8s.GlobalManager.ListClusters()) > 0 {
		// Default fallback - try to connect to first available cluster
		firstCluster := k8s.GlobalManager.ListClusters()[0]
		if connected, _ := k8s.Manager.GetOrConnectCluster(firstCluster.ID); connected != nil {
			dynClient = connected.DynamicClient
		}
	}

	if client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Kubernetes client not available",
			"message": "Please select a cluster and ensure VPN connection if required.",
		})
		return
	}

	// Determine target namespace
	targetNamespace := ""
	if clusterID != "" && k8s.Manager != nil {
		if cls, err := k8s.Manager.GetCluster(clusterID); err == nil {
			targetNamespace = cls.Namespace
		}
	}

	// If the context defaults to "default" namespace but the user likely wants to see everything
	// (common in simple kubeconfigs), treating it as "" (all) is safer than showing nothing.
	// Users can filter by namespace in the frontend if needed.
	if targetNamespace == "default" {
		targetNamespace = ""
	}

	// For Platform Console, we usually want to see all workloads across all namespaces
	// unless specifically filtered (future feature). For now, let's force "" to see everything.
	targetNamespace = ""

	log.Printf("WorkloadsHandler: Fetching workloads for cluster %s in namespace '%s'", clusterID, targetNamespace)

	// Step 1: Check Cache
	cacheKey := fmt.Sprintf("workloads:%s", clusterID)
	if val, err := cache.Get(c.Request.Context(), cacheKey); err == nil {
		c.Header("X-Cache", "HIT")
		c.Data(http.StatusOK, "application/json", []byte(val))
		return
	}

	// Pre-fetch shared resources once per namespace to avoid hundreds of redundant API calls
	// (and client-side throttling) when enriching every workload.
	var allPods []corev1.Pod
	var allEvents []corev1.Event
	var allHPAs []autoscalingv2.HorizontalPodAutoscaler
	var allScaledObjects []unstructured.Unstructured
	var allPodMetrics map[string]metricsv1beta1.PodMetrics
	var cpuThrottleByPod map[string]float64

	prefetchCtx, prefetchCancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer prefetchCancel()

	var prefetchWg sync.WaitGroup
	prefetchWg.Add(6)
	go func() {
		defer prefetchWg.Done()
		if eventList, err := client.CoreV1().Events(targetNamespace).List(prefetchCtx, metav1.ListOptions{}); err == nil {
			allEvents = eventList.Items
		}
	}()
	go func() {
		defer prefetchWg.Done()
		if hpaList, err := client.AutoscalingV2().HorizontalPodAutoscalers(targetNamespace).List(prefetchCtx, metav1.ListOptions{}); err == nil {
			allHPAs = hpaList.Items
		}
	}()
	go func() {
		defer prefetchWg.Done()
		if dynClient != nil {
			gvrSOS := schema.GroupVersionResource{Group: "keda.sh", Version: "v1alpha1", Resource: "scaledobjects"}
			if soList, err := dynClient.Resource(gvrSOS).Namespace(targetNamespace).List(prefetchCtx, metav1.ListOptions{}); err == nil {
				allScaledObjects = soList.Items
			}
		}
	}()
	go func() {
		defer prefetchWg.Done()
		if podList, err := client.CoreV1().Pods(targetNamespace).List(prefetchCtx, metav1.ListOptions{}); err == nil {
			allPods = podList.Items
		}
	}()
	go func() {
		defer prefetchWg.Done()
		if clusterID != "" {
			mgr := k8s.GetClusterManager()
			if mgr != nil {
				if cls, err := mgr.GetOrConnectCluster(clusterID); err == nil && cls != nil && cls.MetricsClient != nil {
					if list, err := cls.MetricsClient.MetricsV1beta1().PodMetricses(targetNamespace).List(prefetchCtx, metav1.ListOptions{}); err == nil {
						allPodMetrics = make(map[string]metricsv1beta1.PodMetrics, len(list.Items))
						for _, pm := range list.Items {
							allPodMetrics[pm.Name] = pm
						}
					}
				}
			}
		}
	}()
	go func() {
		defer prefetchWg.Done()
		cpuThrottleByPod = queryPodCPUThrottling(prefetchCtx, targetNamespace)
	}()
	prefetchWg.Wait()

	// Use errgroup for concurrency
	g, ctx := errgroup.WithContext(c.Request.Context())
	g.SetLimit(12) // Concurrent enrichment limit

	var mu sync.Mutex
	var workloads []Workload

	// Helper to safely append
	addWorkload := func(w Workload) {
		mu.Lock()
		workloads = append(workloads, w)
		mu.Unlock()
	}

	// Deployments
	if deps, err := client.AppsV1().Deployments(targetNamespace).List(ctx, metav1.ListOptions{}); err == nil {
		for _, d := range deps.Items {
			d := d // capture loop var
			g.Go(func() error {
				enrichCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
				defer cancel()
				status := getStatus(d.Status.AvailableReplicas, *d.Spec.Replicas)
				metrics := getRealMetrics(enrichCtx, clusterID, d.Namespace, d.Name, "Deployment", d.Spec.Template.Spec, window, d.Spec.Selector.MatchLabels, *d.Spec.Replicas)
				pods, maxPodMetrics, podCount := buildPodSaturationList(enrichCtx, clusterID, d.Namespace, d.Name, "Deployment", d.Spec.Selector.MatchLabels, allPods, d.Spec.Template.Spec, allPodMetrics, cpuThrottleByPod, 3)
				metrics.CpuMaxPodUsage = maxPodMetrics.CpuMaxPodUsage
				metrics.MemoryMaxPodUsage = maxPodMetrics.MemoryMaxPodUsage
				metrics.StorageMaxPodUsage = maxPodMetrics.StorageMaxPodUsage
				metrics.GpuMaxPodUsage = maxPodMetrics.GpuMaxPodUsage
				w := Workload{
					ID:                string(d.UID),
					ClusterID:         clusterID,
					Name:              d.Name,
					Namespace:         d.Namespace,
					Kind:              "Deployment",
					Replicas:          *d.Spec.Replicas,
					AvailableReplicas: d.Status.AvailableReplicas,
					PodCount:          int32(podCount),
					Status:            status,
					CostPerMonth:      rand.Intn(500) + 50,
					Metrics:           metrics,
					Events:            fetchRecentEvents(enrichCtx, client, d.Namespace, d.Name, "Deployment", allEvents),
					Scaling:           getScalingInfo(enrichCtx, client, dynClient, d.Namespace, d.Name, allHPAs, allScaledObjects),
					Pods:              pods,
				}
				if status != "Healthy" {
					w.SchedulerLogs = fetchKarpenterLogs(enrichCtx, client, d.Name)
					w.Provisioning = fetchKarpenterProvisioning(enrichCtx, dynClient, d.Name)
					w.ProvisioningStatus = analyzeScheduling(w.Events, d.Spec.Template.Spec, w.Provisioning)
				}
				w.Recommendation = calculateRecommendation(w.Metrics)
				addWorkload(w)
				return nil
			})
		}
	}

	// StatefulSets
	if sts, err := client.AppsV1().StatefulSets(targetNamespace).List(ctx, metav1.ListOptions{}); err == nil {
		for _, s := range sts.Items {
			s := s // capture loop var
			g.Go(func() error {
				enrichCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
				defer cancel()
				status := getStatus(s.Status.ReadyReplicas, *s.Spec.Replicas)
				metrics := getRealMetrics(enrichCtx, clusterID, s.Namespace, s.Name, "StatefulSet", s.Spec.Template.Spec, window, s.Spec.Selector.MatchLabels, *s.Spec.Replicas)
				pods, maxPodMetrics, podCount := buildPodSaturationList(enrichCtx, clusterID, s.Namespace, s.Name, "StatefulSet", s.Spec.Selector.MatchLabels, allPods, s.Spec.Template.Spec, allPodMetrics, cpuThrottleByPod, 3)
				metrics.CpuMaxPodUsage = maxPodMetrics.CpuMaxPodUsage
				metrics.MemoryMaxPodUsage = maxPodMetrics.MemoryMaxPodUsage
				metrics.StorageMaxPodUsage = maxPodMetrics.StorageMaxPodUsage
				metrics.GpuMaxPodUsage = maxPodMetrics.GpuMaxPodUsage
				w := Workload{
					ID:                string(s.UID),
					ClusterID:         clusterID,
					Name:              s.Name,
					Namespace:         s.Namespace,
					Kind:              "StatefulSet",
					Replicas:          *s.Spec.Replicas,
					AvailableReplicas: s.Status.ReadyReplicas,
					PodCount:          int32(podCount),
					Status:            status,
					CostPerMonth:      rand.Intn(500) + 100,
					Metrics:           metrics,
					Events:            fetchRecentEvents(enrichCtx, client, s.Namespace, s.Name, "StatefulSet", allEvents),
					Scaling:           getScalingInfo(enrichCtx, client, dynClient, s.Namespace, s.Name, allHPAs, allScaledObjects),
					Pods:              pods,
				}
				if status != "Healthy" {
					w.SchedulerLogs = fetchKarpenterLogs(enrichCtx, client, s.Name)
					w.Provisioning = fetchKarpenterProvisioning(enrichCtx, dynClient, s.Name)
					w.ProvisioningStatus = analyzeScheduling(w.Events, s.Spec.Template.Spec, w.Provisioning)
				}
				w.Recommendation = calculateRecommendation(w.Metrics)
				addWorkload(w)
				return nil
			})
		}
	}

	// DaemonSets
	if dss, err := client.AppsV1().DaemonSets(targetNamespace).List(ctx, metav1.ListOptions{}); err == nil {
		for _, ds := range dss.Items {
			ds := ds // capture loop var
			g.Go(func() error {
				enrichCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
				defer cancel()
				status := getStatus(ds.Status.NumberReady, ds.Status.DesiredNumberScheduled)
				metrics := getRealMetrics(enrichCtx, clusterID, ds.Namespace, ds.Name, "DaemonSet", ds.Spec.Template.Spec, window, ds.Spec.Selector.MatchLabels, ds.Status.DesiredNumberScheduled)
				pods, maxPodMetrics, podCount := buildPodSaturationList(enrichCtx, clusterID, ds.Namespace, ds.Name, "DaemonSet", ds.Spec.Selector.MatchLabels, allPods, ds.Spec.Template.Spec, allPodMetrics, cpuThrottleByPod, 3)
				metrics.CpuMaxPodUsage = maxPodMetrics.CpuMaxPodUsage
				metrics.MemoryMaxPodUsage = maxPodMetrics.MemoryMaxPodUsage
				metrics.StorageMaxPodUsage = maxPodMetrics.StorageMaxPodUsage
				metrics.GpuMaxPodUsage = maxPodMetrics.GpuMaxPodUsage
				w := Workload{
					ID:                string(ds.UID),
					ClusterID:         clusterID,
					Name:              ds.Name,
					Namespace:         ds.Namespace,
					Kind:              "DaemonSet",
					Replicas:          ds.Status.DesiredNumberScheduled,
					AvailableReplicas: ds.Status.NumberReady,
					PodCount:          int32(podCount),
					Status:            status,
					CostPerMonth:      rand.Intn(200) + 50,
					Metrics:           metrics,
					Events:            fetchRecentEvents(enrichCtx, client, ds.Namespace, ds.Name, "DaemonSet", allEvents),
					Scaling:           getScalingInfo(enrichCtx, client, dynClient, ds.Namespace, ds.Name, allHPAs, allScaledObjects),
					Pods:              pods,
				}
				if status != "Healthy" {
					// DaemonSets usually don't use Karpenter provisioning like Deployments do
					// But we can still analyze scheduling issues
					w.Provisioning = &ProvisioningInfo{Enabled: false} // Placeholder
					w.ProvisioningStatus = analyzeScheduling(w.Events, ds.Spec.Template.Spec, w.Provisioning)
				}
				w.Recommendation = calculateRecommendation(w.Metrics)
				addWorkload(w)
				return nil
			})
		}
	}

	// ScaledJobs (KEDA)
	if dynClient != nil {
		gvrSJ := schema.GroupVersionResource{Group: "keda.sh", Version: "v1alpha1", Resource: "scaledjobs"}
		sjs, _ := dynClient.Resource(gvrSJ).Namespace(targetNamespace).List(ctx, metav1.ListOptions{})

		if sjs != nil && len(sjs.Items) > 0 {
			// Pre-fetch lists once
			jobsList, _ := client.BatchV1().Jobs(targetNamespace).List(ctx, metav1.ListOptions{})
			podsList, _ := client.CoreV1().Pods(targetNamespace).List(ctx, metav1.ListOptions{})

			jobsItems := jobsList.Items
			podsItems := podsList.Items

			for _, item := range sjs.Items {
				item := item
				g.Go(func() error {
					name := item.GetName()
					namespace := item.GetNamespace()
					uid := item.GetUID()

					active := int32(0)
					statusUnready := false
					if status, ok := item.Object["status"].(map[string]interface{}); ok {
						if act, ok := status["active"].(int64); ok {
							active = int32(act)
						}
						if conditions, ok := status["conditions"].([]interface{}); ok {
							for _, c := range conditions {
								if cMap, ok := c.(map[string]interface{}); ok {
									if cMap["type"] == "Ready" && cMap["status"] == "False" {
										statusUnready = true
									}
								}
							}
						}
					}

					childCount := 0
					running := 0
					pending := 0
					failed := 0
					var relevantPods []corev1.Pod

					var myJobUIDs []string
					for _, j := range jobsItems {
						for _, o := range j.OwnerReferences {
							if o.UID == uid {
								myJobUIDs = append(myJobUIDs, string(j.UID))
								break
							}
						}
					}

					for _, p := range podsItems {
						for _, o := range p.OwnerReferences {
							for _, juid := range myJobUIDs {
								if string(o.UID) == juid {
									relevantPods = append(relevantPods, p)
									childCount++
									switch p.Status.Phase {
									case v1.PodRunning:
										running++
									case v1.PodPending:
										pending++
									case v1.PodFailed:
										failed++
									}
									break
								}
							}
						}
					}

					status := "Healthy"
					if statusUnready {
						status = "Warning"
					} else if failed > 0 {
						status = "Critical"
					} else if pending > 0 {
						status = "Warning"
					}

					enrichCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
					defer cancel()

					var recentLogs []string
					var recentEvents []K8sEvent
					var jobLabels map[string]string

					if len(relevantPods) > 0 {
						latestPod := relevantPods[len(relevantPods)-1]
						if jn, ok := latestPod.Labels["job-name"]; ok {
							jobLabels = map[string]string{"job-name": jn}
						}
						recentLogs = fetchRecentLogs(enrichCtx, client, namespace, jobLabels, allPods)
						recentEvents = fetchRecentEvents(enrichCtx, client, namespace, name, "ScaledJob", allEvents)
					} else {
						recentEvents = fetchRecentEvents(enrichCtx, client, namespace, name, "ScaledJob", allEvents)
					}

					w := Workload{
						ID: string(uid), ClusterID: clusterID, Name: name, Namespace: namespace, Kind: "ScaledJob",
						Replicas: int32(childCount), AvailableReplicas: int32(running), Status: status,
						Metrics:      getRealMetrics(enrichCtx, clusterID, namespace, name, "Job", v1.PodSpec{}, window, jobLabels, int32(childCount)),
						CostPerMonth: rand.Intn(100) + 10,
						RecentLogs:   recentLogs, Events: recentEvents,
						Scaling: ScalingInfo{
							Enabled:   true,
							Current:   active,
							KedaReady: !statusUnready,
							Config:    &KedaConfig{Name: name},
						},
					}

					// Fetch more status details for ScaledJob
					if status, ok := item.Object["status"].(map[string]interface{}); ok {
						if conditions, ok := status["conditions"].([]interface{}); ok {
							for _, c := range conditions {
								if cMap, ok := c.(map[string]interface{}); ok {
									cType := cMap["type"]
									cStatus := cMap["status"]
									cReason, _ := cMap["reason"].(string)
									cMsg, _ := cMap["message"].(string)

									switch cType {
									case "Ready":
										if cStatus != "True" {
											w.Scaling.Misconfigurations = append(w.Scaling.Misconfigurations, fmt.Sprintf("ScaledJob Not Ready: %s (%s)", cReason, cMsg))
										}
									case "Active":
										w.Scaling.Active = (cStatus == "True")
									case "Fallback":
										w.Scaling.Fallback = (cStatus == "True")
										if w.Scaling.Fallback {
											w.Scaling.Misconfigurations = append(w.Scaling.Misconfigurations, "ScaledJob in Fallback mode")
										}
									}
								}
							}
						}
					}

					if spec, ok := item.Object["spec"].(map[string]interface{}); ok {
						if trigs, ok := spec["triggers"].([]interface{}); ok {
							var trigTypes []string
							for _, t := range trigs {
								if tMap, ok := t.(map[string]interface{}); ok {
									if typeStr, ok := tMap["type"].(string); ok {
										trigTypes = append(trigTypes, typeStr)
									}
								}
							}
							w.Scaling.Config.Triggers = trigTypes
						}
					}
					if w.Status != "Healthy" {
						w.SchedulerLogs = fetchKarpenterLogs(enrichCtx, client, name)
						w.Provisioning = fetchKarpenterProvisioning(enrichCtx, dynClient, name)
						w.ProvisioningStatus = analyzeScheduling(w.Events, v1.PodSpec{}, w.Provisioning) // Job spec not easily avail here without fetching Job
						// Ideally we'd pass job.Spec.Template.Spec if we had the Job object handy.
						// We can fetch it or just pass empty for now (misses toleration hints).
					}
					addWorkload(w)
					return nil
				})
			}
		}
	}

	if err := g.Wait(); err != nil {
		fmt.Printf("Error in concurrent enrichment: %v\n", err)
	}

	// Step 2: Store in Cache (10s TTL for real-time feel)
	if jsonBytes, err := json.Marshal(workloads); err == nil {
		cache.Set(c.Request.Context(), cacheKey, jsonBytes, cache.TTLWorkloads)
	}

	// Step 3: Persist metric snapshots asynchronously for right-sizing history.
	// This is best-effort: failures are logged but do not affect the response.
	go func(list []Workload, cid string) {
		if db.DB == nil {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		now := time.Now()
		for _, w := range list {
			snap := db.WorkloadMetricSnapshot{
				ClusterID:          cid,
				Namespace:          w.Namespace,
				WorkloadName:       w.Name,
				Kind:               string(w.Kind),
				CpuUsage:           w.Metrics.CpuUsage,
				CpuLimit:           w.Metrics.CpuLimit,
				CpuLimitPerPod:     w.Metrics.CpuLimitPerPod,
				MaxCpuUsage:        w.Metrics.CpuMaxPodUsage,
				CpuHotPodP99:       w.Metrics.CpuHotPodP99,
				MemoryUsage:        w.Metrics.MemoryUsage,
				MemoryLimit:        w.Metrics.MemoryLimit,
				MemoryLimitPerPod:  w.Metrics.MemoryLimitPerPod,
				MaxMemoryUsage:     w.Metrics.MemoryMaxPodUsage,
				MemoryHotPodP99:    w.Metrics.MemoryHotPodP99,
				StorageUsage:       w.Metrics.StorageUsage,
				StorageLimit:       w.Metrics.StorageLimit,
				StorageLimitPerPod: w.Metrics.StorageLimitPerPod,
				MaxStorageUsage:    w.Metrics.StorageMaxPodUsage,
				GpuUsage:           w.Metrics.GpuUsage,
				GpuLimit:           w.Metrics.GpuLimit,
				GpuLimitPerPod:     w.Metrics.GpuLimitPerPod,
				MaxGpuUsage:        w.Metrics.GpuMaxPodUsage,
				PodCount:           w.PodCount,
				RecordedAt:         now,
			}
			if err := db.DB.WithContext(ctx).Create(&snap).Error; err != nil {
				log.Printf("Warning: failed to write metric snapshot for %s/%s: %v", w.Namespace, w.Name, err)
			}
		}
		// Keep only the last 100 snapshots per workload to bound table growth.
		if len(list) > 0 {
			var idsToKeep []uint
			for _, w := range list {
				var keep []uint
				db.DB.WithContext(ctx).Model(&db.WorkloadMetricSnapshot{}).
					Select("id").
					Where("cluster_id = ? AND namespace = ? AND workload_name = ?", cid, w.Namespace, w.Name).
					Order("recorded_at DESC").
					Limit(100).
					Pluck("id", &keep)
				idsToKeep = append(idsToKeep, keep...)
			}
			if len(idsToKeep) > 0 {
				db.DB.WithContext(ctx).Where("cluster_id = ? AND id NOT IN ?", cid, idsToKeep).Delete(&db.WorkloadMetricSnapshot{})
			}
		}
	}(workloads, clusterID)

	log.Printf("WorkloadsHandler: Returning %d workloads for cluster %s", len(workloads), clusterID)
	c.JSON(http.StatusOK, workloads)
}

// WorkloadLogsHandler returns recent container logs for a specific workload on demand.
// The workloads list no longer fetches logs for every workload (too slow on large clusters),
// so the UI calls this endpoint when a workload is opened in the triage view.
func WorkloadLogsHandler(c *gin.Context) {
	clusterID := c.Query("cluster")
	namespace := c.Param("namespace")
	name := c.Param("name")
	kind := c.Query("kind")
	if kind == "" {
		kind = "Deployment"
	}

	var client *kubernetes.Clientset
	if clusterID != "" && k8s.Manager != nil {
		if cls, err := k8s.Manager.GetOrConnectCluster(clusterID); err == nil {
			client = cls.ClientSet
		}
	}
	if client == nil {
		client = k8s.ClientSet
	}
	if client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Kubernetes client not available"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	var matchLabels map[string]string
	switch kind {
	case "Deployment":
		if d, err := client.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{}); err == nil {
			matchLabels = d.Spec.Selector.MatchLabels
		}
	case "StatefulSet":
		if s, err := client.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{}); err == nil {
			matchLabels = s.Spec.Selector.MatchLabels
		}
	case "DaemonSet":
		if ds, err := client.AppsV1().DaemonSets(namespace).Get(ctx, name, metav1.GetOptions{}); err == nil {
			matchLabels = ds.Spec.Selector.MatchLabels
		}
	case "Pod":
		if pod, err := client.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{}); err == nil {
			logs := fetchRecentLogs(ctx, client, namespace, nil, []corev1.Pod{*pod})
			c.JSON(http.StatusOK, gin.H{"logs": logs, "podNames": []string{name}})
			return
		}
	}

	if len(matchLabels) == 0 {
		c.JSON(http.StatusOK, gin.H{"logs": []string{}, "podNames": []string{}})
		return
	}

	logs := fetchRecentLogs(ctx, client, namespace, matchLabels, nil)
	podNames := fetchPodNames(ctx, client, namespace, matchLabels, nil)

	c.JSON(http.StatusOK, gin.H{"logs": logs, "podNames": podNames})
}

type RegisterClusterRequest struct {
	Kubeconfig  string `json:"kubeconfig" binding:"required"`
	DisplayName string `json:"displayName"`
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
	cluster, err := k8s.Manager.AddClusterFromKubeconfig([]byte(req.Kubeconfig), req.DisplayName)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "unable to read") || strings.Contains(errMsg, "no such file") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Your kubeconfig references certificate files on your local filesystem (e.g. minikube). These paths are not accessible inside the server container. Use an inline/flattened kubeconfig instead:\n\nkubectl config view --minify --flatten --context=<context-name>\n\nThis embeds the certificates as base64 data directly in the YAML."})
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to register cluster: %v", err)})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Cluster registered successfully",
		"id":          cluster.ID,
		"name":        cluster.Name,
		"displayName": cluster.DisplayName,
	})
}

func DeleteClusterHandler(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id parameter required"})
		return
	}

	if k8s.Manager == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cluster Manager not initialized"})
		return
	}

	// 1. Remove from in-memory manager
	k8s.Manager.RemoveCluster(id)

	c.Status(http.StatusNoContent)
}
