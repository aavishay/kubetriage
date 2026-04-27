package api

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/cache"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/gin-gonic/gin"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/metrics/pkg/apis/metrics/v1beta1"
)

// UnifiedProvisionerMetrics represents a unified view of node provisioners
// This supports AWS Karpenter, Azure NAP, and Cluster Autoscaler
type UnifiedProvisionerMetrics struct {
	ProvisionerType string              `json:"provisionerType"` // "karpenter", "azure-nap", "cluster-autoscaler"
	Provider        string              `json:"provider"`        // "aws", "azure", "gcp"
	NodePools       []UnifiedNodePool   `json:"nodePools"`
	Summary         ProvisionerSummary  `json:"summary"`
}

// UnifiedNodePool represents a node pool from any provisioner
type UnifiedNodePool struct {
	Name                 string            `json:"name"`
	ProvisionerType      string            `json:"provisionerType"`
	Provider             string            `json:"provider"`
	InstanceTypes      []string          `json:"instanceTypes,omitempty"`   // AWS
	VMSizeNames        []string          `json:"vmSizeNames,omitempty"`     // Azure
	TotalNodes         int               `json:"totalNodes"`
	ReadyNodes         int               `json:"readyNodes"`
	PendingNodes       int               `json:"pendingNodes"`
	DriftedNodes       int               `json:"driftedNodes"`
	UtilizationPercent float64           `json:"utilizationPercent"`
	BinPackingEfficiency float64         `json:"binPackingEfficiency"`
	CostPerCPU         float64           `json:"costPerCPU"`
	CostPerGBMemory    float64           `json:"costPerGBMemory"`
	TotalMonthlyCost   float64           `json:"totalMonthlyCost"`
	TotalCPUs          int               `json:"totalCPUs"`
	TotalMemoryGB      int               `json:"totalMemoryGB"`
	ConsolidationEnabled bool           `json:"consolidationEnabled"`
	DisruptionBudgets  map[string]string `json:"disruptionBudgets,omitempty"`
	Misconfigurations  []string          `json:"misconfigurations,omitempty"`

	// Karpenter NodeClass reference
	NodeClass          string            `json:"nodeClass,omitempty"`

	// Creation timestamp for age calculation
	CreationTimestamp  time.Time         `json:"creationTimestamp,omitempty"`

	// Provider-specific details
	AzureConfig *AzureNodePoolDetails `json:"azureConfig,omitempty"`
	AWSConfig   *AWSNodePoolDetails   `json:"awsConfig,omitempty"`
}

// AzureNodePoolDetails contains Azure-specific node pool configuration
type AzureNodePoolDetails struct {
	Mode              string   `json:"mode,omitempty"` // System, User
	OSDiskType        string   `json:"osDiskType,omitempty"`
	OSDiskSizeGB      int32    `json:"osDiskSizeGB,omitempty"`
	MaxPods           int32    `json:"maxPods,omitempty"`
	AvailabilityZones []string `json:"availabilityZones,omitempty"`
	ScaleSetPriority  string   `json:"scaleSetPriority,omitempty"`
	EnableAutoScaling bool     `json:"enableAutoScaling,omitempty"`
}

// AWSNodePoolDetails contains AWS-specific node pool configuration
type AWSNodePoolDetails struct {
	CapacityType    string            `json:"capacityType,omitempty"` // spot, on-demand
	InstanceProfile string            `json:"instanceProfile,omitempty"`
	SubnetSelector  map[string]string `json:"subnetSelector,omitempty"`
}

// ProvisionerSummary contains aggregated metrics across all provisioners
type ProvisionerSummary struct {
	TotalProvisioners       int     `json:"totalProvisioners"`
	TotalNodePools          int     `json:"totalNodePools"`
	TotalNodes              int     `json:"totalNodes"`
	ReadyNodes              int     `json:"readyNodes"`
	AvgUtilization          float64 `json:"avgUtilization"`
	AvgBinPackingEfficiency float64 `json:"avgBinPackingEfficiency"`
	CostOptimizedCount      int     `json:"costOptimizedCount"`
	IssuesFound             int     `json:"issuesFound"`
}

// KarpenterEfficiencyMetrics represents node pool efficiency data
type KarpenterEfficiencyMetrics struct {
	NodePoolName         string                     `json:"nodePoolName"`
	InstanceTypes        []string                   `json:"instanceTypes"`
	TotalNodes           int                        `json:"totalNodes"`
	ReadyNodes           int                        `json:"readyNodes"`
	PendingNodeClaims    int                        `json:"pendingNodeClaims"`
	DriftedNodes         int                        `json:"driftedNodes"`
	UtilizationPercent   float64                    `json:"utilizationPercent"`
	BinPackingEfficiency float64                    `json:"binPackingEfficiency"`
	CostPerCPU           float64                    `json:"costPerCPU"`
	CostPerGBMemory      float64                    `json:"costPerGBMemory"`
	TotalMonthlyCost     float64                    `json:"totalMonthlyCost"`
	TotalCPUs            int                        `json:"totalCPUs"`
	TotalMemoryGB        int                        `json:"totalMemoryGB"`
	ScaleUpLatencyAvg    time.Duration              `json:"scaleUpLatencyAvg"`
	ConsolidationEnabled bool                       `json:"consolidationEnabled"`
	DisruptionBudgets    map[string]string          `json:"disruptionBudgets"`
	Misconfigurations    []string                   `json:"misconfigurations,omitempty"`
}

// KEDAEfficiencyMetrics represents scaling efficiency for a workload
type KEDAEfficiencyMetrics struct {
	WorkloadName          string             `json:"workloadName"`
	Namespace             string             `json:"namespace"`
	ScaleTargetType       string             `json:"scaleTargetType"`
	MinReplicas           int32              `json:"minReplicas"`
	MaxReplicas           int32              `json:"maxReplicas"`
	CurrentReplicas       int32              `json:"currentReplicas"`
	DesiredReplicas       int32              `json:"desiredReplicas"`
	TriggerTypes          []KEDATriggerInfo  `json:"triggerTypes"`
	EfficiencyScore       float64            `json:"efficiencyScore"` // 0-100 based on utilization
	TimeAtMinPercent      float64            `json:"timeAtMinPercent"`
	TimeAtMaxPercent      float64            `json:"timeAtMaxPercent"`
	ScaleUpLatency        time.Duration      `json:"scaleUpLatency"`
	CooldownEfficiency    float64            `json:"cooldownEfficiency"`
	EventsPerSecond       float64            `json:"eventsPerSecond"`
	IsReady               bool               `json:"isReady"`
	IsActive              bool               `json:"isActive"`
	IsFallback            bool               `json:"isFallback"`
	Misconfigurations     []string           `json:"misconfigurations,omitempty"`
}

type KEDATriggerInfo struct {
	Type           string  `json:"type"`
	MetricName     string  `json:"metricName"`
	TargetValue    float64 `json:"targetValue"`
	CurrentValue   float64 `json:"currentValue"`
	TriggerLatency float64 `json:"triggerLatency"` // ms
}

// HPAMetrics represents HPA (Horizontal Pod Autoscaler) efficiency metrics
// HPA is the native Kubernetes autoscaler, distinct from KEDA
type HPAMetrics struct {
	Name            string            `json:"name"`
	Namespace       string            `json:"namespace"`
	ScaleTargetRef  HPAScaleTargetRef `json:"scaleTargetRef"`
	MinReplicas     int32             `json:"minReplicas"`
	MaxReplicas     int32             `json:"maxReplicas"`
	CurrentReplicas int32             `json:"currentReplicas"`
	DesiredReplicas int32             `json:"desiredReplicas"`
	// Metrics
	CPUUtilization    *HPAMetricStatus `json:"cpuUtilization,omitempty"`
	MemoryUtilization *HPAMetricStatus `json:"memoryUtilization,omitempty"`
	CustomMetrics   []HPACustomMetric `json:"customMetrics,omitempty"`
	// Conditions
	IsActive         bool     `json:"isActive"`
	AbleToScale      bool     `json:"ableToScale"`
	ScalingLimited   bool     `json:"scalingLimited"`
	Misconfigurations []string  `json:"misconfigurations,omitempty"`
}

type HPAScaleTargetRef struct {
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`
	Name       string `json:"name"`
}

type HPAMetricStatus struct {
	CurrentUtilization int32 `json:"currentUtilization"` // percentage
	TargetUtilization  int32 `json:"targetUtilization"`  // percentage
}

type HPACustomMetric struct {
	Name          string  `json:"name"`
	Type          string  `json:"type"` // Resource, Pods, Object, External
	CurrentValue  float64 `json:"currentValue"`
	TargetValue   float64 `json:"targetValue"`
	TargetAverage bool    `json:"targetAverage"`
}

// ScalingEfficiencyResponse combines Karpenter, Azure NAP, KEDA, and HPA metrics
// This provides a unified view of node provisioning across cloud providers
type ScalingEfficiencyResponse struct {
	ClusterID           string                       `json:"clusterId"`
	Timestamp           time.Time                    `json:"timestamp"`
	KarpenterMetrics    []KarpenterEfficiencyMetrics `json:"karpenterMetrics"`
	KEDAMetrics         []KEDAEfficiencyMetrics      `json:"kedaMetrics"`
	HPAMetrics          []HPAMetrics                 `json:"hpaMetrics"`
	Summary             EfficiencySummary            `json:"summary"`

	// Unified provisioner support (new fields for Azure NAP and multi-provider)
	UnifiedProvisioners []UnifiedProvisionerMetrics `json:"unifiedProvisioners,omitempty"`
	DetectedProvisioners []string                     `json:"detectedProvisioners,omitempty"` // List of detected provisioner types
}

type EfficiencySummary struct {
	TotalNodePools           int     `json:"totalNodePools"`
	TotalKEDAScalers         int     `json:"totalKedaScalers"`
	TotalHPAScalers          int     `json:"totalHpaScalers"`
	AvgNodeUtilization       float64 `json:"avgNodeUtilization"`
	AvgBinPackingEfficiency  float64 `json:"avgBinPackingEfficiency"`
	TotalCostOptimized       int     `json:"totalCostOptimized"`
	IssuesFound              int     `json:"issuesFound"`
}

// ScalingEfficiencyHandler returns comprehensive Karpenter, Azure NAP, KEDA, and HPA efficiency metrics
func ScalingEfficiencyHandler(c *gin.Context) {
	clusterID := c.Query("cluster")

	// 1. Try Cache
	cacheKey := fmt.Sprintf("scaling-efficiency:%s", clusterID)
	if val, err := cache.Get(c.Request.Context(), cacheKey); err == nil {
		c.Header("X-Cache", "HIT")
		c.Data(http.StatusOK, "application/json", []byte(val))
		return
	}

	// 2. Get Client (VPN MODE: connect on-demand)
	var client *k8s.ClusterConn
	if clusterID != "" && k8s.Manager != nil {
		cls, err := k8s.Manager.GetOrConnectCluster(clusterID)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":   fmt.Sprintf("Cannot connect to cluster: %v", err),
				"message": "Cluster may be behind a VPN. Please connect to the VPN and try again.",
			})
			return
		}
		client = cls
	} else if k8s.Manager != nil && len(k8s.Manager.ListClusters()) > 0 {
		firstCluster := k8s.Manager.ListClusters()[0]
		if connected, err := k8s.Manager.GetOrConnectCluster(firstCluster.ID); err == nil {
			client = connected
		}
	}

	if client == nil || client.ClientSet == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "K8s client not initialized or cluster unreachable",
			"message": "Please select a cluster and ensure VPN connection if required.",
		})
		return
	}

	ctx := c.Request.Context()

	// 3. Fetch legacy Karpenter metrics (for backward compatibility)
	karpenterMetrics := fetchKarpenterEfficiency(ctx, client)

	// 4. Fetch unified provisioner metrics (Karpenter + Azure NAP)
	unifiedProvisioners := fetchUnifiedProvisionerMetrics(ctx, client)

	// 5. Fetch KEDA metrics
	kedaMetrics := fetchKEDAEfficiency(ctx, client)

	// 6. Fetch HPA metrics
	hpaMetrics := fetchHPAEfficiency(ctx, client)

	// 7. Calculate summary from unified provisioners
	summary := calculateEfficiencySummary(unifiedProvisioners, kedaMetrics, hpaMetrics)

	// 8. Detect which provisioners are active
	detectedProvisioners := detectActiveProvisioners(unifiedProvisioners)

	response := ScalingEfficiencyResponse{
		ClusterID:            clusterID,
		Timestamp:            time.Now(),
		KarpenterMetrics:     karpenterMetrics,
		KEDAMetrics:          kedaMetrics,
		HPAMetrics:           hpaMetrics,
		Summary:              summary,
		UnifiedProvisioners:  unifiedProvisioners,
		DetectedProvisioners: detectedProvisioners,
	}

	c.JSON(http.StatusOK, response)
}

func fetchKarpenterEfficiency(ctx context.Context, client *k8s.ClusterConn) []KarpenterEfficiencyMetrics {
	var metrics []KarpenterEfficiencyMetrics

	if client.DynamicClient == nil {
		return metrics
	}

	// Fetch NodePools (v1beta1) or fallback to Provisioners (v1alpha5)
	gvrNP := schema.GroupVersionResource{Group: "karpenter.sh", Version: "v1beta1", Resource: "nodepools"}
	nps, err := client.DynamicClient.Resource(gvrNP).List(ctx, metav1.ListOptions{})
	if err != nil {
		// Fallback to older Provisioner
		gvrProv := schema.GroupVersionResource{Group: "karpenter.sh", Version: "v1alpha5", Resource: "provisioners"}
		nps, err = client.DynamicClient.Resource(gvrProv).List(ctx, metav1.ListOptions{})
	}

	if err != nil {
		return metrics
	}

	// Fetch all nodes to calculate utilization
	nodes, _ := client.ClientSet.CoreV1().Nodes().List(ctx, metav1.ListOptions{})

	// Pre-index nodes by NodePool/Provisioner name for O(1) lookup
	nodesByPool := make(map[string][]corev1.Node)
	for _, n := range nodes.Items {
		// Check both label variants
		if poolName := n.Labels["karpenter.sh/nodepool"]; poolName != "" {
			nodesByPool[poolName] = append(nodesByPool[poolName], n)
		} else if provName := n.Labels["karpenter.sh/provisioner-name"]; provName != "" {
			nodesByPool[provName] = append(nodesByPool[provName], n)
		}
	}

	// Fetch node metrics
	var nodeMetricsList *v1beta1.NodeMetricsList
	if client.MetricsClient != nil {
		nodeMetricsList, _ = client.MetricsClient.MetricsV1beta1().NodeMetricses().List(ctx, metav1.ListOptions{})
	}
	nodeMetricsMap := make(map[string]v1beta1.NodeMetrics)
	if nodeMetricsList != nil {
		for _, m := range nodeMetricsList.Items {
			nodeMetricsMap[m.Name] = m
		}
	}

	// Process each NodePool
	for _, np := range nps.Items {
		npName := np.GetName()
		spec, _ := np.Object["spec"].(map[string]interface{})
		status, _ := np.Object["status"].(map[string]interface{})

		metric := KarpenterEfficiencyMetrics{
			NodePoolName:      npName,
			DisruptionBudgets: make(map[string]string),
		}

		// Extract instance types from spec
		if spec != nil {
			if template, ok := spec["template"].(map[string]interface{}); ok {
				if spec, ok := template["spec"].(map[string]interface{}); ok {
					if reqs, ok := spec["requirements"].([]interface{}); ok {
						for _, r := range reqs {
							if reqMap, ok := r.(map[string]interface{}); ok {
								if key, ok := reqMap["key"].(string); ok && key == "node.kubernetes.io/instance-type" {
									if vals, ok := reqMap["values"].([]interface{}); ok {
										for _, v := range vals {
											if vs, ok := v.(string); ok {
												metric.InstanceTypes = append(metric.InstanceTypes, vs)
											}
										}
									}
								}
							}
						}
					}

					// Check disruption budgets
					if disruption, ok := spec["disruption"].(map[string]interface{}); ok {
						if budgets, ok := disruption["budgets"].([]interface{}); ok {
							for _, b := range budgets {
								if budgetMap, ok := b.(map[string]interface{}); ok {
									if nodes, ok := budgetMap["nodes"].(string); ok {
										metric.DisruptionBudgets["default"] = nodes
									}
								}
							}
						}
						if consolidation, ok := disruption["consolidationPolicy"].(string); ok {
							metric.ConsolidationEnabled = consolidation == "WhenUnderutilized" || consolidation == "WhenEmpty"
						}
					}
				}
			}
		}

		// Count nodes belonging to this NodePool (O(1) lookup via pre-indexed map)
		poolNodes := nodesByPool[npName]
		metric.TotalNodes = len(poolNodes)
		for _, node := range poolNodes {
			// Check ready status
			for _, cond := range node.Status.Conditions {
				if cond.Type == corev1.NodeReady && cond.Status == corev1.ConditionTrue {
					metric.ReadyNodes++
				}
			}
			// Calculate total capacity
			metric.TotalCPUs += int(node.Status.Capacity.Cpu().Value())
			metric.TotalMemoryGB += int(node.Status.Capacity.Memory().Value() / (1024 * 1024 * 1024))
		}

		// Calculate utilization for this NodePool
		var totalCpuCap, totalCpuUsage, totalMemCap, totalMemUsage float64
		for _, node := range poolNodes {
			cpuCap := float64(node.Status.Capacity.Cpu().MilliValue()) / 1000.0
			memCap := float64(node.Status.Capacity.Memory().Value()) / (1024 * 1024 * 1024) // GB
			totalCpuCap += cpuCap
			totalMemCap += memCap

			if m, ok := nodeMetricsMap[node.Name]; ok {
				cpuUsage := float64(m.Usage.Cpu().MilliValue()) / 1000.0
				memUsage := float64(m.Usage.Memory().Value()) / (1024 * 1024 * 1024)
				totalCpuUsage += cpuUsage
				totalMemUsage += memUsage
			}
		}

		if totalCpuCap > 0 {
			cpuUtil := (totalCpuUsage / totalCpuCap) * 100
			memUtil := 0.0
			if totalMemCap > 0 {
				memUtil = (totalMemUsage / totalMemCap) * 100
			}
			metric.UtilizationPercent = (cpuUtil + memUtil) / 2
		}

		// Calculate bin-packing efficiency (simplified)
		// Higher is better - 100% means perfect packing
		if totalCpuCap > 0 && len(poolNodes) > 0 {
			avgUtilization := metric.UtilizationPercent / 100
			// Penalize for having many nodes with low utilization
			nodeCountFactor := float64(len(poolNodes)) / 10.0 // Assume ideal is < 10 nodes
			if nodeCountFactor > 1 {
				nodeCountFactor = 1
			}
			metric.BinPackingEfficiency = avgUtilization * (0.5 + 0.5*nodeCountFactor) * 100
			if metric.BinPackingEfficiency > 100 {
				metric.BinPackingEfficiency = 100
			}
		}

		// Estimate costs (simplified based on common instance types)
		metric.CostPerCPU = estimateCostPerCPU(metric.InstanceTypes)
		metric.CostPerGBMemory = estimateCostPerMemory(metric.InstanceTypes)
		metric.TotalMonthlyCost = float64(metric.TotalCPUs)*metric.CostPerCPU + float64(metric.TotalMemoryGB)*metric.CostPerGBMemory

		// Check status for issues
		if status != nil {
			if conditions, ok := status["conditions"].([]interface{}); ok {
				for _, c := range conditions {
					if cMap, ok := c.(map[string]interface{}); ok {
						if cType, ok := cMap["type"].(string); ok && cType == "NodePoolReady" {
							if cStatus, ok := cMap["status"].(string); ok && cStatus != "True" {
								reason, _ := cMap["reason"].(string)
								message, _ := cMap["message"].(string)
								metric.Misconfigurations = append(metric.Misconfigurations,
									fmt.Sprintf("NodePool not ready: %s (%s)", reason, message))
							}
						}
					}
				}
			}
		}

		// Check for pending NodeClaims
		gvrNC := schema.GroupVersionResource{Group: "karpenter.sh", Version: "v1beta1", Resource: "nodeclaims"}
		ncs, _ := client.DynamicClient.Resource(gvrNC).List(ctx, metav1.ListOptions{})
		for _, nc := range ncs.Items {
			ncLabels := nc.GetLabels()
			if ncLabels["karpenter.sh/nodepool"] == npName {
				if ncStatus, ok := nc.Object["status"].(map[string]interface{}); ok {
					if conditions, ok := ncStatus["conditions"].([]interface{}); ok {
						isReady := false
						for _, c := range conditions {
							if cMap, ok := c.(map[string]interface{}); ok {
								if cMap["type"] == "Ready" && cMap["status"] == "True" {
									isReady = true
									break
								}
							}
						}
						if !isReady {
							metric.PendingNodeClaims++
						}
						// Check for drift
						for _, c := range conditions {
							if cMap, ok := c.(map[string]interface{}); ok {
								if cMap["type"] == "Drifted" && cMap["status"] == "True" {
									metric.DriftedNodes++
								}
							}
						}
					}
				}
			}
		}

		metrics = append(metrics, metric)
	}

	return metrics
}

func fetchKEDAEfficiency(ctx context.Context, client *k8s.ClusterConn) []KEDAEfficiencyMetrics {
	var metrics []KEDAEfficiencyMetrics

	if client.DynamicClient == nil {
		return metrics
	}

	gvr := schema.GroupVersionResource{
		Group:    "keda.sh",
		Version:  "v1alpha1",
		Resource: "scaledobjects",
	}

	sos, err := client.DynamicClient.Resource(gvr).List(ctx, metav1.ListOptions{})
	if err != nil {
		return metrics
	}

	for _, item := range sos.Items {
		spec, _ := item.Object["spec"].(map[string]interface{})
		status, _ := item.Object["status"].(map[string]interface{})

		targetRef, _ := spec["scaleTargetRef"].(map[string]interface{})
		targetName, _ := targetRef["name"].(string)
		targetKind, _ := targetRef["kind"].(string)

		metric := KEDAEfficiencyMetrics{
			WorkloadName:    targetName,
			Namespace:       item.GetNamespace(),
			ScaleTargetType: targetKind,
		}

		// Extract replica counts - handle both int64 and float64 from JSON
		if min, ok := spec["minReplicaCount"].(int64); ok {
			metric.MinReplicas = int32(min)
		} else if min, ok := spec["minReplicaCount"].(float64); ok {
			metric.MinReplicas = int32(min)
		}
		if max, ok := spec["maxReplicaCount"].(int64); ok {
			metric.MaxReplicas = int32(max)
		} else if max, ok := spec["maxReplicaCount"].(float64); ok {
			metric.MaxReplicas = int32(max)
		}
		// Default values if not set (KEDA defaults)
		if metric.MinReplicas == 0 {
			metric.MinReplicas = 0 // KEDA allows 0, but typically should be >= 0
		}
		if metric.MaxReplicas == 0 {
			metric.MaxReplicas = 100 // KEDA default max
		}

		// Extract triggers
		if triggers, ok := spec["triggers"].([]interface{}); ok {
			for _, t := range triggers {
				if tMap, ok := t.(map[string]interface{}); ok {
					triggerInfo := KEDATriggerInfo{}
					if tType, ok := tMap["type"].(string); ok {
						triggerInfo.Type = tType
					}
					if metadata, ok := tMap["metadata"].(map[string]interface{}); ok {
						if value, ok := metadata["value"].(string); ok {
							// Try to parse target value
							fmt.Sscanf(value, "%f", &triggerInfo.TargetValue)
						}
						triggerInfo.MetricName = getKEDAMetricName(metadata)
					}
					metric.TriggerTypes = append(metric.TriggerTypes, triggerInfo)
				}
			}
		}

		// Check status - handle both int64 and float64 from JSON
		if status != nil {
			if currentReplicas, ok := status["currentReplicaCount"].(int64); ok {
				metric.CurrentReplicas = int32(currentReplicas)
			} else if currentReplicas, ok := status["currentReplicaCount"].(float64); ok {
				metric.CurrentReplicas = int32(currentReplicas)
			}
			if desiredReplicas, ok := status["desiredReplicaCount"].(int64); ok {
				metric.DesiredReplicas = int32(desiredReplicas)
			} else if desiredReplicas, ok := status["desiredReplicaCount"].(float64); ok {
				metric.DesiredReplicas = int32(desiredReplicas)
			}
			// Ensure CurrentReplicas is at least MinReplicas
			if metric.CurrentReplicas < metric.MinReplicas {
				metric.CurrentReplicas = metric.MinReplicas
			}

			// Parse conditions
			if conditions, ok := status["conditions"].([]interface{}); ok {
				for _, c := range conditions {
					if cMap, ok := c.(map[string]interface{}); ok {
						cType := cMap["type"]
						cStatus := cMap["status"]

						switch cType {
						case "Ready":
							metric.IsReady = cStatus == "True"
							if !metric.IsReady {
								reason, _ := cMap["reason"].(string)
								message, _ := cMap["message"].(string)
								metric.Misconfigurations = append(metric.Misconfigurations,
									fmt.Sprintf("KEDA not ready: %s - %s", reason, message))
							}
						case "Active":
							metric.IsActive = cStatus == "True"
						case "Fallback":
							metric.IsFallback = cStatus == "True"
							if metric.IsFallback {
								metric.Misconfigurations = append(metric.Misconfigurations,
									"KEDA is in fallback mode - triggers may be failing")
							}
						}
					}
				}
			}

			// Try to get health check metrics
			if health, ok := status["health"].(map[string]interface{}); ok {
				if scalerHealth, ok := health["sScalerHealthy"].(map[string]interface{}); ok {
					// Count number of healthy scalers vs total
					_ = scalerHealth
				}
			}
		}

		// Calculate efficiency score
		if metric.MaxReplicas > metric.MinReplicas {
			// Calculate where we are in the scale range
			rangeSize := float64(metric.MaxReplicas - metric.MinReplicas)
			currentPosition := float64(metric.CurrentReplicas-metric.MinReplicas) / rangeSize

			// Ideal is around 60-80% utilization (not too low, not at max)
			if currentPosition < 0.3 {
				metric.EfficiencyScore = 100 - (currentPosition * 100) // Low score for underutilization
				metric.TimeAtMinPercent = 30.0
			} else if currentPosition > 0.9 {
				metric.EfficiencyScore = 50 - ((currentPosition - 0.9) * 500) // Penalty for being at max
				metric.TimeAtMaxPercent = 50.0
			} else {
				metric.EfficiencyScore = 80 + (currentPosition * 20) // Good efficiency
			}

			if metric.EfficiencyScore < 0 {
				metric.EfficiencyScore = 0
			}
			if metric.EfficiencyScore > 100 {
				metric.EfficiencyScore = 100
			}
		}

		// Check cooldown configuration
		if cooldown, ok := spec["advanced"].(map[string]interface{}); ok {
			if restore, ok := cooldown["restoreToOriginalReplicaCount"].(bool); ok && restore {
				metric.CooldownEfficiency = 100 // Good - restores to original
			}
		} else {
			metric.CooldownEfficiency = 50 // Default cooldown behavior
		}

		metrics = append(metrics, metric)
	}

	return metrics
}

// fetchHPAEfficiency fetches Horizontal Pod Autoscaler metrics
func fetchHPAEfficiency(ctx context.Context, client *k8s.ClusterConn) []HPAMetrics {
	var metrics []HPAMetrics

	if client.ClientSet == nil {
		return metrics
	}

	// Fetch HPA objects from the API
	hpaList, err := client.ClientSet.AutoscalingV2().HorizontalPodAutoscalers("").List(ctx, metav1.ListOptions{})
	if err != nil {
		// Try v1 API if v2 is not available
		hpaListV1, err := client.ClientSet.AutoscalingV1().HorizontalPodAutoscalers("").List(ctx, metav1.ListOptions{})
		if err != nil {
			return metrics
		}
		// Convert v1 to our metrics format
		for _, hpa := range hpaListV1.Items {
			metric := HPAMetrics{
				Name:            hpa.Name,
				Namespace:       hpa.Namespace,
				MinReplicas:     *hpa.Spec.MinReplicas,
				MaxReplicas:     hpa.Spec.MaxReplicas,
				CurrentReplicas: hpa.Status.CurrentReplicas,
				DesiredReplicas: hpa.Status.DesiredReplicas,
				ScaleTargetRef: HPAScaleTargetRef{
					APIVersion: "v1",
					Kind:       hpa.Spec.ScaleTargetRef.Kind,
					Name:       hpa.Spec.ScaleTargetRef.Name,
				},
			}
			// Ensure CurrentReplicas is at least MinReplicas
			if metric.CurrentReplicas < metric.MinReplicas {
				metric.CurrentReplicas = metric.MinReplicas
			}
			// v1 HPA doesn't have Conditions - set defaults
			metric.IsActive = metric.CurrentReplicas > 0
			metric.AbleToScale = true
			metrics = append(metrics, metric)
		}
		return metrics
	}

	// Process v2 HPA objects
	for _, hpa := range hpaList.Items {
		metric := HPAMetrics{
			Name:      hpa.Name,
			Namespace: hpa.Namespace,
			ScaleTargetRef: HPAScaleTargetRef{
				APIVersion: hpa.Spec.ScaleTargetRef.APIVersion,
				Kind:       hpa.Spec.ScaleTargetRef.Kind,
				Name:       hpa.Spec.ScaleTargetRef.Name,
			},
		}

		if hpa.Spec.MinReplicas != nil {
			metric.MinReplicas = *hpa.Spec.MinReplicas
		}
		metric.MaxReplicas = hpa.Spec.MaxReplicas
		metric.CurrentReplicas = hpa.Status.CurrentReplicas
		metric.DesiredReplicas = hpa.Status.DesiredReplicas

		// Ensure CurrentReplicas is at least MinReplicas
		if metric.CurrentReplicas < metric.MinReplicas {
			metric.CurrentReplicas = metric.MinReplicas
		}

		// Parse metrics status
		for _, m := range hpa.Status.CurrentMetrics {
			switch m.Type {
			case "Resource":
				if m.Resource != nil {
					if m.Resource.Name == "cpu" && m.Resource.Current.AverageUtilization != nil {
						metric.CPUUtilization = &HPAMetricStatus{
							CurrentUtilization: *m.Resource.Current.AverageUtilization,
						}
						// Find target from spec
						for _, specMetric := range hpa.Spec.Metrics {
							if specMetric.Type == "Resource" && specMetric.Resource != nil &&
							   specMetric.Resource.Name == "cpu" &&
							   specMetric.Resource.Target.AverageUtilization != nil {
								metric.CPUUtilization.TargetUtilization = *specMetric.Resource.Target.AverageUtilization
							}
						}
					}
					if m.Resource.Name == "memory" && m.Resource.Current.AverageUtilization != nil {
						metric.MemoryUtilization = &HPAMetricStatus{
							CurrentUtilization: *m.Resource.Current.AverageUtilization,
						}
						// Find target from spec
						for _, specMetric := range hpa.Spec.Metrics {
							if specMetric.Type == "Resource" && specMetric.Resource != nil &&
							   specMetric.Resource.Name == "memory" &&
							   specMetric.Resource.Target.AverageUtilization != nil {
								metric.MemoryUtilization.TargetUtilization = *specMetric.Resource.Target.AverageUtilization
							}
						}
					}
				}
			case "Pods", "Object", "External":
				customMetric := HPACustomMetric{
					Type: string(m.Type),
				}
				if m.Pods != nil {
					customMetric.Name = m.Pods.Metric.Name
					if m.Pods.Current.AverageValue != nil {
						customMetric.CurrentValue = m.Pods.Current.AverageValue.AsApproximateFloat64()
					}
				}
				if m.Object != nil {
					customMetric.Name = m.Object.Metric.Name
					if m.Object.Current.Value != nil {
						customMetric.CurrentValue = m.Object.Current.Value.AsApproximateFloat64()
					}
					if m.Object.Current.AverageValue != nil {
						customMetric.CurrentValue = m.Object.Current.AverageValue.AsApproximateFloat64()
						customMetric.TargetAverage = true
					}
				}
				if m.External != nil {
					customMetric.Name = m.External.Metric.Name
					if m.External.Current.Value != nil {
						customMetric.CurrentValue = m.External.Current.Value.AsApproximateFloat64()
					}
					if m.External.Current.AverageValue != nil {
						customMetric.CurrentValue = m.External.Current.AverageValue.AsApproximateFloat64()
						customMetric.TargetAverage = true
					}
				}
				metric.CustomMetrics = append(metric.CustomMetrics, customMetric)
			}
		}

		// Check conditions
		for _, cond := range hpa.Status.Conditions {
			switch cond.Type {
			case "ScalingActive":
				metric.IsActive = cond.Status == "True"
			case "AbleToScale":
				metric.AbleToScale = cond.Status == "True"
			case "ScalingLimited":
				metric.ScalingLimited = cond.Status == "True"
			}
			if cond.Status != "True" && cond.Reason != "" {
				metric.Misconfigurations = append(metric.Misconfigurations,
					fmt.Sprintf("%s: %s", cond.Type, cond.Message))
			}
		}

		// Check for issues
		if metric.ScalingLimited {
			metric.Misconfigurations = append(metric.Misconfigurations,
				"HPA is scaling limited - may be at max replicas or resource constraints")
		}
		if !metric.IsActive {
			metric.Misconfigurations = append(metric.Misconfigurations,
				"HPA scaling is not active")
		}
		if metric.CurrentReplicas == metric.MaxReplicas {
			metric.Misconfigurations = append(metric.Misconfigurations,
				"Workload is at maximum replica count - consider increasing maxReplicas")
		}

		metrics = append(metrics, metric)
	}

	return metrics
}

func calculateEfficiencySummary(unifiedProvisioners []UnifiedProvisionerMetrics, keda []KEDAEfficiencyMetrics, hpa []HPAMetrics) EfficiencySummary {
	summary := EfficiencySummary{
		TotalKEDAScalers: len(keda),
		TotalHPAScalers:  len(hpa),
	}

	var totalUtilization, totalBinPacking float64
	var totalNodePools int

	for _, provisioner := range unifiedProvisioners {
		summary.TotalNodePools += len(provisioner.NodePools)
		totalNodePools += len(provisioner.NodePools)

		for _, np := range provisioner.NodePools {
			totalUtilization += np.UtilizationPercent
			totalBinPacking += np.BinPackingEfficiency
			if np.ConsolidationEnabled {
				summary.TotalCostOptimized++
			}
			summary.IssuesFound += len(np.Misconfigurations)
		}
	}

	for _, k := range keda {
		summary.IssuesFound += len(k.Misconfigurations)
	}

	for _, h := range hpa {
		summary.IssuesFound += len(h.Misconfigurations)
	}

	if totalNodePools > 0 {
		summary.AvgNodeUtilization = totalUtilization / float64(totalNodePools)
		summary.AvgBinPackingEfficiency = totalBinPacking / float64(totalNodePools)
	}

	return summary
}

// Helper functions for cost estimation (monthly)
// Costs are calculated per month assuming 24/7 operation (730 hours/month)
func estimateCostPerCPU(instanceTypes []string) float64 {
	// Simplified pricing based on common instance types
	// In production, this would pull from cloud pricing APIs
	// Returns monthly cost per CPU
	hoursPerMonth := 730.0
	if len(instanceTypes) == 0 {
		return 0.05 * hoursPerMonth // Default $0.05 per CPU hour -> monthly
	}

	total := 0.0
	count := 0
	for _, it := range instanceTypes {
		switch {
		case strings.Contains(it, "t3") || strings.Contains(it, "e2"):
			total += 0.03 * hoursPerMonth // Burstable ~$22/month per CPU
			count++
		case strings.Contains(it, "m5") || strings.Contains(it, "n2"):
			total += 0.05 * hoursPerMonth // General purpose ~$37/month per CPU
			count++
		case strings.Contains(it, "c5") || strings.Contains(it, "c2"):
			total += 0.04 * hoursPerMonth // Compute optimized ~$29/month per CPU
			count++
		case strings.Contains(it, "r5") || strings.Contains(it, "n2-highmem"):
			total += 0.06 * hoursPerMonth // Memory optimized ~$44/month per CPU
			count++
		default:
			total += 0.05 * hoursPerMonth
			count++
		}
	}

	if count > 0 {
		return total / float64(count)
	}
	return 0.05 * hoursPerMonth
}

func estimateCostPerMemory(instanceTypes []string) float64 {
	// Returns monthly cost per GB of memory
	hoursPerMonth := 730.0
	if len(instanceTypes) == 0 {
		return 0.006 * hoursPerMonth // Default $0.006 per GB hour -> monthly
	}

	total := 0.0
	count := 0
	for _, it := range instanceTypes {
		switch {
		case strings.Contains(it, "t3") || strings.Contains(it, "e2"):
			total += 0.004 * hoursPerMonth
			count++
		case strings.Contains(it, "m5") || strings.Contains(it, "n2"):
			total += 0.006 * hoursPerMonth
			count++
		case strings.Contains(it, "r5") || strings.Contains(it, "n2-highmem"):
			total += 0.005 * hoursPerMonth
			count++
		default:
			total += 0.006 * hoursPerMonth
			count++
		}
	}

	if count > 0 {
		return total / float64(count)
	}
	return 0.006 * hoursPerMonth
}

func getKEDAMetricName(metadata map[string]interface{}) string {
	// Extract metric name based on trigger type
	if v, ok := metadata["metricName"].(string); ok {
		return v
	}
	if v, ok := metadata["queueName"].(string); ok {
		return v
	}
	if v, ok := metadata["topicName"].(string); ok {
		return v
	}
	if v, ok := metadata["streamName"].(string); ok {
		return v
	}
	return "unknown"
}

// fetchUnifiedProvisionerMetrics fetches metrics from all supported provisioners
func fetchUnifiedProvisionerMetrics(ctx context.Context, client *k8s.ClusterConn) []UnifiedProvisionerMetrics {
	var unifiedMetrics []UnifiedProvisionerMetrics

	// Detect provisioners
	provisioners, _ := k8s.DetectProvisioner(ctx, client)

	for _, provisioner := range provisioners {
		metric := UnifiedProvisionerMetrics{
			ProvisionerType: string(provisioner.Type),
			Provider:        provisioner.Provider,
		}

		switch provisioner.Type {
		case k8s.ProvisionerTypeKarpenter:
			metric.NodePools = fetchKarpenterNodePoolsUnified(ctx, client)
		case k8s.ProvisionerTypeAzureNAP:
			metric.NodePools = fetchAzureNAPNodePoolsUnified(ctx, client)
		case k8s.ProvisionerTypeAKSManaged:
			metric.NodePools = fetchAKSManagedNodePoolsUnified(ctx, client)
		}

		// Calculate summary for this provisioner
		metric.Summary = calculateProvisionerSummary(metric.NodePools)

		if len(metric.NodePools) > 0 {
			unifiedMetrics = append(unifiedMetrics, metric)
		}
	}

	return unifiedMetrics
}

// fetchKarpenterNodePoolsUnified fetches Karpenter node pools in unified format
func fetchKarpenterNodePoolsUnified(ctx context.Context, client *k8s.ClusterConn) []UnifiedNodePool {
	var pools []UnifiedNodePool

	if client.DynamicClient == nil {
		return pools
	}

	// Use the k8s package to fetch Karpenter node pools
	karpenterPools, _ := k8s.FetchKarpenterNodePools(ctx, client)

	for _, kp := range karpenterPools {
		pool := UnifiedNodePool{
			Name:                 kp.Name,
			ProvisionerType:      "karpenter",
			Provider:             "aws",
			InstanceTypes:        kp.InstanceTypes,
			TotalNodes:           kp.TotalNodes,
			ReadyNodes:           kp.ReadyNodes,
			PendingNodes:         kp.PendingNodes,
			DriftedNodes:         kp.DriftedNodes,
			UtilizationPercent:   kp.UtilizationPercent,
			BinPackingEfficiency: kp.BinPackingEfficiency,
			CostPerCPU:           kp.CostPerCPU,
			CostPerGBMemory:      kp.CostPerGBMemory,
			TotalMonthlyCost:     kp.TotalMonthlyCost,
			TotalCPUs:            kp.TotalCPUs,
			TotalMemoryGB:        kp.TotalMemoryGB,
			ConsolidationEnabled: kp.ConsolidationEnabled,
			DisruptionBudgets:    kp.DisruptionBudgets,
			Misconfigurations:    kp.Misconfigurations,
			NodeClass:            kp.NodeClass,
			CreationTimestamp:    kp.CreationTimestamp,
			AWSConfig: &AWSNodePoolDetails{
				CapacityType: kp.AWSNodePool.CapacityType,
			},
		}
		pools = append(pools, pool)
	}

	return pools
}

// fetchAzureNAPNodePoolsUnified fetches Azure NAP node pools in unified format
func fetchAzureNAPNodePoolsUnified(ctx context.Context, client *k8s.ClusterConn) []UnifiedNodePool {
	var pools []UnifiedNodePool

	// Use the k8s package to fetch Azure NAP node pools
	azurePools, _ := k8s.FetchAzureNAPNodePools(ctx, client)

	for _, ap := range azurePools {
		pool := UnifiedNodePool{
			Name:                 ap.Name,
			ProvisionerType:      "azure-nap",
			Provider:             "azure",
			VMSizeNames:          ap.VMSizeNames,
			TotalNodes:           ap.TotalNodes,
			ReadyNodes:           ap.ReadyNodes,
			PendingNodes:         ap.PendingNodes,
			DriftedNodes:         ap.DriftedNodes,
			UtilizationPercent:   ap.UtilizationPercent,
			BinPackingEfficiency: ap.BinPackingEfficiency,
			CostPerCPU:           ap.CostPerCPU,
			CostPerGBMemory:      ap.CostPerGBMemory,
			TotalMonthlyCost:     ap.TotalMonthlyCost,
			TotalCPUs:            ap.TotalCPUs,
			TotalMemoryGB:        ap.TotalMemoryGB,
			ConsolidationEnabled: ap.ConsolidationEnabled,
			DisruptionBudgets:    ap.DisruptionBudgets,
			Misconfigurations:    ap.Misconfigurations,
			NodeClass:            "", // Azure NAP doesn't use NodeClass
			CreationTimestamp:    ap.CreationTimestamp,
		}

		if ap.AzureNodePool != nil {
			pool.AzureConfig = &AzureNodePoolDetails{
				Mode:              ap.AzureNodePool.Mode,
				OSDiskType:        ap.AzureNodePool.OSDiskType,
				OSDiskSizeGB:      ap.AzureNodePool.OSDiskSizeGB,
				MaxPods:           ap.AzureNodePool.MaxPods,
				AvailabilityZones: ap.AzureNodePool.AvailabilityZones,
				ScaleSetPriority:  ap.AzureNodePool.ScaleSetPriority,
				EnableAutoScaling: ap.AzureNodePool.EnableAutoScaling,
			}
		}

		pools = append(pools, pool)
	}

	return pools
}

// fetchAKSManagedNodePoolsUnified fetches AKS managed node pools in unified format
func fetchAKSManagedNodePoolsUnified(ctx context.Context, client *k8s.ClusterConn) []UnifiedNodePool {
	var pools []UnifiedNodePool

	// Use the k8s package to fetch AKS managed node pools
	aksPools, _ := k8s.FetchAKSManagedNodePools(ctx, client)

	for _, ap := range aksPools {
		pool := UnifiedNodePool{
			Name:                 ap.Name,
			ProvisionerType:      "aks-managed",
			Provider:             "azure",
			VMSizeNames:          ap.VMSizeNames,
			TotalNodes:           ap.TotalNodes,
			ReadyNodes:           ap.ReadyNodes,
			PendingNodes:         ap.PendingNodes,
			DriftedNodes:         ap.DriftedNodes,
			UtilizationPercent:   ap.UtilizationPercent,
			BinPackingEfficiency: ap.BinPackingEfficiency,
			CostPerCPU:           ap.CostPerCPU,
			CostPerGBMemory:      ap.CostPerGBMemory,
			TotalMonthlyCost:     ap.TotalMonthlyCost,
			TotalCPUs:            ap.TotalCPUs,
			TotalMemoryGB:        ap.TotalMemoryGB,
			ConsolidationEnabled: ap.ConsolidationEnabled,
			DisruptionBudgets:    ap.DisruptionBudgets,
			Misconfigurations:    ap.Misconfigurations,
			NodeClass:            "", // AKS managed pools don't use NodeClass
			CreationTimestamp:    ap.CreationTimestamp,
		}

		if ap.AzureNodePool != nil {
			pool.AzureConfig = &AzureNodePoolDetails{
				Mode:              ap.AzureNodePool.Mode,
				OSDiskType:        ap.AzureNodePool.OSDiskType,
				OSDiskSizeGB:      ap.AzureNodePool.OSDiskSizeGB,
				MaxPods:           ap.AzureNodePool.MaxPods,
				AvailabilityZones: ap.AzureNodePool.AvailabilityZones,
				ScaleSetPriority:  ap.AzureNodePool.ScaleSetPriority,
				EnableAutoScaling: ap.AzureNodePool.EnableAutoScaling,
			}
		}

		pools = append(pools, pool)
	}

	return pools
}

// calculateProvisionerSummary calculates summary metrics for a provisioner's node pools
func calculateProvisionerSummary(pools []UnifiedNodePool) ProvisionerSummary {
	summary := ProvisionerSummary{
		TotalNodePools: len(pools),
	}

	var totalUtilization, totalBinPacking float64
	for _, p := range pools {
		summary.TotalNodes += p.TotalNodes
		summary.ReadyNodes += p.ReadyNodes
		totalUtilization += p.UtilizationPercent
		totalBinPacking += p.BinPackingEfficiency
		if p.ConsolidationEnabled {
			summary.CostOptimizedCount++
		}
		summary.IssuesFound += len(p.Misconfigurations)
	}

	if len(pools) > 0 {
		summary.AvgUtilization = totalUtilization / float64(len(pools))
		summary.AvgBinPackingEfficiency = totalBinPacking / float64(len(pools))
	}

	return summary
}

// detectActiveProvisioners returns a list of detected provisioner types
func detectActiveProvisioners(provisioners []UnifiedProvisionerMetrics) []string {
	var detected []string
	for _, p := range provisioners {
		detected = append(detected, p.ProvisionerType)
	}
	return detected
}
