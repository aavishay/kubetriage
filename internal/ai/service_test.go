package ai

import (
	"context"
	"strings"
	"testing"
)

type mockProvider struct {
	AIProvider
	response string
}

func (m *mockProvider) GenerateContent(ctx context.Context, prompt, model string) (string, error) {
	return m.response, nil
}

func (m *mockProvider) GetAvailableModels(ctx context.Context) ([]string, error) {
	return []string{"mock-model"}, nil
}

func TestGenerateTopology_CleanResponse(t *testing.T) {
	tests := []struct {
		name     string
		response string
		expected string
	}{
		{
			name:     "clean mermaid block",
			response: "```mermaid\nflowchart TB\na --> b\n```",
			expected: "flowchart TB\na --> b",
		},
		{
			name:     "generic code block",
			response: "```\nflowchart TB\na --> b\n```",
			expected: "flowchart TB\na --> b",
		},
		{
			name:     "missing header but has content",
			response: "a --> b",
			expected: "flowchart TB\na --> b",
		},
		{
			name:     "surrounding text",
			response: "Here is your diagram:\n```mermaid\nflowchart TB\na --> b\n```\nHope it helps!",
			expected: "flowchart TB\na --> b",
		},
		{
			name:     "graph header instead of flowchart",
			response: "graph TD\na --> b",
			expected: "graph TD\na --> b",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &AIService{
				providers: map[string]AIProvider{
					"mock": &mockProvider{response: tt.response},
				},
			}

			got, err := s.GenerateTopology(context.Background(), "mock", "mock-model", "summary")
			if err != nil {
				t.Fatalf("GenerateTopology() error = %v", err)
			}

			if strings.TrimSpace(got) != tt.expected {
				t.Errorf("GenerateTopology() got = %v, want %v", got, tt.expected)
			}
		})
	}
}
