package ai

import (
	"fmt"
	"strings"
	"time"
)

type ValidationRisk string

const (
	RiskLow    ValidationRisk = "Low"
	RiskMedium ValidationRisk = "Medium"
	RiskHigh   ValidationRisk = "High"
)

type PatchSuggestion struct {
	Description  string         `json:"description"`
	PatchType    string         `json:"patchType"` // "application/json-patch+json" or "application/merge-patch+json"
	PatchContent string         `json:"patchContent"`
	Risk         ValidationRisk `json:"risk"`
	Reasoning    string         `json:"reasoning"`
}

// GenerateRemediation simulates calling Gemini to fix an issue
func GenerateRemediation(resourceKind, resourceName, errorLog string) (*PatchSuggestion, error) {
	// Mock Delay
	time.Sleep(1500 * time.Millisecond)

	// Simple heuristic mock for demo purposes
	if strings.Contains(strings.ToLower(errorLog), "oomkilled") || strings.Contains(strings.ToLower(errorLog), "memory") {
		return &PatchSuggestion{
			Description:  fmt.Sprintf("Increase memory limit for %s", resourceName),
			PatchType:    "application/merge-patch+json",
			PatchContent: `{"spec":{"template":{"spec":{"containers":[{"name":"app","resources":{"limits":{"memory":"1Gi"}}}]}}}}`,
			Risk:         RiskLow,
			Reasoning:    "The application was crashing due to OOM (Out of Memory). Increasing the limit to 1Gi should stabilize it.",
		}, nil
	}

	if strings.Contains(strings.ToLower(errorLog), "crashloopbackoff") {
		return &PatchSuggestion{
			Description:  "Update image tag to stable",
			PatchType:    "application/merge-patch+json",
			PatchContent: `{"spec":{"template":{"spec":{"containers":[{"name":"app","image":"myapp:stable"}]}}}}`,
			Risk:         RiskMedium,
			Reasoning:    "CrashLoops often indicate a bad config or binary. Rolling back to 'stable' tag is recommended.",
		}, nil
	}

	// Default Generic Patch
	return &PatchSuggestion{
		Description:  "Restart Deployment",
		PatchType:    "application/merge-patch+json",
		PatchContent: `{"spec":{"template":{"metadata":{"annotations":{"kubectl.kubernetes.io/restartedAt":"` + time.Now().Format(time.RFC3339) + `" }}}}}`,
		Risk:         RiskLow,
		Reasoning:    "No specific error matched. A rolling restart often clears transient state issues.",
	}, nil
}
