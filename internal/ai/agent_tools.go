package ai

import (
	"context"
	"fmt"
	"strings"

	"github.com/aavishay/kubetriage/backend/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Tool definition
type AgentTool struct {
	Name        string
	Description string
	Usage       string // Example: "get_logs <namespace> <pod_name>"
	Execute     func(args []string) (string, error)
}

// Registry of available tools
var AgentTools = map[string]AgentTool{
	"get_logs": {
		Name:        "get_logs",
		Description: "Fetch recent logs for a specific pod. Use this to investigate errors.",
		Usage:       "get_logs <namespace> <pod_name>",
		Execute:     executeGetLogs,
	},
	"get_events": {
		Name:        "get_events",
		Description: "List recent Kubernetes events for a specific pod. Use this to debug startup or scheduling issues.",
		Usage:       "get_events <namespace> <pod_name>",
		Execute:     executeGetEvents,
	},
	"describe_pod": {
		Name:        "describe_pod",
		Description: "Get detailed configuration and status of a pod (YAML-like summary).",
		Usage:       "describe_pod <namespace> <pod_name>",
		Execute:     executeDescribePod,
	},
}

func executeGetLogs(args []string) (string, error) {
	if len(args) < 2 {
		return "", fmt.Errorf("usage: get_logs <namespace> <pod_name>")
	}
	namespace := args[0]
	podName := args[1]

	client := k8s.ClientSet
	if client == nil {
		return "", fmt.Errorf("kubernetes client not initialized")
	}

	// Fetch up to 50 lines (tail)
	opts := &k8s.LogOptions{Lines: 50}
	logs, err := k8s.GetPodLogs(context.Background(), client, namespace, podName, opts)
	if err != nil {
		return "", fmt.Errorf("failed to fetch logs: %v", err)
	}

	if logs == "" {
		return "No logs found.", nil
	}
	return logs, nil
}

func executeGetEvents(args []string) (string, error) {
	if len(args) < 2 {
		return "", fmt.Errorf("usage: get_events <namespace> <pod_name>")
	}
	namespace := args[0]
	podName := args[1]

	client := k8s.ClientSet
	if client == nil {
		return "", fmt.Errorf("kubernetes client not initialized")
	}

	events, err := client.CoreV1().Events(namespace).List(context.Background(), metav1.ListOptions{
		FieldSelector: fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=Pod", podName),
	})
	if err != nil {
		return "", fmt.Errorf("failed to list events: %v", err)
	}

	if len(events.Items) == 0 {
		return "No events found.", nil
	}

	var sb strings.Builder
	for _, e := range events.Items {
		sb.WriteString(fmt.Sprintf("[%s] %s: %s\n", e.Type, e.Reason, e.Message))
	}
	return sb.String(), nil
}

func executeDescribePod(args []string) (string, error) {
	if len(args) < 2 {
		return "", fmt.Errorf("usage: describe_pod <namespace> <pod_name>")
	}
	namespace := args[0]
	podName := args[1]

	client := k8s.ClientSet
	if client == nil {
		return "", fmt.Errorf("kubernetes client not initialized")
	}

	pod, err := client.CoreV1().Pods(namespace).Get(context.Background(), podName, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to get pod: %v", err)
	}

	// Summarize key fields
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Name: %s\n", pod.Name))
	sb.WriteString(fmt.Sprintf("Status: %s\n", pod.Status.Phase))
	sb.WriteString(fmt.Sprintf("Node: %s\n", pod.Spec.NodeName))
	sb.WriteString("Containers:\n")
	for _, c := range pod.Spec.Containers {
		sb.WriteString(fmt.Sprintf("  - %s (Image: %s)\n", c.Name, c.Image))
	}
	sb.WriteString("Conditions:\n")
	for _, c := range pod.Status.Conditions {
		sb.WriteString(fmt.Sprintf("  - %s: %s (%s)\n", c.Type, c.Status, c.Message))
	}

	return sb.String(), nil
}

// GenerateSystemPrompt creates the instruction that tells the AI how to use tools
func GenerateAgentSystemPrompt() string {
	var sb strings.Builder
	sb.WriteString("You are an Autonomous Kubernetes SRE Agent. Your goal is to troubleshoot cluster issues.\n\n")
	sb.WriteString("You have access to the following tools:\n")

	for _, tool := range AgentTools {
		sb.WriteString(fmt.Sprintf("- %s: %s (Usage: %s)\n", tool.Name, tool.Description, tool.Usage))
	}

	sb.WriteString("\nTo use a tool, your response must be in this format:\n")
	sb.WriteString("TOOL_CALL: <tool_name> <arg1> <arg2>...\n")
	sb.WriteString("Example: TOOL_CALL: get_logs default my-pod-123\n\n")
	sb.WriteString("When you receive a TOOL_RESULT, analyze it and provide the answer to the user. Do not mention tool calling implementation details to the user.\n")

	return sb.String()
}
