package api

import (
	"context"
	"testing"

	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
)

func TestGetRealMetrics_NoFallback(t *testing.T) {
	// Create a PodSpec with ONLY Requests, NO Limits
	cpuReq := resource.MustParse("100m")
	memReq := resource.MustParse("20Mi")

	podSpec := v1.PodSpec{
		Containers: []v1.Container{
			{
				Name: "test-container",
				Resources: v1.ResourceRequirements{
					Requests: v1.ResourceList{
						v1.ResourceCPU:    cpuReq,
						v1.ResourceMemory: memReq,
					},
					// Explicitly nil Limits or empty
					Limits: v1.ResourceList{},
				},
			},
		},
	}

	// Call getRealMetrics
	// ctx, namespace, name, kind, spec, window, labels, replicas
	metrics := getRealMetrics(context.Background(), "default", "test-pod", "Pod", podSpec, "1h", nil, 1)

	// Check Memory Limit
	if metrics.MemoryLimit != 0 {
		t.Errorf("Expected MemoryLimit to be 0, got %f", metrics.MemoryLimit)
	}

	// Check Memory Request
	if metrics.MemoryRequest != 20 { // 20MiB
		t.Errorf("Expected MemoryRequest to be 20, got %f", metrics.MemoryRequest)
	}

	// Check CPU Limit
	if metrics.CpuLimit != 0 {
		t.Errorf("Expected CpuLimit to be 0, got %f", metrics.CpuLimit)
	}

	// Check CPU Request
	if metrics.CpuRequest != 0.1 { // 100m = 0.1 cores
		t.Errorf("Expected CpuRequest to be 0.1, got %f", metrics.CpuRequest)
	}
}

func TestGetRealMetrics_WithLimit(t *testing.T) {
	// Create a PodSpec with Requests AND Limits
	cpuReq := resource.MustParse("100m")
	memReq := resource.MustParse("20Mi")
	cpuLim := resource.MustParse("200m")
	memLim := resource.MustParse("100Mi")

	podSpec := v1.PodSpec{
		Containers: []v1.Container{
			{
				Name: "test-container",
				Resources: v1.ResourceRequirements{
					Requests: v1.ResourceList{
						v1.ResourceCPU:    cpuReq,
						v1.ResourceMemory: memReq,
					},
					Limits: v1.ResourceList{
						v1.ResourceCPU:    cpuLim,
						v1.ResourceMemory: memLim,
					},
				},
			},
		},
	}

	metrics := getRealMetrics(context.Background(), "default", "test-pod", "Pod", podSpec, "1h", nil, 1)

	if metrics.MemoryLimit != 100 {
		t.Errorf("Expected MemoryLimit to be 100, got %f", metrics.MemoryLimit)
	}
}
