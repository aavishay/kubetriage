package ai

import (
	"context"
	"encoding/json"
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
	Provider      string   `json:"provider"` // "gemini" or "ollama"
	Model         string   `json:"model"`    // specific model like "llama3"
	WorkloadName  string   `json:"workloadName"`
	Status        string   `json:"status"`
	Playbook      string   `json:"playbook"`
	Instructions  string   `json:"instructions"`
	CpuUsage      string   `json:"cpuUsage"`
	CpuLimit      string   `json:"cpuLimit"`
	MemoryUsage   string   `json:"memoryUsage"`
	MemoryLimit   string   `json:"memoryLimit"`
	StorageUsage  string   `json:"storageUsage"`
	StorageLimit  string   `json:"storageLimit"`
	DiskIo        string   `json:"diskIo"`
	Logs          []string `json:"logs"`
	Events        []string `json:"events"`
	SchedulerLogs []string `json:"schedulerLogs"`
}

func (s *AIService) getProvider(name string) (AIProvider, error) {
	if name == "" {
		// Default preference: Ollama -> Gemini
		if p, ok := s.providers["ollama"]; ok {
			return p, nil
		}
		if p, ok := s.providers["gemini"]; ok {
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
    You are a Senior Site Reliability Engineer (SRE) performing a deep-dive diagnostic analysis of the Kubernetes workload "%s".
    
    **CONTEXT**:
    - **Status**: %s
    - **Playbook**: %s
    - **Instruction**: %s
    
    **TELEMETRY**:
    - CPU: %s / %s
    - RAM: %s / %s
    - Storage: %s / %s
    - Disk I/O: %s
    
    **LOGS & EVENTS**:
    Logs:
    %s
    
    Events:
    Events:
    %s
    
    **INFRASTRUCTURE LOGS (Karpenter/Scheduler)**:
    %s
    
    **OUTPUT REQUIREMENTS**:
    Produce a Highly Polished, Executive-Grade SRE Incident Report in Markdown.
    
    **STYLE GUIDELINES**:
    - Use H2 (##) for main sections.
    - Use bolding (**text**) for key metrics and findings.
    - Use bullet points for readability.
    - Keep paragraphs concise.
    - NO introductory filler (e.g., "Here is the report"). Start directly with the Executive Summary.
    
    **REQUIRED STRUCTURE**:
    
    ## 🚨 Executive Summary
    A concise 2-3 sentence TL;DR of the incident. State the primary failure mode clearly.
    
    ## 🔍 Root Cause Analysis
    Deduce the underlying technical cause based on logs and telemetry. Use critical thinking.
    - **Primary Cause**: The main reason for failure.
    - **Contributing Factors**: Any secondary issues (e.g., resource exhaustion, config errors).
    
    ## 📉 Impact Assessment
    - **Service Health**: Current operational state.
    - **User Experience**: Likely impact on end users (latency, errors, downtime).
    
    ## 🛠️ Remediation Plan
    1. **Immediate Action**: The first step to stabilize the service.
    2. **Secondary Step**: Follow-up action.
    3. **Long-term Fix**: Configuration or code change to prevent recurrence.
    
    ## 🔎 Verification
    Provide 1-2 kubectl commands to verify the state in a code block:
    `+"```bash"+`
    kubectl get pod ...
    `+"```"+`
	`,
		req.WorkloadName, req.Status, req.Playbook, req.Instructions,
		req.CpuUsage, req.CpuLimit, req.MemoryUsage, req.MemoryLimit, req.StorageUsage, req.StorageLimit, req.DiskIo,
		strings.Join(req.Logs, "\n"),
		strings.Join(req.Events, "\n"),
		strings.Join(req.SchedulerLogs, "\n"),
	)

	return provider.GenerateContent(ctx, prompt, req.Model)
}

type PatchSuggestion struct {
	Description  string `json:"description"`
	PatchType    string `json:"patchType"`    // e.g., "application/merge-patch+json"
	PatchContent string `json:"patchContent"` // The actual YAML/JSON patch
	Risk         string `json:"risk"`         // "Low", "Medium", "High"
	Reasoning    string `json:"reasoning"`
}

func (s *AIService) GenerateRemediation(ctx context.Context, providerName, model, resourceKind, resourceName, errorLog string) (*PatchSuggestion, error) {
	provider, err := s.getProvider(providerName)
	if err != nil {
		return nil, err
	}

	prompt := fmt.Sprintf(`
	You are a Kubernetes Expert.
	The resource %s/%s has the following error logs:
	%s

	Suggest a specific remediation action.
	Return ONLY a valid JSON object with the following structure, no other text:
	{
		"description": "Short title of the fix",
		"patchType": "application/merge-patch+json",
		"patchContent": "The YAML patch content as a string",
		"risk": "Low" | "Medium" | "High",
		"reasoning": "Brief explanation of why this fix is needed"
	}
	`, resourceKind, resourceName, errorLog)

	rawResponse, err := provider.GenerateContent(ctx, prompt, model)
	if err != nil {
		return nil, err
	}

	// Clean up potential markdown code blocks
	cleanResponse := strings.TrimSpace(rawResponse)
	cleanResponse = strings.TrimPrefix(cleanResponse, "```json")
	cleanResponse = strings.TrimPrefix(cleanResponse, "```")
	cleanResponse = strings.TrimSuffix(cleanResponse, "```")
	cleanResponse = strings.TrimSpace(cleanResponse)

	var suggestion PatchSuggestion
	// We need standard json package
	if err := json.Unmarshal([]byte(cleanResponse), &suggestion); err != nil {
		// Fallback: If JSON parsing fails, return a generic error or try to wrap the raw text
		log.Printf("Failed to parse LLM JSON response: %v. Raw: %s", err, rawResponse)
		// Attempt to return a generic "Manual Review" suggestion if parsing fails
		return &PatchSuggestion{
			Description:  "Manual Review Required",
			Reasoning:    "AI response could not be parsed structurally. See logs for details.",
			PatchContent: "# Failed to parse patch",
			Risk:         "High",
			PatchType:    "text/plain",
		}, nil
	}

	return &suggestion, nil
}

func (s *AIService) GenerateTopology(ctx context.Context, providerName, model, workloadSummary string) (string, error) {
	provider, err := s.getProvider(providerName)
	if err != nil {
		return "", err
	}

	prompt := fmt.Sprintf(`
	You are a Cloud Architecture Expert.
	Based on the following list of Kubernetes workloads, generate a Mermaid JS diagram (flowchart TB or graph TB) that visualizes the architecture.
	
	Workloads:
	%s
	
	GUIDELINES:
	- Use 'graph TB' or 'flowchart TB'
	- Group by Namespace using subgraphs.
	- Visualize connections if traffic patterns can be inferred (e.g. "web" -> "api" -> "db"), otherwise just show nodes.
	- Return ONLY the Mermaid code block. Do not include markdown ticks if possible, or I will strip them.
	`, workloadSummary)

	rawResponse, err := provider.GenerateContent(ctx, prompt, model)
	if err != nil {
		return "", err
	}

	// Clean up markdown
	cleanResponse := strings.TrimSpace(rawResponse)
	cleanResponse = strings.TrimPrefix(cleanResponse, "```mermaid")
	cleanResponse = strings.TrimPrefix(cleanResponse, "```")
	cleanResponse = strings.TrimSuffix(cleanResponse, "```")

	return strings.TrimSpace(cleanResponse), nil
}
