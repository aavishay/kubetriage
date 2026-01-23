package ai

import "context"

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// AIProvider defines the interface for different AI backends (Gemini, Ollama, etc.)
type AIProvider interface {
	GenerateContent(ctx context.Context, prompt string, model string) (string, error)
	Chat(ctx context.Context, history []ChatMessage, message string, model string) (string, error)
	GetAvailableModels(ctx context.Context) ([]string, error)
	Name() string
}
