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

type GeminiProvider struct {
	client *genai.Client
	model  string
}

func NewGeminiProvider(ctx context.Context) (*GeminiProvider, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY is not set")
	}

	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return nil, err
	}

	return &GeminiProvider{
		client: client,
		model:  GeminiProModel,
	}, nil
}

func (p *GeminiProvider) Name() string {
	return "gemini"
}

func (p *GeminiProvider) Close() {
	if p.client != nil {
		p.client.Close()
	}
}

func (p *GeminiProvider) GenerateContent(ctx context.Context, prompt string, modelName string) (string, error) {
	targetModel := p.model
	if modelName != "" {
		targetModel = modelName
	}
	model := p.client.GenerativeModel(targetModel)

	// Increase output token limit for large diagrams
	model.SetMaxOutputTokens(8192)
	model.SetTemperature(0.2) // Low temperature for deterministic diagrams

	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", err
	}

	return getResponseText(resp), nil
}

func (p *GeminiProvider) Chat(ctx context.Context, history []ChatMessage, message string, modelName string) (string, error) {
	targetModel := p.model
	if modelName != "" {
		targetModel = modelName
	}
	model := p.client.GenerativeModel(targetModel)
	cs := model.StartChat()

	// Convert history
	for _, msg := range history {
		role := "user"
		if msg.Role == "model" || msg.Role == "ai" || msg.Role == "assistant" {
			role = "model"
		}
		cs.History = append(cs.History, &genai.Content{
			Role:  role,
			Parts: []genai.Part{genai.Text(msg.Content)},
		})
	}

	resp, err := cs.SendMessage(ctx, genai.Text(message))
	if err != nil {
		return "", err
	}

	return getResponseText(resp), nil
}

func (p *GeminiProvider) GetAvailableModels(ctx context.Context) ([]string, error) {
	// For now, return hardcoded known models as listing all Google models might be too much noise
	// or we can implement p.client.ListModels(ctx) if desired later.
	return []string{GeminiProModel, GeminiFastModel}, nil
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
