package ai

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
)

const (
	GeminiProModel  = "gemini-1.5-pro"
	GeminiFastModel = "gemini-1.5-flash-latest"
)

type AIService struct {
	client *genai.Client
}

func NewAIService(ctx context.Context) (*AIService, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY is not set")
	}

	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return nil, err
	}

	return &AIService{client: client}, nil
}

func (s *AIService) Close() {
	if s.client != nil {
		s.client.Close()
	}
}

// AnalyzeWorkloadRequest mirrors the frontend data structure
type AnalyzeWorkloadRequest struct {
	WorkloadName string   `json:"workloadName"`
	Status       string   `json:"status"`
	Playbook     string   `json:"playbook"`
	Instructions string   `json:"instructions"`
	CpuUsage     string   `json:"cpuUsage"`
	CpuLimit     string   `json:"cpuLimit"`
	MemoryUsage  string   `json:"memoryUsage"`
	MemoryLimit  string   `json:"memoryLimit"`
	StorageUsage string   `json:"storageUsage"`
	StorageLimit string   `json:"storageLimit"`
	DiskIo       string   `json:"diskIo"`
	Logs         []string `json:"logs"`
	Events       []string `json:"events"`
}

func (s *AIService) AnalyzeWorkload(ctx context.Context, req AnalyzeWorkloadRequest) (string, error) {
	model := s.client.GenerativeModel(GeminiProModel)

	prompt := fmt.Sprintf(`
    You are a Senior Kubernetes SRE performing a targeted diagnosis for the workload "%s".
    
    **Context**:
    - Status: %s
    - Playbook: %s
    - Instruction: %s
    
    **Telemetry Summary**:
    - CPU: %s / %s
    - RAM: %s / %s
    - Storage: %s / %s
    - Disk I/O: %s
    
    **Data**:
    Logs:
    %s
    
    Events:
    %s
    
    **Output Guidelines**:
    Provide a professional SRE incident report in Markdown.
    Pay special attention to DiskPressure if storage usage is near limits.
    
    Structure:
    1. **Executive Summary**: A high-level TL;DR of the critical issue.
    2. **Root Cause Analysis (RCA)**: Logical deduction of why this is happening.
    3. **Impact Assessment**: How this affects the end-user.
    4. **Remediation Steps**: 3-4 numbered items to resolve the issue immediately.
    5. **Observability Commands**: A markdown code block with 'kubectl' commands to verify storage/disk state.
	`,
		req.WorkloadName, req.Status, req.Playbook, req.Instructions,
		req.CpuUsage, req.CpuLimit, req.MemoryUsage, req.MemoryLimit, req.StorageUsage, req.StorageLimit, req.DiskIo,
		strings.Join(req.Logs, "\n"),
		strings.Join(req.Events, "\n"),
	)

	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", err
	}

	return getResponseText(resp), nil
}

func (s *AIService) GenerateRemediation(ctx context.Context, resourceKind, resourceName, errorLog string) (string, error) {
	model := s.client.GenerativeModel(GeminiProModel)
	prompt := fmt.Sprintf(`
	You are a Kubernetes Expert.
	The resource %s/%s has the following error logs:
	%s

	Suggest a specific remediation action. 
	If it involves a YAML change, provide the YAML patch.
	Refer to potential root causes.
	`, resourceKind, resourceName, errorLog)

	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", err
	}
	return getResponseText(resp), nil
}

// Helper to extract text from response
func getResponseText(resp *genai.GenerateContentResponse) string {
	var sb strings.Builder
	for _, cand := range resp.Candidates {
		if cand.Content != nil {
			for _, part := range cand.Content.Parts {
				if txt, ok := part.(genai.Text); ok {
					sb.WriteString(string(txt))
				}
			}
		}
	}
	return sb.String()
}
