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
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/aavishay/kubetriage/backend/internal/auth"
	"github.com/aavishay/kubetriage/backend/internal/cache"
	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/aavishay/kubetriage/backend/internal/prometheus"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	autoscalingv2 "k8s.io/api/autoscaling/v2"
	corev1 "k8s.io/api/core/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
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
	CpuAvg         float64 `json:"cpuAvg"`
	CpuP95         float64 `json:"cpuP95"`
	CpuP99         float64 `json:"cpuP99"`
	MemoryAvg      float64 `json:"memoryAvg"`
	MemoryP95      float64 `json:"memoryP95"`
	MemoryP99      float64 `json:"memoryP99"`
}

type K8sEvent struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Reason   string `json:"reason"`
	Message  string `json:"message"`
	LastSeen string `json:"lastSeen"`
}

// Workload struct mapping to frontend
type Workload struct {
	ID                 string            `json:"id"`
	Name               string            `json:"name"`
	Namespace          string            `json:"namespace"`
	Kind               string            `json:"kind"`
	Replicas           int32             `json:"replicas"`
	AvailableReplicas  int32             `json:"availableReplicas"`
	Status             string            `json:"status"`
	Metrics            ResourceMetrics   `json:"metrics"`
	RecentLogs         []string          `json:"recentLogs"`
	Events             []K8sEvent        `json:"events"`
	CostPerMonth       int               `json:"costPerMonth"`
	Scaling            ScalingInfo       `json:"scaling"`
	SchedulerLogs      []string          `json:"schedulerLogs,omitempty"`
	Provisioning       *ProvisioningInfo `json:"provisioning,omitempty"`
	ProvisioningStatus string            `json:"provisioningStatus,omitempty"` // e.g. "Provisioning", "Scheduled"
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

func getRealMetrics(ctx context.Context, namespace, name, kind string, podSpec v1.PodSpec, window string, matchLabels map[string]string, replicas int32) ResourceMetrics {
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
	}

	// 1.5 Scale Limits/Requests by Replicas
	if replicas > 1 {
		scale := float64(replicas)
		metrics.CpuRequest *= scale
		metrics.CpuLimit *= scale
		metrics.MemoryRequest *= scale
		metrics.MemoryLimit *= scale
		metrics.StorageRequest *= scale
		metrics.StorageLimit *= scale
	}

	// 2. Fetch Usage from Prometheus (if avail)
	if prometheus.GlobalClient != nil {
		// CPU Usage
		cpuQuery := fmt.Sprintf(`sum(rate(container_cpu_usage_seconds_total{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$", container!=""}[2m]))`, namespace, name)
		if val, err := prometheus.GlobalClient.QueryVector(ctx, cpuQuery); err == nil && val > 0 {
			metrics.CpuUsage = val
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
	}

	// 4. Fallback: Metrics Server (Real Data)
	// If usage is still 0 (Prometheus failed or missing), try Kubernetes Metrics API
	if metrics.CpuUsage == 0 && metrics.MemoryUsage == 0 && len(matchLabels) > 0 {
		mgr := k8s.GetClusterManager()
		if mgr != nil {
			selector := ""
			for k, v := range matchLabels {
				if selector != "" {
					selector += ","
				}
				selector += fmt.Sprintf("%s=%s", k, v)
			}

			// Try all clusters that have metrics client (usually just local)
			for _, cls := range mgr.ListClusters() {
				if cls.MetricsClient != nil {
					podMetrics, err := cls.MetricsClient.MetricsV1beta1().PodMetricses(namespace).List(ctx, metav1.ListOptions{LabelSelector: selector})
					if err == nil {
						var cpuTotal float64
						var memTotal float64

						for _, pm := range podMetrics.Items {
							for _, c := range pm.Containers {
								cpuTotal += float64(c.Usage.Cpu().MilliValue()) / 1000.0      // Cores
								memTotal += float64(c.Usage.Memory().Value()) / (1024 * 1024) // MiB
							}
						}

						if cpuTotal > 0 || memTotal > 0 {
							metrics.CpuUsage = cpuTotal
							metrics.MemoryUsage = memTotal
							break // Found data
						}
					}
				}
			}
		}
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

func fetchRecentEvents(ctx context.Context, client *kubernetes.Clientset, namespace, name, kind string) []K8sEvent {
	// Query events involving this object
	// We use field selectors to match involvedObject.name and involvedObject.kind
	selector := fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=%s", name, kind)

	events, err := client.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{
		FieldSelector: selector,
		Limit:         10,
	})
	if err != nil {
		return []K8sEvent{}
	}

	var result []K8sEvent
	for _, e := range events.Items {
		result = append(result, K8sEvent{
			ID:       string(e.UID),
			Type:     e.Type,
			Reason:   e.Reason,
			Message:  e.Message,
			LastSeen: e.LastTimestamp.Format("15:04:05"),
		})
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
func fetchKedaScaling(ctx context.Context, dynClient dynamic.Interface, namespace, workloadName string) ScalingInfo {
	info := ScalingInfo{
		Enabled: false,
		Min:     0,
		Max:     0,
		Current: 0,
	}

	if dynClient == nil {
		return info
	}

	gvr := schema.GroupVersionResource{
		Group:    "keda.sh",
		Version:  "v1alpha1",
		Resource: "scaledobjects",
	}

	sos, err := dynClient.Resource(gvr).Namespace(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return info
	}

	for _, item := range sos.Items {
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
func fetchHPAScaling(ctx context.Context, client *kubernetes.Clientset, namespace, workloadName string) ScalingInfo {
	info := ScalingInfo{
		Enabled: false,
		Min:     0,
		Max:     0,
		Current: 0,
	}

	if client == nil {
		return info
	}

	hpas, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return info
	}

	for _, hpa := range hpas.Items {
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
	ID       string `json:"id"`
	Name     string `json:"name"`
	Provider string `json:"provider"`
	Status   string `json:"status"`
}

func getScalingInfo(ctx context.Context, client *kubernetes.Clientset, dynClient dynamic.Interface, namespace, name string) ScalingInfo {
	keda := fetchKedaScaling(ctx, dynClient, namespace, name)
	hpa := fetchHPAScaling(ctx, client, namespace, name)

	if !keda.Enabled && !hpa.Enabled {
		return ScalingInfo{Enabled: false}
	}

	// Merge logic: KEDA usually wins if enabled, but HPA might have more real-time status
	// from the HPA controller itself.
	res := hpa
	if keda.Enabled {
		res.Enabled = true
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
	window := c.Query("window")
	if window == "" {
		window = "1h"
	}
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

	// Get Dynamic Client (safely)
	var dynClient dynamic.Interface
	if clusterID != "" && k8s.Manager != nil {
		if cls, err := k8s.Manager.GetCluster(clusterID); err == nil {
			dynClient = cls.DynamicClient
		}
	} else if k8s.GlobalManager != nil && len(k8s.GlobalManager.ListClusters()) > 0 {
		// Default fallback
		dynClient = k8s.GlobalManager.ListClusters()[0].DynamicClient
	}

	if client == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "K8s client not initialized"})
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

	// Step 1: Check Cache
	cacheKey := fmt.Sprintf("workloads:%s", clusterID)
	if val, err := cache.Get(c.Request.Context(), cacheKey); err == nil {
		c.Header("X-Cache", "HIT")
		c.Data(http.StatusOK, "application/json", []byte(val))
		return
	}

	// Use errgroup for concurrency
	g, ctx := errgroup.WithContext(c.Request.Context())
	g.SetLimit(20) // Concurrent enrichment limit

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
				enrichCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
				defer cancel()
				w := Workload{
					ID:                string(d.UID),
					Name:              d.Name,
					Namespace:         d.Namespace,
					Kind:              "Deployment",
					Replicas:          *d.Spec.Replicas,
					AvailableReplicas: d.Status.AvailableReplicas,
					Status:            getStatus(d.Status.AvailableReplicas, *d.Spec.Replicas),
					CostPerMonth:      rand.Intn(500) + 50,
					Metrics:           getRealMetrics(enrichCtx, d.Namespace, d.Name, "Deployment", d.Spec.Template.Spec, window, d.Spec.Selector.MatchLabels, *d.Spec.Replicas),
					RecentLogs:        fetchRecentLogs(enrichCtx, client, d.Namespace, d.Spec.Selector.MatchLabels),
					Events:            fetchRecentEvents(enrichCtx, client, d.Namespace, d.Name, "Deployment"),
					Scaling:           getScalingInfo(enrichCtx, client, dynClient, d.Namespace, d.Name),
				}
				if w.Status != "Healthy" {
					w.SchedulerLogs = fetchKarpenterLogs(enrichCtx, client, d.Name)
					w.Provisioning = fetchKarpenterProvisioning(enrichCtx, dynClient, d.Name)
					w.ProvisioningStatus = analyzeScheduling(w.Events, d.Spec.Template.Spec, w.Provisioning)
				}
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
				enrichCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
				defer cancel()
				w := Workload{
					ID:                string(s.UID),
					Name:              s.Name,
					Namespace:         s.Namespace,
					Kind:              "StatefulSet",
					Replicas:          *s.Spec.Replicas,
					AvailableReplicas: s.Status.ReadyReplicas,
					Status:            getStatus(s.Status.ReadyReplicas, *s.Spec.Replicas),
					CostPerMonth:      rand.Intn(500) + 100,
					Metrics:           getRealMetrics(enrichCtx, s.Namespace, s.Name, "StatefulSet", s.Spec.Template.Spec, window, s.Spec.Selector.MatchLabels, *s.Spec.Replicas),
					RecentLogs:        fetchRecentLogs(enrichCtx, client, s.Namespace, s.Spec.Selector.MatchLabels),
					Events:            fetchRecentEvents(enrichCtx, client, s.Namespace, s.Name, "StatefulSet"),
					Scaling:           getScalingInfo(enrichCtx, client, dynClient, s.Namespace, s.Name),
				}
				if w.Status != "Healthy" {
					w.SchedulerLogs = fetchKarpenterLogs(enrichCtx, client, s.Name)
					w.Provisioning = fetchKarpenterProvisioning(enrichCtx, dynClient, s.Name)
					w.ProvisioningStatus = analyzeScheduling(w.Events, s.Spec.Template.Spec, w.Provisioning)
				}
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
				enrichCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
				defer cancel()
				w := Workload{
					ID:                string(ds.UID),
					Name:              ds.Name,
					Namespace:         ds.Namespace,
					Kind:              "DaemonSet",
					Replicas:          ds.Status.DesiredNumberScheduled,
					AvailableReplicas: ds.Status.NumberReady,
					Status:            getStatus(ds.Status.NumberReady, ds.Status.DesiredNumberScheduled),
					CostPerMonth:      rand.Intn(200) + 50,
					Metrics:           getRealMetrics(enrichCtx, ds.Namespace, ds.Name, "DaemonSet", ds.Spec.Template.Spec, window, ds.Spec.Selector.MatchLabels, ds.Status.DesiredNumberScheduled),
					RecentLogs:        fetchRecentLogs(enrichCtx, client, ds.Namespace, ds.Spec.Selector.MatchLabels),
					Events:            fetchRecentEvents(enrichCtx, client, ds.Namespace, ds.Name, "DaemonSet"),
				}
				if w.Status != "Healthy" {
					// DaemonSets usually don't use Karpenter provisioning like Deployments do
					// But we can still analyze scheduling issues
					w.Provisioning = &ProvisioningInfo{Enabled: false} // Placeholder
					w.ProvisioningStatus = analyzeScheduling(w.Events, ds.Spec.Template.Spec, w.Provisioning)
				}
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

					enrichCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
					defer cancel()

					var recentLogs []string
					var recentEvents []K8sEvent
					var jobLabels map[string]string

					if len(relevantPods) > 0 {
						latestPod := relevantPods[len(relevantPods)-1]
						if jn, ok := latestPod.Labels["job-name"]; ok {
							jobLabels = map[string]string{"job-name": jn}
						}
						recentLogs = fetchRecentLogs(enrichCtx, client, namespace, jobLabels)
						recentEvents = fetchRecentEvents(enrichCtx, client, namespace, name, "ScaledJob")
					} else {
						recentEvents = fetchRecentEvents(enrichCtx, client, namespace, name, "ScaledJob")
					}

					w := Workload{
						ID: string(uid), Name: name, Namespace: namespace, Kind: "ScaledJob",
						Replicas: int32(childCount), AvailableReplicas: int32(running), Status: status,
						Metrics:      getRealMetrics(enrichCtx, namespace, name, "Job", v1.PodSpec{}, window, jobLabels, int32(childCount)),
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

	// 2. Remove persisted project association
	if err := db.DB.Where("cluster_id = ?", id).Delete(&db.ClusterProject{}).Error; err != nil {
		log.Printf("Warning: Failed to delete cluster project mapping: %v", err)
	}

	c.Status(http.StatusNoContent)
}
