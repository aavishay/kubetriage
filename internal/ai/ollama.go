package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

type OllamaProvider struct {
	BaseURL string
	Model   string
}

func NewOllamaProvider() *OllamaProvider {
	baseURL := os.Getenv("OLLAMA_HOST")
	if baseURL == "" {
		baseURL = "http://127.0.0.1:11434" // Default for local dev
	}
	model := os.Getenv("OLLAMA_MODEL")
	if model == "" {
		model = "llama3:latest"
	}
	baseURL = strings.TrimSuffix(baseURL, "/")
	return &OllamaProvider{
		BaseURL: baseURL,
		Model:   model,
	}
}

func (p *OllamaProvider) Name() string {
	return "ollama"
}

type OllamaRequest struct {
	Model   string                 `json:"model"`
	Prompt  string                 `json:"prompt"`
	Stream  bool                   `json:"stream"`
	Options map[string]interface{} `json:"options,omitempty"`
}

type OllamaResponse struct {
	Response string `json:"response"`
	Done     bool   `json:"done"`
}

func (p *OllamaProvider) GenerateContent(ctx context.Context, prompt string, model string) (string, error) {
	modelToUse := p.Model
	if model != "" {
		modelToUse = model
	}

	reqBody := OllamaRequest{
		Model:  modelToUse,
		Prompt: prompt,
		Stream: false,
		Options: map[string]interface{}{
			"num_predict": 16384, // Increase context window for large diagrams
			"temperature": 0.2,
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.BaseURL+"/api/generate", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("ollama connection failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("ollama API error: %s - %s", resp.Status, string(bodyBytes))
	}

	var ollamaResp OllamaResponse
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		return "", fmt.Errorf("failed to decode ollama response: %v", err)
	}

	return ollamaResp.Response, nil
}

type OllamaTagsResponse struct {
	Models []struct {
		Name string `json:"name"`
	} `json:"models"`
}

func (p *OllamaProvider) GetAvailableModels(ctx context.Context) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", p.BaseURL+"/api/tags", nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to list ollama models: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ollama API error: %s", resp.Status)
	}

	var tagsResp OllamaTagsResponse
	if err := json.NewDecoder(resp.Body).Decode(&tagsResp); err != nil {
		return nil, fmt.Errorf("failed to decode ollama tags: %v", err)
	}

	var models []string
	for _, m := range tagsResp.Models {
		models = append(models, m.Name)
	}
	return models, nil
}

type OllamaChatRequest struct {
	Model    string                 `json:"model"`
	Messages []ChatMessage          `json:"messages"`
	Stream   bool                   `json:"stream"`
	Options  map[string]interface{} `json:"options,omitempty"`
}

type OllamaChatResponse struct {
	Model     string      `json:"model"`
	CreatedAt string      `json:"created_at"`
	Message   ChatMessage `json:"message"`
	Done      bool        `json:"done"`
}

func (p *OllamaProvider) Chat(ctx context.Context, history []ChatMessage, message string, model string) (string, error) {
	modelToUse := p.Model
	if model != "" {
		modelToUse = model
	}

	messages := append([]ChatMessage{}, history...)
	messages = append(messages, ChatMessage{Role: "user", Content: message})

	reqBody := OllamaChatRequest{
		Model:    modelToUse,
		Messages: messages,
		Stream:   false,
		Options: map[string]interface{}{
			"temperature": 0.7,
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.BaseURL+"/api/chat", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("ollama connection failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("ollama API error: %s - %s", resp.Status, string(bodyBytes))
	}

	var ollamaResp OllamaChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		return "", fmt.Errorf("failed to decode ollama response: %v", err)
	}

	return ollamaResp.Message.Content, nil
}
