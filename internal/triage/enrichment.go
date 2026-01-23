package triage

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/ai"
	"github.com/aavishay/kubetriage/backend/internal/prometheus"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"sigs.k8s.io/yaml"
)

func EnrichAnalyzeRequest(ctx context.Context, client *kubernetes.Clientset, req *ai.AnalyzeWorkloadRequest) {
	if client == nil || req.Namespace == "" || req.WorkloadName == "" {
		return
	}

	// 1. Fetch Events
	events := FetchRecentEvents(ctx, client, req.Namespace, req.WorkloadName, req.Kind)
	for _, e := range events {
		req.Events = append(req.Events, fmt.Sprintf("%s event: [%s] %s", req.Kind, e.Reason, e.Message))
	}

	// 2. Fetch YAML & Metrics based on Kind
	switch req.Kind {
	case "Deployment":
		if d, err := client.AppsV1().Deployments(req.Namespace).Get(ctx, req.WorkloadName, metav1.GetOptions{}); err == nil {
			req.Yaml = FetchFullYaml(d)
		}
	case "StatefulSet":
		if s, err := client.AppsV1().StatefulSets(req.Namespace).Get(ctx, req.WorkloadName, metav1.GetOptions{}); err == nil {
			req.Yaml = FetchFullYaml(s)
		}
	case "DaemonSet":
		if d, err := client.AppsV1().DaemonSets(req.Namespace).Get(ctx, req.WorkloadName, metav1.GetOptions{}); err == nil {
			req.Yaml = FetchFullYaml(d)
		}
	case "Pod":
		if p, err := client.CoreV1().Pods(req.Namespace).Get(ctx, req.WorkloadName, metav1.GetOptions{}); err == nil {
			req.Yaml = FetchFullYaml(p)
		}
	}

	// 3. Metrics
	req.Metrics = FetchHistoricalMetricsTrend(ctx, req.Namespace, req.WorkloadName)
}

func FetchFullYaml(obj interface{}) string {
	y, err := yaml.Marshal(obj)
	if err != nil {
		return fmt.Sprintf("Error marshaling YAML: %v", err)
	}
	return string(y)
}

func FetchRecentEvents(ctx context.Context, client *kubernetes.Clientset, namespace, name, kind string) []v1.Event {
	selector := fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=%s", name, kind)
	events, err := client.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{
		FieldSelector: selector,
		Limit:         10,
	})
	if err != nil {
		return nil
	}
	return events.Items
}

func FetchHistoricalMetricsTrend(ctx context.Context, namespace, name string) string {
	if prometheus.GlobalClient == nil {
		return "Prometheus not available"
	}

	endTime := time.Now()
	startTime := endTime.Add(-1 * time.Hour)
	step := 5 * time.Minute

	// CPU Trend
	cpuQuery := fmt.Sprintf(`sum(rate(container_cpu_usage_seconds_total{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$", container!=""}[2m]))`, namespace, name)
	cpuPoints, err := prometheus.GlobalClient.QueryRange(ctx, cpuQuery, startTime, endTime, step)

	// Memory Trend
	memQuery := fmt.Sprintf(`sum(container_memory_working_set_bytes{namespace="%s", pod=~"^%s-[a-z0-9]+(-[a-z0-9]+)?$", container!=""})`, namespace, name)
	memPoints, _ := prometheus.GlobalClient.QueryRange(ctx, memQuery, startTime, endTime, step)

	var sb strings.Builder
	sb.WriteString("| Time | CPU (Cores) | RAM (MiB) |\n")
	sb.WriteString("|------|-------------|-----------|\n")

	max := len(cpuPoints)
	if len(memPoints) < max {
		max = len(memPoints)
	}

	for i := 0; i < max; i++ {
		t := time.Unix(cpuPoints[i].Timestamp/1000, 0).Format("15:04")
		sb.WriteString(fmt.Sprintf("| %s | %.3f | %.1f |\n", t, cpuPoints[i].Value, memPoints[i].Value/(1024*1024)))
	}

	if err != nil {
		sb.WriteString(fmt.Sprintf("\nNote: Some data points missing due to query error: %v", err))
	}

	return sb.String()
}
