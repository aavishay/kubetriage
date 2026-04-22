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

const VertexDefaultModel = "gemini-1.5-pro"

type VertexProvider struct {
	apiKey    string
	projectID string
	location  string
	client    *http.Client
}

func NewVertexProvider() *VertexProvider {
	return &VertexProvider{
		apiKey:    os.Getenv("VERTEX_API_KEY"),
		projectID: os.Getenv("VERTEX_PROJECT_ID"),
		location:  getEnvOrDefault("VERTEX_LOCATION", "us-central1"),
		client:    &http.Client{Timeout: 60 * time.Second},
	}
}

func (p *VertexProvider) Name() string {
	return "vertex"
}

func (p *VertexProvider) isAvailable() bool {
	return p.apiKey != "" && p.projectID != ""
}

type vertexContent struct {
	Role  string `json:"role,omitempty"`
	Parts []struct {
		Text string `json:"text"`
	} `json:"parts"`
}

type vertexRequest struct {
	Contents []vertexContent `json:"contents"`
	GenerationConfig struct {
		Temperature float64 `json:"temperature"`
		MaxTokens   int     `json:"maxOutputTokens"`
	} `json:"generationConfig"`
}

type vertexResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

func (p *VertexProvider) GenerateContent(ctx context.Context, prompt string, model string) (string, error) {
	if !p.isAvailable() {
		return "", fmt.Errorf("Vertex AI is not configured")
	}

	reqBody := vertexRequest{
		Contents: []vertexContent{
			{
				Role: "user",
				Parts: []struct {
					Text string `json:"text"`
				}{{Text: prompt}},
			},
		},
	}
	reqBody.GenerationConfig.Temperature = 0.2
	reqBody.GenerationConfig.MaxTokens = 8192

	return p.doRequest(ctx, reqBody, model)
}

func (p *VertexProvider) Chat(ctx context.Context, history []ChatMessage, message string, model string) (string, error) {
	if !p.isAvailable() {
		return "", fmt.Errorf("Vertex AI is not configured")
	}

	var contents []vertexContent
	for _, msg := range history {
		role := msg.Role
		if role == "model" || role == "ai" || role == "assistant" {
			role = "model"
		}
		contents = append(contents, vertexContent{
			Role: role,
			Parts: []struct {
				Text string `json:"text"`
			}{{Text: msg.Content}},
		})
	}
	contents = append(contents, vertexContent{
		Role: "user",
		Parts: []struct {
			Text string `json:"text"`
		}{{Text: message}},
	})

	reqBody := vertexRequest{Contents: contents}
	reqBody.GenerationConfig.Temperature = 0.7
	reqBody.GenerationConfig.MaxTokens = 8192

	return p.doRequest(ctx, reqBody, model)
}

func (p *VertexProvider) doRequest(ctx context.Context, reqBody vertexRequest, model string) (string, error) {
	modelID := VertexDefaultModel
	if model != "" {
		modelID = model
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent", p.location, p.projectID, p.location, modelID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("vertex ai request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("vertex ai error %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var vertexResp vertexResponse
	if err := json.NewDecoder(resp.Body).Decode(&vertexResp); err != nil {
		return "", fmt.Errorf("failed to decode vertex response: %w", err)
	}

	var result string
	for _, cand := range vertexResp.Candidates {
		for _, part := range cand.Content.Parts {
			result += part.Text
		}
	}

	if result == "" {
		return "", fmt.Errorf("no content in vertex ai response")
	}

	return result, nil
}

func (p *VertexProvider) GetAvailableModels(ctx context.Context) ([]string, error) {
	return []string{
		"gemini-1.5-pro",
		"gemini-1.5-flash",
		"gemini-1.0-pro",
	}, nil
}
