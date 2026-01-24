package api

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/gin-gonic/gin"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

type LogSearchResult struct {
	PodName   string `json:"podName"`
	Timestamp string `json:"timestamp"` // Parse if possible, or leave empty
	Content   string `json:"content"`
	LineNum   int    `json:"lineNum"`
}

func SearchLogsHandler(c *gin.Context) {
	clusterID := c.Query("clusterId")
	namespace := c.Query("namespace")
	workloadName := c.Query("workloadName") // Optional: Limit to specific workload
	workloadKind := c.Query("workloadKind") // Optional
	query := c.Query("query")

	if namespace == "" || query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace and query are required"})
		return
	}

	// Resolve the correct client
	var client *kubernetes.Clientset
	if clusterID != "" && k8s.Manager != nil {
		if cls, err := k8s.Manager.GetCluster(clusterID); err == nil {
			client = cls.ClientSet
		}
	}
	if client == nil {
		client = k8s.ClientSet
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second) // 10s max for global search
	defer cancel()

	// 1. Identify Target Pods
	var targetPods []corev1.Pod
	listOpts := metav1.ListOptions{}

	if workloadName != "" && workloadKind != "" {
		// Resolve Selector from Workload
		// This is slightly complex as we'd need to fetch the Deployment/Sts to get the selector.
		// For simplicity/speed in this MVP, we can assume standard labels OR fetch the object.
		// Let's try fetching the object to get the selector.
		selector := ""
		switch strings.ToLower(workloadKind) {
		case "deployment":
			if d, err := client.AppsV1().Deployments(namespace).Get(ctx, workloadName, metav1.GetOptions{}); err == nil {
				selector = metav1.FormatLabelSelector(d.Spec.Selector)
			}
		case "statefulset":
			if s, err := client.AppsV1().StatefulSets(namespace).Get(ctx, workloadName, metav1.GetOptions{}); err == nil {
				selector = metav1.FormatLabelSelector(s.Spec.Selector)
			}
		case "daemonset":
			if ds, err := client.AppsV1().DaemonSets(namespace).Get(ctx, workloadName, metav1.GetOptions{}); err == nil {
				selector = metav1.FormatLabelSelector(ds.Spec.Selector)
			}
		}

		if selector != "" {
			listOpts.LabelSelector = selector
		} else {
			// Fallback: If we couldn't resolve selector (e.g. unknown kind or error), return empty or error?
			// Let's fallback to searching ALL pods in namespace if user didn't specify strict mode,
			// OR we can try to match by name prefix which is common.
			c.JSON(http.StatusNotFound, gin.H{"error": "Could not resolve workload selector"})
			return
		}
	}

	// List Pods
	pods, err := client.CoreV1().Pods(namespace).List(ctx, listOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to list pods: %v", err)})
		return
	}
	targetPods = pods.Items

	// 2. Concurrently Search Logs
	var results []LogSearchResult
	var mu sync.Mutex
	var wg sync.WaitGroup

	// Limit concurrency
	semaphore := make(chan struct{}, 20) // max 20 concurrent log fetches

	for _, pod := range targetPods {
		if pod.Status.Phase != corev1.PodRunning && pod.Status.Phase != corev1.PodFailed {
			continue
		}

		wg.Add(1)
		go func(p corev1.Pod) {
			defer wg.Done()
			semaphore <- struct{}{}        // Acquire
			defer func() { <-semaphore }() // Release

			// Search Limit: last 1000 lines per pod
			opts := &k8s.LogOptions{Lines: 1000}
			logs, err := k8s.GetPodLogs(ctx, client, namespace, p.Name, opts)
			if err == nil && logs != "" {
				lines := strings.Split(logs, "\n")
				for i, line := range lines {
					if strings.Contains(strings.ToLower(line), strings.ToLower(query)) {
						mu.Lock()
						results = append(results, LogSearchResult{
							PodName: p.Name,
							Content: line,
							LineNum: i + 1,
						})
						mu.Unlock()
					}
				}
			}
		}(pod)
	}

	wg.Wait()

	// 3. Sort Results?
	// Maybe by PodName then Content? Or just return raw list.
	// Let's sort by PodName for now.
	sort.Slice(results, func(i, j int) bool {
		return results[i].PodName < results[j].PodName
	})

	c.JSON(http.StatusOK, gin.H{
		"query":   query,
		"matches": len(results),
		"results": results,
		"scanned": len(targetPods),
	})
}
