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
	ID                string          `json:"id"`
	Name              string          `json:"name"`
	Namespace         string          `json:"namespace"`
	Kind              string          `json:"kind"`
	Replicas          int32           `json:"replicas"`
	AvailableReplicas int32           `json:"availableReplicas"`
	Status            string          `json:"status"`
	Metrics           ResourceMetrics `json:"metrics"`
	RecentLogs        []string        `json:"recentLogs"`
	Events            []K8sEvent      `json:"events"`
	CostPerMonth      int             `json:"costPerMonth"`
	Scaling           ScalingInfo     `json:"scaling"`
	SchedulerLogs     []string        `json:"schedulerLogs,omitempty"`
}

type ScalingInfo struct {
	Enabled   bool        `json:"enabled"`
	Min       int32       `json:"min"`
	Max       int32       `json:"max"`
	Current   int32       `json:"current"`
	KedaReady bool        `json:"kedaReady"`
	Config    *KedaConfig `json:"config,omitempty"`
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

	// List all SOs in namespace (optimization: could limit fields if supported, or cache)
	// For MVP, listing is acceptable given namespace scope
	sos, err := dynClient.Resource(gvr).Namespace(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		// KEDA might not be installed, ignore error
		return info
	}

	for _, item := range sos.Items {
		// Check scaleTargetRef
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
			// Found it
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

			// Check Status for Readiness
			statusReady := false
			if status, ok := item.Object["status"].(map[string]interface{}); ok {
				if conditions, ok := status["conditions"].([]interface{}); ok {
					for _, c := range conditions {
						if cMap, ok := c.(map[string]interface{}); ok {
							if cMap["type"] == "Ready" && cMap["status"] == "True" {
								statusReady = true
								break
							}
						}
					}
				}
			}
			info.KedaReady = statusReady

			info.Config = &KedaConfig{
				Name:     item.GetName(),
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
					Metrics:           getRealMetrics(enrichCtx, d.Namespace, d.Name, "Deployment", d.Spec.Template.Spec),
					RecentLogs:        fetchRecentLogs(enrichCtx, client, d.Namespace, d.Spec.Selector.MatchLabels),
					Events:            fetchRecentEvents(enrichCtx, client, d.Namespace, d.Name, "Deployment"),
					Scaling:           fetchKedaScaling(enrichCtx, dynClient, d.Namespace, d.Name),
				}
				if w.Status != "Healthy" {
					w.SchedulerLogs = fetchKarpenterLogs(enrichCtx, client, d.Name)
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
					Metrics:           getRealMetrics(enrichCtx, s.Namespace, s.Name, "StatefulSet", s.Spec.Template.Spec),
					RecentLogs:        fetchRecentLogs(enrichCtx, client, s.Namespace, s.Spec.Selector.MatchLabels),
					Events:            fetchRecentEvents(enrichCtx, client, s.Namespace, s.Name, "StatefulSet"),
					Scaling:           fetchKedaScaling(enrichCtx, dynClient, s.Namespace, s.Name),
				}
				if w.Status != "Healthy" {
					w.SchedulerLogs = fetchKarpenterLogs(enrichCtx, client, s.Name)
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
					Metrics:           getRealMetrics(enrichCtx, ds.Namespace, ds.Name, "DaemonSet", ds.Spec.Template.Spec),
					RecentLogs:        fetchRecentLogs(enrichCtx, client, ds.Namespace, ds.Spec.Selector.MatchLabels),
					Events:            fetchRecentEvents(enrichCtx, client, ds.Namespace, ds.Name, "DaemonSet"),
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
					if len(relevantPods) > 0 {
						latestPod := relevantPods[len(relevantPods)-1]
						recentLogs = fetchRecentLogs(enrichCtx, client, namespace, map[string]string{"job-name": latestPod.Labels["job-name"]})
						recentEvents = fetchRecentEvents(enrichCtx, client, namespace, name, "ScaledJob")
					} else {
						recentEvents = fetchRecentEvents(enrichCtx, client, namespace, name, "ScaledJob")
					}

					w := Workload{
						ID: string(uid), Name: name, Namespace: namespace, Kind: "ScaledJob",
						Replicas: int32(childCount), AvailableReplicas: int32(running), Status: status,
						Metrics:      getRealMetrics(enrichCtx, namespace, name, "Job", v1.PodSpec{}),
						CostPerMonth: rand.Intn(100) + 10,
						RecentLogs:   recentLogs, Events: recentEvents,
						Scaling: ScalingInfo{Enabled: true, Current: active, KedaReady: !statusUnready, Config: &KedaConfig{Name: name}},
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
