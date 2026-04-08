package ai

import (
	"context"
	"fmt"
	"log"
	"regexp"
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
	ClusterID     string            `json:"clusterId"`
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
	Yaml          string            `json:"yaml"`    // The manifest of the workload
	Metrics       string            `json:"metrics"` // Historical metrics as a text table/summary
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
	// Add timeout to prevent hanging indefinitely (10 minutes for local CPU-based Ollama)
	ctx, cancel := context.WithTimeout(ctx, 600*time.Second)
	defer cancel()

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

	// Truncate logs and events to avoid massive context size
	safeLogs := req.Logs
	if len(safeLogs) > 20 {
		safeLogs = safeLogs[len(safeLogs)-20:]
	}
	safeEvents := req.Events
	if len(safeEvents) > 20 {
		safeEvents = safeEvents[len(safeEvents)-20:]
	}
	safeSchedulerLogs := req.SchedulerLogs
	if len(safeSchedulerLogs) > 20 {
		safeSchedulerLogs = safeSchedulerLogs[len(safeSchedulerLogs)-20:]
	}

	prompt := fmt.Sprintf(`
    You are a Senior Site Reliability Engineer (SRE) performing a deep-dive diagnostic analysis of the Kubernetes workload "%s".
    
    **CONTEXT**:
    - **Status**: %s
    - **Playbook**: %s
    - **Instruction**: %s
    
    **TELEMETRY**:
    - CPU: %s Cores / %s Cores (Limit)
    - RAM: %s MiB / %s MiB (Limit)
    - Storage: %s GiB / %s GiB (Limit)
    - Disk I/O: %s
    
    **HISTORICAL METRICS (Trend)**:
    %s
    
    **YAML MANIFEST (Current State)**:
    %s
    
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
		req.Metrics, req.Yaml,
		scalingEnabled, scalingMin, scalingMax, scalingCurrent, scalingReady,
		scalingActive, scalingFallback, scalingPaused, scalingTriggers, scalingMisconfigs,
		provEnabled, provNodePools, provNodeClaims, provMisconfigs,
		strings.Join(safeLogs, "\n"),
		strings.Join(safeEvents, "\n"),
		strings.Join(safeSchedulerLogs, "\n"),
	)

	return provider.GenerateContent(ctx, prompt, req.Model)
}

func (s *AIService) Chat(ctx context.Context, providerName string, model string, history []ChatMessage, message string) (string, error) {
	provider, err := s.getProvider(providerName)
	if err != nil {
		return "", err
	}

	// 1. Initial Injection of System Prompt + Agent Tools (if brand new session)
	// For now, we prepend it to the history if it's empty, or trust the user instructions
	// A robust way: Add System prompt as the VERY first message if not present.
	agentSystemPrompt := GenerateAgentSystemPrompt()

	// Create a working history slice
	workingHistory := make([]ChatMessage, len(history))
	copy(workingHistory, history)

	// 2. The Agent Loop
	// We allow up to 5 turns to prevent infinite loops
	maxTurns := 5
	currentMessage := message

	for i := 0; i < maxTurns; i++ {
		// Construct the context for this specific turn
		// We always prepend the System Prompt to ensure the Agent knows its tools
		// regardless of how long the conversation gets.
		turnHistory := make([]ChatMessage, 0, len(workingHistory)+2)
		turnHistory = append(turnHistory, ChatMessage{Role: "user", Content: "SYSTEM: " + agentSystemPrompt})
		turnHistory = append(turnHistory, workingHistory...)

		response, err := provider.Chat(ctx, turnHistory, currentMessage, model)
		if err != nil {
			return "", err
		}

		// Check for TOOL_CALL
		if strings.Contains(response, "TOOL_CALL:") {
			// Find the line
			lines := strings.Split(response, "\n")
			var toolOutput strings.Builder
			toolCalled := false

			for _, line := range lines {
				if strings.HasPrefix(strings.TrimSpace(line), "TOOL_CALL:") {
					toolCalled = true
					cmd := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), "TOOL_CALL:"))
					parts := strings.Fields(cmd)
					if len(parts) > 0 {
						toolName := parts[0]
						args := parts[1:]

						if tool, exists := AgentTools[toolName]; exists {
							log.Printf("🤖 Agent executing tool: %s args: %v", toolName, args)
							result, err := tool.Execute(args)
							if err != nil {
								toolOutput.WriteString(fmt.Sprintf("\nTOOL_ERROR (%s): %v\n", toolName, err))
							} else {
								toolOutput.WriteString(fmt.Sprintf("\nTOOL_RESULT (%s): %s\n", toolName, result))
							}
						} else {
							toolOutput.WriteString(fmt.Sprintf("\nTOOL_ERROR: Unknown tool '%s'\n", toolName))
						}
					}
				}
			}

			if toolCalled {
				// Add the AI's "Thought" (the tool call) to history so it knows what it asked
				workingHistory = append(workingHistory, ChatMessage{Role: "user", Content: currentMessage}) // User request
				workingHistory = append(workingHistory, ChatMessage{Role: "model", Content: response})      // AI Tool Call

				// Prepare next input (Tool Result)
				currentMessage = "SYSTEM: " + toolOutput.String()
				continue // Loop again with tool results
			}
		}

		// No tool call? Return the final answer.
		return response, nil
	}

	return "I'm detecting a loop in my reasoning. Please try refining your query.", nil
}

type PatchSuggestion struct {
	Description  string `json:"description"`
	PatchType    string `json:"patchType"`    // e.g., "application/merge-patch+json"
	PatchContent string `json:"patchContent"` // The actual YAML/JSON patch
	Risk         string `json:"risk"`         // "Low", "Medium", "High"
	Reasoning    string `json:"reasoning"`
}

func (s *AIService) GenerateRemediation(ctx context.Context, providerName, model, resourceKind, resourceName, errorLog, analysis, currentImages string) (*PatchSuggestion, error) {
	provider, err := s.getProvider(providerName)
	if err != nil {
		return nil, err
	}

	analysisContext := ""
	if analysis != "" {
		analysisContext = fmt.Sprintf("\n\tDiagnostic Analysis (RCA) from SRE:\n\t%s\n", analysis)
	}

	imagesContext := ""
	if currentImages != "" {
		imagesContext = fmt.Sprintf("\n\tCURRENT CONTAINER IMAGES (Use these EXACTLY, do NOT use placeholders):\n\t%s\n", currentImages)
	}

	prompt := fmt.Sprintf(`
	You are a Kubernetes Expert.
	The resource %s/%s has the following error logs:
	%s
	%s
	%s
	Based on the logs and the provided analysis (if any), suggest a specific remediation action.
	
	IMPORTANT:
	- If the remediation involves updating the pod spec (e.g., resources, env vars), you MUST use the CURRENT IMAGES provided above.
	- NEVER use placeholders like "<image-name>". Use the actual image string from the context.
	
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
	---END_REMEDIATION---
	---END_REMEDIATION---
	`, resourceKind, resourceName, errorLog, analysisContext, imagesContext)

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

		// Robust Stop Condition: If we see the end marker (or something close to it)
		// Stop processing immediately to avoid leaking footer text into Patch content.
		if strings.Contains(trimmedLine, "END_REMEDIATION") {
			break
		}

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

func (s *AIService) GenerateTopology(ctx context.Context, providerName, model, workloadSummary, incidentSummary string) (string, error) {
	provider, err := s.getProvider(providerName)
	if err != nil {
		return "", err
	}

	incidentContext := ""
	if incidentSummary != "" {
		incidentContext = fmt.Sprintf("\n\tACTIVE INCIDENTS (Highlight these nodes):\n\t%s\n", incidentSummary)
	}

	prompt := fmt.Sprintf(`
	You are a Cloud Architecture Expert specializing in Kubernetes.
	Based on the list of workloads and active incidents below, generate a Mermaid JS diagram to visualize the architecture.
	
	Workloads:
	%s
	%s
	
	Strict Mermaid Syntax Requirements:
	- Diagram Type: 'flowchart TB'
	- Use 'subgraph' to group workloads by Namespace.
	- Node IDs: MUST be STRICTLY alphanumeric snake_case.
	    - **CRITICAL**: PREPEND THE NAMESPACE to the Node ID (e.g., ns_prod_my_app).
	- Connections: Infer traffic patterns. Use simple arrows '-->'.
	- No Edge Labels: DO NOT add text labels to arrows.
	
	REACTIVE STYLING (Live War Room Mode):
	- Define CSS classes at the top of the diagram:
	    classDef critical fill:#f43f5e,stroke:#fff,stroke-width:2px,color:#fff;
	    classDef warning fill:#fbbf24,stroke:#fff,stroke-width:1px,color:#000;
	- Apply classes to nodes with active incidents:
	    - Use 'critical' for 'Critical' or 'High' severity incidents.
	    - Use 'warning' for 'Warning' or 'Medium' severity incidents.
	- Example: class ns_prod_app_v1 critical;
	
	Output Format:
	- Return ONLY the Mermaid code block.
	- Wrap in `+"```mermaid"+` [CODE] `+"```"+`.
	`, workloadSummary, incidentContext)

	// Enforce a timeout for Diagram Generation (slow local LLMs might hang)
	ctxWithTimeout, cancel := context.WithTimeout(ctx, 180*time.Second) // Increased for complex graphs
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

	// --- TRUNCATION REPAIR START ---
	// Check if the output seems truncated (doesn't end with "end" or a closing bracket/parenthesis if it's a node)
	// Actually, robust way: Count "subgraph" vs "end".
	lines := strings.Split(cleanResponse, "\n")
	if len(lines) > 0 {
		subgraphCount := 0
		endCount := 0
		for _, line := range lines {
			if strings.Contains(line, "subgraph ") {
				subgraphCount++
			}
			if strings.TrimSpace(line) == "end" {
				endCount++
			}
		}

		if subgraphCount > endCount {
			log.Printf("DEBUG: Detected truncated Mermaid output. Subgraphs: %d, Ends: %d. Repairing...", subgraphCount, endCount)

			// 1. Remove the last line as it might be half-written
			if len(lines) > 0 {
				lines = lines[:len(lines)-1]
			}

			// 2. Add missing "end"s
			needed := subgraphCount - endCount
			for i := 0; i < needed; i++ {
				lines = append(lines, "  end")
			}
			cleanResponse = strings.Join(lines, "\n")
		}
	}
	// --- TRUNCATION REPAIR END ---

	// Sanitization 0: Fix common Subgraph syntax error (missing space before title)
	// patterns like: subgraph foo[bar] -> subgraph foo [bar]
	reSubgraph := regexp.MustCompile(`subgraph\s+([a-zA-Z0-9_\-]+)\[`)
	cleanResponse = reSubgraph.ReplaceAllString(cleanResponse, "subgraph $1 [")

	// Sanitization 1: Remove any edge labels (-->|label|) to prevent syntax errors
	// Matches -->|...| and replaces with -->
	reEdgeLabels := regexp.MustCompile(`-->\|[^|]+\|`)
	cleanResponse = reEdgeLabels.ReplaceAllString(cleanResponse, "-->")

	// Sanitization 2: Fix hyphenated Subgraph IDs (Critical for Mermaid)
	// Expl: "subgraph kube-system" is interpreted as "kube minus system". Must be "kube_system".
	// We capture: subgraph (ID) [Title] OR subgraph (ID)
	// We'll iterate and replace non-alphanumeric chars in the ID part.
	reSubgraphIDs := regexp.MustCompile(`subgraph\s+([a-zA-Z0-9_\-]+)`)
	cleanResponse = reSubgraphIDs.ReplaceAllStringFunc(cleanResponse, func(match string) string {
		parts := strings.Fields(match)
		if len(parts) >= 2 {
			id := parts[1]
			safeID := strings.ReplaceAll(id, "-", "_")
			safeID = strings.ReplaceAll(safeID, ".", "_")
			return "subgraph " + safeID
		}
		return match
	})

	// Final Sanitization: Ensure it starts with a valid Mermaid header
	// We use regex to check if a header exists, ignoring comments (%% ...) and whitespace
	reHeader := regexp.MustCompile(`(?i)^\s*(?:%%.*[\r\n]+)*\s*(flowchart|graph|sequenceDiagram|classDiagram|erDiagram|stateDiagram)`)
	if !reHeader.MatchString(cleanResponse) {
		// If it's missing a header but has content, prepend a default flowchart header
		if len(cleanResponse) > 0 {
			cleanResponse = "flowchart TB\n" + cleanResponse
		}
	}

	log.Printf("DEBUG: Cleaned Mermaid Response: \n%s", cleanResponse)
	return cleanResponse, nil
}
