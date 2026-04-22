package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

const AzureDefaultModel = "gpt-4o"

type AzureOpenAIProvider struct {
	apiKey     string
	endpoint   string
	deployment string
	client     *http.Client
}

func NewAzureOpenAIProvider() *AzureOpenAIProvider {
	return &AzureOpenAIProvider{
		apiKey:     os.Getenv("AZURE_OPENAI_KEY"),
		endpoint:   os.Getenv("AZURE_OPENAI_ENDPOINT"),
		deployment: os.Getenv("AZURE_OPENAI_DEPLOYMENT"),
		client:     &http.Client{},
	}
}

func (p *AzureOpenAIProvider) Name() string {
	return "azure"
}

func (p *AzureOpenAIProvider) isAvailable() bool {
	return p.apiKey != "" && p.endpoint != "" && p.deployment != ""
}

type azureChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type azureChatRequest struct {
	Messages    []azureChatMessage     `json:"messages"`
	Temperature float64                `json:"temperature"`
	MaxTokens   int                    `json:"max_tokens"`
}

type azureChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func (p *AzureOpenAIProvider) GenerateContent(ctx context.Context, prompt string, model string) (string, error) {
	if !p.isAvailable() {
		return "", fmt.Errorf("Azure OpenAI is not configured")
	}

	reqBody := azureChatRequest{
		Messages: []azureChatMessage{
			{Role: "user", Content: prompt},
		},
		Temperature: 0.2,
		MaxTokens:   8192,
	}

	return p.doChatRequest(ctx, reqBody)
}

func (p *AzureOpenAIProvider) Chat(ctx context.Context, history []ChatMessage, message string, model string) (string, error) {
	if !p.isAvailable() {
		return "", fmt.Errorf("Azure OpenAI is not configured")
	}

	var messages []azureChatMessage
	for _, msg := range history {
		role := msg.Role
		if role == "model" || role == "ai" || role == "assistant" {
			role = "assistant"
		}
		messages = append(messages, azureChatMessage{Role: role, Content: msg.Content})
	}
	messages = append(messages, azureChatMessage{Role: "user", Content: message})

	reqBody := azureChatRequest{
		Messages:    messages,
		Temperature: 0.7,
		MaxTokens:   8192,
	}

	return p.doChatRequest(ctx, reqBody)
}

func (p *AzureOpenAIProvider) doChatRequest(ctx context.Context, reqBody azureChatRequest) (string, error) {
	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("%s/openai/deployments/%s/chat/completions?api-version=2024-02-01", p.endpoint, p.deployment)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api-key", p.apiKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("azure openai request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("azure openai error %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var azureResp azureChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&azureResp); err != nil {
		return "", fmt.Errorf("failed to decode azure response: %w", err)
	}

	if len(azureResp.Choices) == 0 {
		return "", fmt.Errorf("no response from Azure OpenAI")
	}

	return azureResp.Choices[0].Message.Content, nil
}

func (p *AzureOpenAIProvider) GetAvailableModels(ctx context.Context) ([]string, error) {
	return []string{
		"gpt-4o",
		"gpt-4o-mini",
		"gpt-4",
		"gpt-4-turbo",
	}, nil
}
