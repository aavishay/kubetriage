package ai

import "context"

// AIProvider defines the interface for different AI backends (Gemini, Ollama, etc.)
type AIProvider interface {
	GenerateContent(ctx context.Context, prompt string, model string) (string, error)
	GetAvailableModels(ctx context.Context) ([]string, error)
	Name() string
}
