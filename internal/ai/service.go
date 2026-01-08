package ai

import (
	"context"
	"fmt"
	"log"
	"strings"
)

type AIService struct {
	providers map[string]AIProvider
}

func NewAIService(ctx context.Context) (*AIService, error) {
	providers := make(map[string]AIProvider)

	// Initialize Gemini
	gemini, err := NewGeminiProvider(ctx)
	if err == nil {
		providers["gemini"] = gemini
	} else {
		log.Printf("Gemini provider not available: %v", err)
	}

	// Initialize Ollama
	ollama := NewOllamaProvider()
	providers["ollama"] = ollama

	if len(providers) == 0 {
		return nil, fmt.Errorf("no AI providers available")
	}

	return &AIService{providers: providers}, nil
}

func (s *AIService) Close() {
	// Close any providers that need closing
	// Since we don't hold the concrete types here easily without type assertion or adding Close to interface
	// Let's check the interface.
	// We didn't add Close to interface, but we can type assert.
	if gemini, ok := s.providers["gemini"].(*GeminiProvider); ok {
		gemini.Close()
	}
}

// AnalyzeWorkloadRequest mirrors the frontend data structure
type AnalyzeWorkloadRequest struct {
	Provider     string   `json:"provider"` // "gemini" or "ollama"
	Model        string   `json:"model"`    // specific model like "llama3"
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

func (s *AIService) getProvider(name string) (AIProvider, error) {
	if name == "" {
		// Default preference: Gemini -> Ollama
		if p, ok := s.providers["gemini"]; ok {
			return p, nil
		}
		if p, ok := s.providers["ollama"]; ok {
			return p, nil
		}
		return nil, fmt.Errorf("no default provider available")
	}

	p, ok := s.providers[strings.ToLower(name)]
	if !ok {
		return nil, fmt.Errorf("provider %s not found", name)
	}
	return p, nil
}

func (s *AIService) GetAvailableModels(ctx context.Context, providerName string) ([]string, error) {
	provider, err := s.getProvider(providerName)
	if err != nil {
		return nil, err
	}
	return provider.GetAvailableModels(ctx)
}

func (s *AIService) AnalyzeWorkload(ctx context.Context, req AnalyzeWorkloadRequest) (string, error) {
	provider, err := s.getProvider(req.Provider)
	if err != nil {
		return "", err
	}

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

	return provider.GenerateContent(ctx, prompt, req.Model)
}

func (s *AIService) GenerateRemediation(ctx context.Context, providerName, model, resourceKind, resourceName, errorLog string) (string, error) {
	provider, err := s.getProvider(providerName)
	if err != nil {
		return "", err
	}

	prompt := fmt.Sprintf(`
	You are a Kubernetes Expert.
	The resource %s/%s has the following error logs:
	%s

	Suggest a specific remediation action. 
	If it involves a YAML change, provide the YAML patch.
	Refer to potential root causes.
	`, resourceKind, resourceName, errorLog)

	return provider.GenerateContent(ctx, prompt, model)
}
