package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const BedrockDefaultModel = "anthropic.claude-3-sonnet-20240229-v1:0"

type BedrockProvider struct {
	accessKeyID     string
	secretAccessKey string
	region          string
	modelID         string
	client          *http.Client
}

func NewBedrockProvider() *BedrockProvider {
	return &BedrockProvider{
		accessKeyID:     os.Getenv("AWS_ACCESS_KEY_ID"),
		secretAccessKey: os.Getenv("AWS_SECRET_ACCESS_KEY"),
		region:          getEnvOrDefault("AWS_REGION", "us-east-1"),
		modelID:         getEnvOrDefault("AWS_BEDROCK_MODEL_ID", BedrockDefaultModel),
		client:          &http.Client{Timeout: 60 * time.Second},
	}
}

func (p *BedrockProvider) Name() string {
	return "bedrock"
}

func (p *BedrockProvider) isAvailable() bool {
	return p.accessKeyID != "" && p.secretAccessKey != "" && p.region != ""
}

type bedrockMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type bedrockRequest struct {
	AnthropicVersion string           `json:"anthropic_version"`
	MaxTokens        int              `json:"max_tokens"`
	Messages         []bedrockMessage `json:"messages"`
	Temperature      float64          `json:"temperature"`
}

type bedrockResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

func (p *BedrockProvider) GenerateContent(ctx context.Context, prompt string, model string) (string, error) {
	if !p.isAvailable() {
		return "", fmt.Errorf("AWS Bedrock is not configured")
	}

	reqBody := bedrockRequest{
		AnthropicVersion: "bedrock-2023-05-31",
		MaxTokens:        8192,
		Messages: []bedrockMessage{
			{Role: "user", Content: prompt},
		},
		Temperature: 0.2,
	}

	return p.doRequest(ctx, reqBody, model)
}

func (p *BedrockProvider) Chat(ctx context.Context, history []ChatMessage, message string, model string) (string, error) {
	if !p.isAvailable() {
		return "", fmt.Errorf("AWS Bedrock is not configured")
	}

	var messages []bedrockMessage
	for _, msg := range history {
		role := msg.Role
		if role == "model" || role == "ai" || role == "assistant" {
			role = "assistant"
		}
		messages = append(messages, bedrockMessage{Role: role, Content: msg.Content})
	}
	messages = append(messages, bedrockMessage{Role: "user", Content: message})

	reqBody := bedrockRequest{
		AnthropicVersion: "bedrock-2023-05-31",
		MaxTokens:        8192,
		Messages:         messages,
		Temperature:      0.7,
	}

	return p.doRequest(ctx, reqBody, model)
}

func (p *BedrockProvider) doRequest(ctx context.Context, reqBody bedrockRequest, model string) (string, error) {
	modelID := p.modelID
	if model != "" {
		modelID = model
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("https://bedrock-runtime.%s.amazonaws.com/model/%s/invoke", p.region, modelID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-amz-access-key-id", p.accessKeyID)
	req.Header.Set("x-amz-secret-access-key", p.secretAccessKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("bedrock request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("bedrock error %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var bedrockResp bedrockResponse
	if err := json.NewDecoder(resp.Body).Decode(&bedrockResp); err != nil {
		return "", fmt.Errorf("failed to decode bedrock response: %w", err)
	}

	var result string
	for _, c := range bedrockResp.Content {
		if c.Type == "text" {
			result += c.Text
		}
	}

	if result == "" {
		return "", fmt.Errorf("no text content in bedrock response")
	}

	return result, nil
}

func (p *BedrockProvider) GetAvailableModels(ctx context.Context) ([]string, error) {
	return []string{
		"anthropic.claude-3-5-sonnet-20241022-v2:0",
		"anthropic.claude-3-sonnet-20240229-v1:0",
		"anthropic.claude-3-haiku-20240307-v1:0",
		"meta.llama3-70b-instruct-v1:0",
		"amazon.titan-text-express-v1",
	}, nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}
