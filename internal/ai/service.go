package ai

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"
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

type ScalingInfo struct {
	Enabled           bool     `json:"enabled"`
	Min               int32    `json:"min"`
	Max               int32    `json:"max"`
	Current           int32    `json:"current"`
	KedaReady         bool     `json:"kedaReady"`
	Active            bool     `json:"active"`
	Fallback          bool     `json:"fallback"`
	Paused            bool     `json:"paused"`
	Triggers          []string `json:"triggers"`
	Misconfigurations []string `json:"misconfigurations,omitempty"`
}

type ProvisioningInfo struct {
	Enabled           bool     `json:"enabled"`
	NodePools         []string `json:"nodePools"`
	NodeClaims        []string `json:"nodeClaims"`
	Misconfigurations []string `json:"misconfigurations,omitempty"`
}

// AnalyzeWorkloadRequest mirrors the frontend data structure
type AnalyzeWorkloadRequest struct {
	Provider      string            `json:"provider"` // "gemini" or "ollama"
	Model         string            `json:"model"`    // specific model like "llama3"
	WorkloadName  string            `json:"workloadName"`
	Namespace     string            `json:"namespace"`
	Kind          string            `json:"kind"`
	Status        string            `json:"status"`
	Playbook      string            `json:"playbook"`
	Instructions  string            `json:"instructions"`
	CpuUsage      string            `json:"cpuUsage"`
	CpuLimit      string            `json:"cpuLimit"`
	MemoryUsage   string            `json:"memoryUsage"`
	MemoryLimit   string            `json:"memoryLimit"`
	StorageUsage  string            `json:"storageUsage"`
	StorageLimit  string            `json:"storageLimit"`
	DiskIo        string            `json:"diskIo"`
	Logs          []string          `json:"logs"`
	Events        []string          `json:"events"`
	SchedulerLogs []string          `json:"schedulerLogs"`
	Scaling       *ScalingInfo      `json:"scaling,omitempty"`
	Provisioning  *ProvisioningInfo `json:"provisioning,omitempty"`
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

	scalingEnabled := false
	scalingMin := int32(0)
	scalingMax := int32(0)
	scalingCurrent := int32(0)
	scalingReady := false
	scalingActive := false
	scalingFallback := false
	scalingPaused := false
	scalingTriggers := "None"
	scalingMisconfigs := "None detected"

	if req.Scaling != nil {
		scalingEnabled = req.Scaling.Enabled
		scalingMin = req.Scaling.Min
		scalingMax = req.Scaling.Max
		scalingCurrent = req.Scaling.Current
		scalingReady = req.Scaling.KedaReady
		scalingActive = req.Scaling.Active
		scalingFallback = req.Scaling.Fallback
		scalingPaused = req.Scaling.Paused
		if len(req.Scaling.Triggers) > 0 {
			scalingTriggers = strings.Join(req.Scaling.Triggers, ", ")
		}
		if len(req.Scaling.Misconfigurations) > 0 {
			scalingMisconfigs = strings.Join(req.Scaling.Misconfigurations, " | ")
		}
	}

	provEnabled := false
	provNodePools := "None"
	provNodeClaims := "None"
	provMisconfigs := "None detected"

	if req.Provisioning != nil {
		provEnabled = req.Provisioning.Enabled
		if len(req.Provisioning.NodePools) > 0 {
			provNodePools = strings.Join(req.Provisioning.NodePools, ", ")
		}
		if len(req.Provisioning.NodeClaims) > 0 {
			provNodeClaims = strings.Join(req.Provisioning.NodeClaims, ", ")
		}
		if len(req.Provisioning.Misconfigurations) > 0 {
			provMisconfigs = strings.Join(req.Provisioning.Misconfigurations, " | ")
		}
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
    
    **SCALING (HPA/KEDA)**:
    - Enabled: %v
    - Replicas: %d Min / %d Max / %d Current
    - Scaling Ready: %v
    - Active: %v
    - Fallback: %v
    - Paused: %v
    - Triggers: %s
    - Known Misconfigurations: %s
    
    **PROVISIONING (Karpenter)**:
    - Enabled: %v
    - NodePools: %s
    - Pending NodeClaims: %s
    - Known Misconfigurations: %s
    
    **LOGS & EVENTS**:
    Logs:
    %s
    
    Events:
    Events:
    %s
    
    **INFRASTRUCTURE LOGS (Karpenter/Scheduler)**:
    %s
    
    **SRE INTERPRETATION NOTES**:
    - If Min Replicas is **0**, this workload is likely configured for **Scale to Zero (Cost Optimization)**. If current replicas are 0, this is expected behavior and not a failure unless logs indicate a trigger failed to fire.
    
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
    Deduce the underlying technical cause based on logs, telemetry, and scaling status. Use critical thinking.
    - **Primary Cause**: The main reason for failure (e.g., trigger misconfiguration, resource exhaustion).
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
		scalingEnabled, scalingMin, scalingMax, scalingCurrent, scalingReady,
		scalingActive, scalingFallback, scalingPaused, scalingTriggers, scalingMisconfigs,
		provEnabled, provNodePools, provNodeClaims, provMisconfigs,
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

func (s *AIService) GenerateRemediation(ctx context.Context, providerName, model, resourceKind, resourceName, errorLog, analysis string) (*PatchSuggestion, error) {
	provider, err := s.getProvider(providerName)
	if err != nil {
		return nil, err
	}

	analysisContext := ""
	if analysis != "" {
		analysisContext = fmt.Sprintf("\n\tDiagnostic Analysis (RCA) from SRE:\n\t%s\n", analysis)
	}

	prompt := fmt.Sprintf(`
	You are a Kubernetes Expert.
	The resource %s/%s has the following error logs:
	%s
	%s
	Based on the logs and the provided analysis (if any), suggest a specific remediation action.
	
	OUTPUT FORMAT INSTRUCTIONS:
	Do NOT return JSON. Return a structured text block exactly as follows:

	---BEGIN_REMEDIATION---
	DESCRIPTION: <Short title of the fix>
	RISK: <Low/Medium/High>
	REASONING: <Brief explanation of why this fix is needed>
	PATCH:
	<The complete YAML patch content. Can be multi-line>
	---END_REMEDIATION---
	
	Example:
	---BEGIN_REMEDIATION---
	DESCRIPTION: Increase Memory Limit
	RISK: Low
	REASONING: Pod is OOMKilled.
	PATCH:
	spec:
	  template:
	    spec:
	      containers:
	      - name: my-app
	        resources:
	          limits:
	            memory: "512Mi"
	---END_REMEDIATION---
	`, resourceKind, resourceName, errorLog, analysisContext)

	rawResponse, err := provider.GenerateContent(ctx, prompt, model)
	if err != nil {
		return nil, err
	}

	cleanResponse := strings.TrimSpace(rawResponse)

	// Custom Text Parser
	var suggestion PatchSuggestion
	suggestion.PatchType = "application/strategic-merge-patch+yaml" // Default

	// defined markers
	startMarker := "---BEGIN_REMEDIATION---"
	endMarker := "---END_REMEDIATION---"

	startIndex := strings.Index(cleanResponse, startMarker)
	if startIndex != -1 {
		cleanResponse = cleanResponse[startIndex+len(startMarker):]
	}
	endIndex := strings.LastIndex(cleanResponse, endMarker)
	if endIndex != -1 {
		cleanResponse = cleanResponse[:endIndex]
	}

	lines := strings.Split(cleanResponse, "\n")
	currentSection := ""
	var patchBuilder strings.Builder

	for _, line := range lines {
		trimmedLine := strings.TrimSpace(line)
		if trimmedLine == "" && currentSection != "PATCH" {
			continue
		}

		if strings.HasPrefix(trimmedLine, "DESCRIPTION:") {
			suggestion.Description = strings.TrimSpace(strings.TrimPrefix(trimmedLine, "DESCRIPTION:"))
			currentSection = "DESCRIPTION"
		} else if strings.HasPrefix(trimmedLine, "RISK:") {
			suggestion.Risk = strings.TrimSpace(strings.TrimPrefix(trimmedLine, "RISK:"))
			currentSection = "RISK"
		} else if strings.HasPrefix(trimmedLine, "REASONING:") {
			suggestion.Reasoning = strings.TrimSpace(strings.TrimPrefix(trimmedLine, "REASONING:"))
			currentSection = "REASONING"
		} else if strings.HasPrefix(trimmedLine, "PATCH:") {
			currentSection = "PATCH"
			continue
		} else {
			// Content handling
			if currentSection == "PATCH" {
				patchBuilder.WriteString(line + "\n")
			} else if currentSection == "REASONING" && suggestion.Reasoning != "" {
				// Append multi-line reasoning if needed, though usually one line in simple format
				suggestion.Reasoning += " " + trimmedLine
			}
		}
	}

	suggestion.PatchContent = strings.TrimSpace(patchBuilder.String())

	// Fallback validation
	if suggestion.Description == "" || suggestion.PatchContent == "" {
		log.Printf("Failed to parse AI Text response. Raw: %s", rawResponse)
		return &PatchSuggestion{
			Description:  "Manual Review Required",
			Reasoning:    "AI response format was invalid. See logs.",
			PatchContent: "# Failed to parse patch from text format",
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
	You are a Cloud Architecture Expert specializing in Kubernetes.
	Based on the list of workloads below, generate a Mermaid JS diagram to visualize the architecture.
	
	Workloads:
	%s
	
	Strict Mermaid Syntax Requirements:
	- Diagram Type: 'flowchart TB'
	- Use 'subgraph' to group workloads by Namespace.
	- Node IDs: MUST be STRICTLY alphanumeric snake_case (e.g., frontend_api, redis_cache). 
	    - ABSOLUTELY NO hyphens ('-') in Node IDs. Use underscores ('_') instead.
	    - ABSOLUTELY NO dots ('.') in Node IDs.
	- Display Names: Use brackets for display names which CAN contain hyphens (e.g., node_id["Original-Name"]).
	- Connections: Infer traffic patterns (e.g., frontend calls backend, backend calls db).
	
	Output Format:
	- Return ONLY the Mermaid code block.
	- DO NOT include ANY introductory text, concluding remarks, or side explanations.
	- Wrap the Mermaid code in a markdown block: `+"```mermaid"+` [CODE] `+"```"+`.
	
	Example Output Pattern:
	`+"```mermaid"+`
	flowchart TB
	  subgraph ns_prod [production]
	    app_v1["app-v1"] --> db_prod["db-main"]
	  end
	`+"```"+`
	`, workloadSummary)

	// Enforce a timeout for Diagram Generation (slow local LLMs might hang)
	ctxWithTimeout, cancel := context.WithTimeout(ctx, 45*time.Second) // Increased for complex graphs
	defer cancel()

	rawResponse, err := provider.GenerateContent(ctxWithTimeout, prompt, model)
	if err != nil {
		log.Printf("ERROR: AI Provider %s failed: %v. Falling back to Mock Diagram.", providerName, err)
		// Fallback for Demo/Dev - Simplified Syntax
		return `flowchart TB
    subgraph Mock_Namespace
        direction TB
        demo_app["Demo App"] --> demo_db["Demo DB"]
        demo_app --> demo_cache["Redis Cache"]
    end`, nil
	}

	// Clean up potentially messy AI response
	cleanResponse := strings.TrimSpace(rawResponse)

	// Robust code block extraction
	// 1. Look for ```mermaid ... ```
	if start := strings.Index(cleanResponse, "```mermaid"); start != -1 {
		cleanResponse = cleanResponse[start+10:]
		if end := strings.LastIndex(cleanResponse, "```"); end != -1 {
			cleanResponse = cleanResponse[:end]
		}
	} else if start := strings.Index(cleanResponse, "```"); start != -1 {
		// 2. Fallback to generic ``` ... ```
		cleanResponse = cleanResponse[start+3:]
		if end := strings.LastIndex(cleanResponse, "```"); end != -1 {
			cleanResponse = cleanResponse[:end]
		}
	}

	cleanResponse = strings.TrimSpace(cleanResponse)

	// Final Sanitization: Ensure it starts with a valid Mermaid header if it looks like just nodes
	if !strings.HasPrefix(cleanResponse, "flowchart") &&
		!strings.HasPrefix(cleanResponse, "graph") &&
		!strings.HasPrefix(cleanResponse, "sequenceDiagram") &&
		!strings.HasPrefix(cleanResponse, "classDiagram") {
		// If it's missing a header but has content, prepend a default flowchart header
		if len(cleanResponse) > 0 {
			cleanResponse = "flowchart TB\n" + cleanResponse
		}
	}

	log.Printf("DEBUG: Cleaned Mermaid Response: \n%s", cleanResponse)
	return cleanResponse, nil
}
