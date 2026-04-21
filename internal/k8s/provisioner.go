package k8s

import (
	"context"
	"fmt"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/metrics/pkg/apis/metrics/v1beta1"
)

// ProvisionerType identifies the type of node provisioner
type ProvisionerType string

const (
	ProvisionerTypeKarpenter   ProvisionerType = "karpenter"
	ProvisionerTypeAzureNAP  ProvisionerType = "azure-nap"
	ProvisionerTypeClusterAutoscaler ProvisionerType = "cluster-autoscaler"
	ProvisionerTypeUnknown   ProvisionerType = "unknown"
)

// NodeProvisioner represents a unified view of node provisioning systems
// This abstracts AWS Karpenter, Azure NAP (Node Auto-Provisioning), and other provisioners
type NodeProvisioner struct {
	Name        string          `json:"name"`
	Type        ProvisionerType `json:"type"`
	Provider    string          `json:"provider"` // "aws", "azure", "gcp"
	Version     string          `json:"version,omitempty"`
	Status      ProvisionerStatus `json:"status"`
	NodePools   []NodePool      `json:"nodePools"`
	Metrics     ProvisionerMetrics `json:"metrics"`
	Config      ProvisionerConfig `json:"config"`
}

// ProvisionerStatus represents the operational status of a provisioner
type ProvisionerStatus struct {
	Ready             bool      `json:"ready"`
	Message           string    `json:"message,omitempty"`
	LastTransitionTime  time.Time `json:"lastTransitionTime"`
	Conditions        []ProvisionerCondition `json:"conditions,omitempty"`
}

// ProvisionerCondition represents a single condition of the provisioner
type ProvisionerCondition struct {
	Type               string    `json:"type"`
	Status             string    `json:"status"`
	Reason             string    `json:"reason,omitempty"`
	Message            string    `json:"message,omitempty"`
	LastTransitionTime time.Time `json:"lastTransitionTime"`
}

// NodePool represents a pool of nodes managed by a provisioner
type NodePool struct {
	Name              string            `json:"name"`
	ProvisionerType   ProvisionerType   `json:"provisionerType"`
	InstanceTypes     []string          `json:"instanceTypes"`
	VMSizeNames       []string          `json:"vmSizeNames,omitempty"` // Azure-specific
	TotalNodes        int               `json:"totalNodes"`
	ReadyNodes        int               `json:"readyNodes"`
	PendingNodes      int               `json:"pendingNodes"`
	DriftedNodes      int               `json:"driftedNodes"`
	UtilizationPercent float64          `json:"utilizationPercent"`
	BinPackingEfficiency float64         `json:"binPackingEfficiency"`
	CostPerCPU        float64           `json:"costPerCPU"`
	CostPerGBMemory   float64           `json:"costPerGBMemory"`
	TotalMonthlyCost  float64           `json:"totalMonthlyCost"` // Total cost for all nodes in this pool
	TotalCPUs         int               `json:"totalCPUs"`        // Total CPU cores across all nodes
	TotalMemoryGB     int               `json:"totalMemoryGB"`    // Total memory across all nodes
	ScaleUpLatencyAvg time.Duration     `json:"scaleUpLatencyAvg"`
	ConsolidationEnabled bool           `json:"consolidationEnabled"`
	DisruptionBudgets map[string]string `json:"disruptionBudgets,omitempty"`
	Labels            map[string]string `json:"labels,omitempty"`
	Taints            []corev1.Taint    `json:"taints,omitempty"`
	Misconfigurations []string          `json:"misconfigurations,omitempty"`

	// Provider-specific fields
	AWSNodePool   *AWSNodePoolConfig   `json:"awsNodePool,omitempty"`
	AzureNodePool *AzureNodePoolConfig `json:"azureNodePool,omitempty"`
}

// AWSNodePoolConfig contains AWS Karpenter-specific configuration
type AWSNodePoolConfig struct {
	SubnetSelector     map[string]string `json:"subnetSelector,omitempty"`
	SecurityGroupSelector map[string]string `json:"securityGroupSelector,omitempty"`
	AMISelector        map[string]string `json:"amiSelector,omitempty"`
	InstanceProfile    string            `json:"instanceProfile,omitempty"`
	CapacityType       string            `json:"capacityType,omitempty"` // spot, on-demand
}

// AzureNodePoolConfig contains Azure NAP-specific configuration
type AzureNodePoolConfig struct {
	Mode              string            `json:"mode,omitempty"` // System, User
	OSDiskType        string            `json:"osDiskType,omitempty"`
	OSDiskSizeGB      int32             `json:"osDiskSizeGB,omitempty"`
	VnetSubnetID      string            `json:"vnetSubnetID,omitempty"`
	MaxPods           int32             `json:"maxPods,omitempty"`
	MinCount          *int32            `json:"minCount,omitempty"`
	MaxCount          *int32            `json:"maxCount,omitempty"`
	EnableAutoScaling bool              `json:"enableAutoScaling,omitempty"`
	AvailabilityZones []string          `json:"availabilityZones,omitempty"`
	ScaleSetPriority  string            `json:"scaleSetPriority,omitempty"` // Spot, Regular
}

// ProvisionerMetrics contains unified metrics for any provisioner
type ProvisionerMetrics struct {
	TotalNodePools       int       `json:"totalNodePools"`
	TotalNodes           int       `json:"totalNodes"`
	ReadyNodes           int       `json:"readyNodes"`
	PendingNodes         int       `json:"pendingNodes"`
	AvgUtilization       float64   `json:"avgUtilization"`
	AvgBinPackingEfficiency float64 `json:"avgBinPackingEfficiency"`
	CostOptimizedCount   int       `json:"costOptimizedCount"`
	IssuesFound          int       `json:"issuesFound"`
}

// ProvisionerConfig represents the configuration of a provisioner
type ProvisionerConfig struct {
	ConsolidationEnabled bool   `json:"consolidationEnabled"`
	DisruptionBudgets    map[string]string `json:"disruptionBudgets,omitempty"`
	ResourceLimits       ResourceLimits    `json:"resourceLimits,omitempty"`
}

// ResourceLimits defines resource constraints for node provisioning
type ResourceLimits struct {
	MaxNodes int32 `json:"maxNodes,omitempty"`
	MaxCPU   int32 `json:"maxCPU,omitempty"`
	MaxMemory int64 `json:"maxMemory,omitempty"`
}

// DetectProvisioner detects which node provisioner(s) are installed in the cluster
func DetectProvisioner(ctx context.Context, client *ClusterConn) ([]NodeProvisioner, error) {
	var provisioners []NodeProvisioner

	// Check for Karpenter
	if karpenter, err := detectKarpenter(ctx, client); err == nil && karpenter != nil {
		provisioners = append(provisioners, *karpenter)
	}

	// Check for Azure NAP
	if azureNAP, err := detectAzureNAP(ctx, client); err == nil && azureNAP != nil {
		provisioners = append(provisioners, *azureNAP)
	}

	// Check for Cluster Autoscaler
	if ca, err := detectClusterAutoscaler(ctx, client); err == nil && ca != nil {
		provisioners = append(provisioners, *ca)
	}

	return provisioners, nil
}

// detectKarpenter detects if Karpenter is installed
func detectKarpenter(ctx context.Context, client *ClusterConn) (*NodeProvisioner, error) {
	if client.DynamicClient == nil {
		return nil, fmt.Errorf("dynamic client not available")
	}

	// Try v1beta1 NodePools first, then v1alpha5 Provisioners
	gvr := schema.GroupVersionResource{
		Group:    "karpenter.sh",
		Version:  "v1beta1",
		Resource: "nodepools",
	}

	nps, err := client.DynamicClient.Resource(gvr).List(ctx, metav1.ListOptions{})
	if err != nil {
		// Fallback to v1alpha5 Provisioners
		gvr = schema.GroupVersionResource{
			Group:    "karpenter.sh",
			Version:  "v1alpha5",
			Resource: "provisioners",
		}
		nps, err = client.DynamicClient.Resource(gvr).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nil, err
		}
	}

	if len(nps.Items) == 0 {
		return nil, nil // Karpenter not found
	}

	// Karpenter is installed, fetch details
	provisioner := &NodeProvisioner{
		Type:     ProvisionerTypeKarpenter,
		Provider: detectKarpenterProvider(ctx, client),
		Status: ProvisionerStatus{
			Ready: true,
		},
	}

	// Get Karpenter version from deployment
	if deploys, err := client.ClientSet.AppsV1().Deployments("").List(ctx, metav1.ListOptions{
		LabelSelector: "app.kubernetes.io/name=karpenter",
	}); err == nil && len(deploys.Items) > 0 {
		provisioner.Name = deploys.Items[0].Name
		provisioner.Version = deploys.Items[0].Labels["app.kubernetes.io/version"]
	} else {
		provisioner.Name = "karpenter"
	}

	return provisioner, nil
}

// detectAzureNAP detects if Azure Node Auto-Provisioning is enabled
func detectAzureNAP(ctx context.Context, client *ClusterConn) (*NodeProvisioner, error) {
	if client.DynamicClient == nil {
		return nil, fmt.Errorf("dynamic client not available")
	}

	// Check for Azure-managed AKS agent pools (AKS API)
	agentPools, err := client.ClientSet.CoreV1().Nodes().List(ctx, metav1.ListOptions{
		LabelSelector: "kubernetes.io/os=linux",
	})
	if err != nil {
		return nil, err
	}

	// Check if any nodes have Azure NAP labels
	hasNAP := false
	for _, node := range agentPools.Items {
		if _, ok := node.Labels["kubernetes.azure.com/node-image-version"]; ok {
			hasNAP = true
			break
		}
		// Check for AKS node pool labels
		if _, ok := node.Labels["agentpool"]; ok {
			hasNAP = true
			break
		}
	}

	if !hasNAP {
		return nil, nil
	}

	// Azure NAP detected
	provisioner := &NodeProvisioner{
		Name:     "azure-nap",
		Type:     ProvisionerTypeAzureNAP,
		Provider: "azure",
		Status: ProvisionerStatus{
			Ready: true,
		},
	}

	return provisioner, nil
}

// detectClusterAutoscaler detects if Cluster Autoscaler is installed
func detectClusterAutoscaler(ctx context.Context, client *ClusterConn) (*NodeProvisioner, error) {
	if client.DynamicClient == nil {
		return nil, fmt.Errorf("dynamic client not available")
	}

	// Look for cluster-autoscaler deployment
	deploys, err := client.ClientSet.AppsV1().Deployments("kube-system").List(ctx, metav1.ListOptions{
		LabelSelector: "app=cluster-autoscaler",
	})
	if err != nil {
		return nil, err
	}

	if len(deploys.Items) == 0 {
		return nil, nil
	}

	// Determine cloud provider from cluster
	provider := detectClusterAutoscalerProvider(ctx, client)

	return &NodeProvisioner{
		Name:     deploys.Items[0].Name,
		Type:     ProvisionerTypeClusterAutoscaler,
		Provider: provider,
		Status: ProvisionerStatus{
			Ready: deploys.Items[0].Status.ReadyReplicas > 0,
		},
	}, nil
}

// detectKarpenterProvider determines which cloud provider Karpenter is configured for
func detectKarpenterProvider(ctx context.Context, client *ClusterConn) string {
	// Check node labels to determine provider
	nodes, err := client.ClientSet.CoreV1().Nodes().List(ctx, metav1.ListOptions{Limit: 1})
	if err != nil || len(nodes.Items) == 0 {
		return "unknown"
	}

	node := nodes.Items[0]
	if _, ok := node.Labels["eks.amazonaws.com/nodegroup"]; ok {
		return "aws"
	}
	if _, ok := node.Labels["karpenter.k8s.aws/instance-type"]; ok {
		return "aws"
	}
	if _, ok := node.Labels["kubernetes.azure.com/cluster"]; ok {
		return "azure"
	}
	if _, ok := node.Labels["cloud.google.com/gke-nodepool"]; ok {
		return "gcp"
	}

	return "unknown"
}

// detectClusterAutoscalerProvider determines cloud provider for Cluster Autoscaler
func detectClusterAutoscalerProvider(ctx context.Context, client *ClusterConn) string {
	nodes, err := client.ClientSet.CoreV1().Nodes().List(ctx, metav1.ListOptions{Limit: 1})
	if err != nil || len(nodes.Items) == 0 {
		return "unknown"
	}

	node := nodes.Items[0]
	providerID := node.Spec.ProviderID

	switch {
	case strings.Contains(providerID, "aws://"):
		return "aws"
	case strings.Contains(providerID, "azure://"):
		return "azure"
	case strings.Contains(providerID, "gce://"):
		return "gcp"
	default:
		return "unknown"
	}
}

// FetchKarpenterNodePools fetches AWS Karpenter NodePool details
func FetchKarpenterNodePools(ctx context.Context, client *ClusterConn) ([]NodePool, error) {
	var nodePools []NodePool

	if client.DynamicClient == nil {
		return nodePools, nil
	}

	// Fetch nodes for utilization calculation
	nodes, err := client.ClientSet.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nodePools, err
	}
	nodeMap := make(map[string]corev1.Node)
	for _, n := range nodes.Items {
		nodeMap[n.Name] = n
	}

	// Fetch node metrics
	var nodeMetricsMap map[string]v1beta1.NodeMetrics
	if client.MetricsClient != nil {
		nodeMetricsList, _ := client.MetricsClient.MetricsV1beta1().NodeMetricses().List(ctx, metav1.ListOptions{})
		nodeMetricsMap = make(map[string]v1beta1.NodeMetrics)
		if nodeMetricsList != nil {
			for _, m := range nodeMetricsList.Items {
				nodeMetricsMap[m.Name] = m
			}
		}
	}

	// Fetch NodePools (v1beta1) or Provisioners (v1alpha5)
	gvr := schema.GroupVersionResource{Group: "karpenter.sh", Version: "v1beta1", Resource: "nodepools"}
	nps, err := client.DynamicClient.Resource(gvr).List(ctx, metav1.ListOptions{})
	if err != nil {
		gvr = schema.GroupVersionResource{Group: "karpenter.sh", Version: "v1alpha5", Resource: "provisioners"}
		nps, err = client.DynamicClient.Resource(gvr).List(ctx, metav1.ListOptions{})
		if err != nil {
			return nodePools, err
		}
	}

	for _, np := range nps.Items {
		npName := np.GetName()
		spec, _ := np.Object["spec"].(map[string]interface{})
		status, _ := np.Object["status"].(map[string]interface{})

		pool := NodePool{
			Name:              npName,
			ProvisionerType:   ProvisionerTypeKarpenter,
			DisruptionBudgets: make(map[string]string),
			Labels:            make(map[string]string),
		}

		// Extract instance types from requirements
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
												pool.InstanceTypes = append(pool.InstanceTypes, vs)
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
										pool.DisruptionBudgets["default"] = nodes
									}
								}
							}
						}
						if consolidation, ok := disruption["consolidationPolicy"].(string); ok {
							pool.ConsolidationEnabled = consolidation == "WhenUnderutilized" || consolidation == "WhenEmpty"
						}
					}
				}
			}
		}

		// Count nodes belonging to this pool
		var poolNodes []corev1.Node
		for _, node := range nodes.Items {
			if node.Labels["karpenter.sh/nodepool"] == npName ||
				node.Labels["karpenter.sh/provisioner-name"] == npName {
				poolNodes = append(poolNodes, node)
				pool.TotalNodes++

				for _, cond := range node.Status.Conditions {
					if cond.Type == corev1.NodeReady && cond.Status == corev1.ConditionTrue {
						pool.ReadyNodes++
					}
				}
			}
		}

		// Calculate utilization
		pool.UtilizationPercent = calculateNodePoolUtilization(poolNodes, nodeMetricsMap)
		pool.BinPackingEfficiency = calculateBinPackingEfficiency(poolNodes, pool.UtilizationPercent)

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
							pool.PendingNodes++
						}
						for _, c := range conditions {
							if cMap, ok := c.(map[string]interface{}); ok {
								if cMap["type"] == "Drifted" && cMap["status"] == "True" {
									pool.DriftedNodes++
									}
							}
						}
					}
				}
			}
		}

		// Check for misconfigurations
		if status != nil {
			if conditions, ok := status["conditions"].([]interface{}); ok {
				for _, c := range conditions {
					if cMap, ok := c.(map[string]interface{}); ok {
						if cType, ok := cMap["type"].(string); ok && cType == "NodePoolReady" {
							if cStatus, ok := cMap["status"].(string); ok && cStatus != "True" {
								reason, _ := cMap["reason"].(string)
								message, _ := cMap["message"].(string)
								pool.Misconfigurations = append(pool.Misconfigurations,
									fmt.Sprintf("NodePool not ready: %s (%s)", reason, message))
							}
						}
					}
				}
			}
		}

		nodePools = append(nodePools, pool)
	}

	return nodePools, nil
}

// FetchAzureNAPNodePools fetches Azure Node Auto-Provisioning pool details
func FetchAzureNAPNodePools(ctx context.Context, client *ClusterConn) ([]NodePool, error) {
	var nodePools []NodePool

	if client.DynamicClient == nil {
		return nodePools, nil
	}

	// Azure NAP uses AKS agent pools, which we can detect from node labels
	nodes, err := client.ClientSet.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nodePools, err
	}

	// Fetch node metrics
	var nodeMetricsMap map[string]v1beta1.NodeMetrics
	if client.MetricsClient != nil {
		nodeMetricsList, _ := client.MetricsClient.MetricsV1beta1().NodeMetricses().List(ctx, metav1.ListOptions{})
		nodeMetricsMap = make(map[string]v1beta1.NodeMetrics)
		if nodeMetricsList != nil {
			for _, m := range nodeMetricsList.Items {
				nodeMetricsMap[m.Name] = m
			}
		}
	}

	// Group nodes by agent pool
	agentPoolMap := make(map[string][]corev1.Node)
	for _, node := range nodes.Items {
		// Azure AKS nodes have "agentpool" label
		if poolName, ok := node.Labels["agentpool"]; ok {
			agentPoolMap[poolName] = append(agentPoolMap[poolName], node)
		}
	}

	// Create NodePool for each agent pool
	for poolName, poolNodes := range agentPoolMap {
		// Ensure pool name is never empty
		displayName := poolName
		if displayName == "" {
			displayName = "default"
		}
		pool := NodePool{
			Name:              displayName,
			ProvisionerType:   ProvisionerTypeAzureNAP,
			DisruptionBudgets: make(map[string]string),
			Labels:            make(map[string]string),
			AzureNodePool: &AzureNodePoolConfig{
				Mode: "User", // Default
			},
		}

		// Extract VM sizes from node labels and calculate capacity
		vmSizeSet := make(map[string]bool)
		for _, node := range poolNodes {
			if vmSize, ok := node.Labels["node.kubernetes.io/instance-type"]; ok {
				vmSizeSet[vmSize] = true
			}
			// Check if this is a system pool
			if _, ok := node.Labels["kubernetes.azure.com/mode"]; ok {
				pool.AzureNodePool.Mode = "System"
			}
			pool.TotalNodes++

			// Calculate total capacity from node
			cpuCap := int(node.Status.Capacity.Cpu().Value())
			memCap := int(node.Status.Capacity.Memory().Value() / (1024 * 1024 * 1024)) // Convert to GB
			pool.TotalCPUs += cpuCap
			pool.TotalMemoryGB += memCap

			for _, cond := range node.Status.Conditions {
				if cond.Type == corev1.NodeReady && cond.Status == corev1.ConditionTrue {
					pool.ReadyNodes++
				}
			}
		}

		for vmSize := range vmSizeSet {
			pool.VMSizeNames = append(pool.VMSizeNames, vmSize)
		}

		// Calculate utilization
		pool.UtilizationPercent = calculateNodePoolUtilization(poolNodes, nodeMetricsMap)
		pool.BinPackingEfficiency = calculateBinPackingEfficiency(poolNodes, pool.UtilizationPercent)

		// Estimate costs based on Azure VM sizes
		pool.CostPerCPU = estimateAzureCostPerCPU(pool.VMSizeNames)
		pool.CostPerGBMemory = estimateAzureCostPerMemory(pool.VMSizeNames)

		// Calculate total monthly cost using per-instance pricing for accuracy
		// Sum the cost of each individual node based on its VM size
		for _, node := range poolNodes {
			if vmSize, ok := node.Labels["node.kubernetes.io/instance-type"]; ok {
				pool.TotalMonthlyCost += estimateAzureNodeMonthlyCost(vmSize)
			} else {
				// Fallback: use capacity-based calculation if VM size unknown
				cpuCap := int(node.Status.Capacity.Cpu().Value())
				memCap := int(node.Status.Capacity.Memory().Value() / (1024 * 1024 * 1024))
				pool.TotalMonthlyCost += float64(cpuCap)*pool.CostPerCPU + float64(memCap)*pool.CostPerGBMemory
			}
		}

		// Check for autoscaling
		for _, node := range poolNodes {
			if _, ok := node.Labels["kubernetes.azure.com/scaledown-needed"]; ok {
				pool.Misconfigurations = append(pool.Misconfigurations,
					"Node marked for scale-down - potential misconfiguration")
			}
			if _, ok := node.Labels["kubernetes.azure.com/scaling-enabled"]; ok {
				pool.AzureNodePool.EnableAutoScaling = true
				pool.ConsolidationEnabled = true
			}
		}

		nodePools = append(nodePools, pool)
	}

	return nodePools, nil
}

// calculateNodePoolUtilization calculates average utilization for a set of nodes
func calculateNodePoolUtilization(nodes []corev1.Node, nodeMetrics map[string]v1beta1.NodeMetrics) float64 {
	var totalCpuCap, totalCpuUsage, totalMemCap, totalMemUsage float64

	for _, node := range nodes {
		cpuCap := float64(node.Status.Capacity.Cpu().MilliValue()) / 1000.0
		memCap := float64(node.Status.Capacity.Memory().Value()) / (1024 * 1024 * 1024) // GB
		totalCpuCap += cpuCap
		totalMemCap += memCap

		if m, ok := nodeMetrics[node.Name]; ok {
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
		return (cpuUtil + memUtil) / 2
	}

	return 0
}

// calculateBinPackingEfficiency calculates bin packing efficiency
func calculateBinPackingEfficiency(nodes []corev1.Node, utilization float64) float64 {
	if utilization == 0 || len(nodes) == 0 {
		return 0
	}

	avgUtilization := utilization / 100
	nodeCountFactor := float64(len(nodes)) / 10.0
	if nodeCountFactor > 1 {
		nodeCountFactor = 1
	}

	efficiency := avgUtilization * (0.5 + 0.5*nodeCountFactor) * 100
	if efficiency > 100 {
		efficiency = 100
	}

	return efficiency
}

// AzureVMSpec defines CPU and memory for Azure VM sizes
type AzureVMSpec struct {
	CPUs     int
	MemoryGB int
	CostUSD  float64 // Monthly cost in USD (approximate Pay-as-you-go Linux pricing)
}

// azureVMSizeMap contains approximate monthly costs for common Azure VM sizes
// Prices are approximate Pay-as-you-go Linux rates (West US 2), 730 hours/month
var azureVMSizeMap = map[string]AzureVMSpec{
	// Burstable B-series ( economical for dev/test, burst capable)
	"Standard_B1s":   {CPUs: 1, MemoryGB: 1, CostUSD: 13.14},
	"Standard_B1ms":  {CPUs: 1, MemoryGB: 2, CostUSD: 26.28},
	"Standard_B2s":   {CPUs: 2, MemoryGB: 4, CostUSD: 52.56},
	"Standard_B2ms":  {CPUs: 2, MemoryGB: 8, CostUSD: 105.12},
	"Standard_B4ms":  {CPUs: 4, MemoryGB: 16, CostUSD: 210.24},
	"Standard_B8ms":  {CPUs: 8, MemoryGB: 32, CostUSD: 420.48},
	"Standard_B12ms": {CPUs: 12, MemoryGB: 48, CostUSD: 630.72},
	"Standard_B16ms": {CPUs: 16, MemoryGB: 64, CostUSD: 840.96},
	"Standard_B20ms": {CPUs: 20, MemoryGB: 80, CostUSD: 1051.20},

	// General purpose Dsv3-series (most common for AKS)
	"Standard_D2s_v3":  {CPUs: 2, MemoryGB: 8, CostUSD: 70.08},
	"Standard_D4s_v3":  {CPUs: 4, MemoryGB: 16, CostUSD: 140.16},
	"Standard_D8s_v3":  {CPUs: 8, MemoryGB: 32, CostUSD: 280.32},
	"Standard_D16s_v3": {CPUs: 16, MemoryGB: 64, CostUSD: 560.64},
	"Standard_D32s_v3": {CPUs: 32, MemoryGB: 128, CostUSD: 1121.28},
	"Standard_D48s_v3": {CPUs: 48, MemoryGB: 192, CostUSD: 1681.92},
	"Standard_D64s_v3": {CPUs: 64, MemoryGB: 256, CostUSD: 2242.56},

	// General purpose Dv3-series (no SSD)
	"Standard_D2_v3":  {CPUs: 2, MemoryGB: 8, CostUSD: 70.08},
	"Standard_D4_v3":  {CPUs: 4, MemoryGB: 16, CostUSD: 140.16},
	"Standard_D8_v3":  {CPUs: 8, MemoryGB: 32, CostUSD: 280.32},
	"Standard_D16_v3": {CPUs: 16, MemoryGB: 64, CostUSD: 560.64},
	"Standard_D32_v3": {CPUs: 32, MemoryGB: 128, CostUSD: 1121.28},
	"Standard_D48_v3": {CPUs: 48, MemoryGB: 192, CostUSD: 1681.92},
	"Standard_D64_v3": {CPUs: 64, MemoryGB: 256, CostUSD: 2242.56},

	// General purpose Dsv4-series
	"Standard_D2s_v4":  {CPUs: 2, MemoryGB: 8, CostUSD: 70.08},
	"Standard_D4s_v4":  {CPUs: 4, MemoryGB: 16, CostUSD: 140.16},
	"Standard_D8s_v4":  {CPUs: 8, MemoryGB: 32, CostUSD: 280.32},
	"Standard_D16s_v4": {CPUs: 16, MemoryGB: 64, CostUSD: 560.64},
	"Standard_D32s_v4": {CPUs: 32, MemoryGB: 128, CostUSD: 1121.28},
	"Standard_D48s_v4": {CPUs: 48, MemoryGB: 192, CostUSD: 1681.92},
	"Standard_D64s_v4": {CPUs: 64, MemoryGB: 256, CostUSD: 2242.56},

	// General purpose Dsv5-series
	"Standard_D2s_v5":  {CPUs: 2, MemoryGB: 8, CostUSD: 70.08},
	"Standard_D4s_v5":  {CPUs: 4, MemoryGB: 16, CostUSD: 140.16},
	"Standard_D8s_v5":  {CPUs: 8, MemoryGB: 32, CostUSD: 280.32},
	"Standard_D16s_v5": {CPUs: 16, MemoryGB: 64, CostUSD: 560.64},
	"Standard_D32s_v5": {CPUs: 32, MemoryGB: 128, CostUSD: 1121.28},
	"Standard_D48s_v5": {CPUs: 48, MemoryGB: 192, CostUSD: 1681.92},
	"Standard_D64s_v5": {CPUs: 64, MemoryGB: 256, CostUSD: 2242.56},

	// Memory optimized Esv3-series
	"Standard_E2s_v3":  {CPUs: 2, MemoryGB: 16, CostUSD: 91.98},
	"Standard_E4s_v3":  {CPUs: 4, MemoryGB: 32, CostUSD: 183.96},
	"Standard_E8s_v3":  {CPUs: 8, MemoryGB: 64, CostUSD: 367.92},
	"Standard_E16s_v3": {CPUs: 16, MemoryGB: 128, CostUSD: 735.84},
	"Standard_E20s_v3": {CPUs: 20, MemoryGB: 160, CostUSD: 919.80},
	"Standard_E32s_v3": {CPUs: 32, MemoryGB: 256, CostUSD: 1471.68},
	"Standard_E48s_v3": {CPUs: 48, MemoryGB: 384, CostUSD: 2207.52},
	"Standard_E64s_v3": {CPUs: 64, MemoryGB: 432, CostUSD: 2943.36},
	"Standard_E64is_v3": {CPUs: 64, MemoryGB: 432, CostUSD: 2943.36},

	// Memory optimized Esv4-series
	"Standard_E2s_v4":  {CPUs: 2, MemoryGB: 16, CostUSD: 91.98},
	"Standard_E4s_v4":  {CPUs: 4, MemoryGB: 32, CostUSD: 183.96},
	"Standard_E8s_v4":  {CPUs: 8, MemoryGB: 64, CostUSD: 367.92},
	"Standard_E16s_v4": {CPUs: 16, MemoryGB: 128, CostUSD: 735.84},
	"Standard_E20s_v4": {CPUs: 20, MemoryGB: 160, CostUSD: 919.80},
	"Standard_E32s_v4": {CPUs: 32, MemoryGB: 256, CostUSD: 1471.68},
	"Standard_E48s_v4": {CPUs: 48, MemoryGB: 384, CostUSD: 2207.52},
	"Standard_E64s_v4": {CPUs: 64, MemoryGB: 504, CostUSD: 2943.36},

	// Compute optimized Fsv2-series
	"Standard_F2s_v2":  {CPUs: 2, MemoryGB: 4, CostUSD: 56.88},
	"Standard_F4s_v2":  {CPUs: 4, MemoryGB: 8, CostUSD: 113.76},
	"Standard_F8s_v2":  {CPUs: 8, MemoryGB: 16, CostUSD: 227.52},
	"Standard_F16s_v2": {CPUs: 16, MemoryGB: 32, CostUSD: 455.04},
	"Standard_F32s_v2": {CPUs: 32, MemoryGB: 64, CostUSD: 910.08},
	"Standard_F48s_v2": {CPUs: 48, MemoryGB: 96, CostUSD: 1365.12},
	"Standard_F64s_v2": {CPUs: 64, MemoryGB: 128, CostUSD: 1820.16},
	"Standard_F72s_v2": {CPUs: 72, MemoryGB: 144, CostUSD: 2047.68},

	// GPU-enabled NC-series (approximate)
	"Standard_NC6":   {CPUs: 6, MemoryGB: 56, CostUSD: 657.00},
	"Standard_NC12":  {CPUs: 12, MemoryGB: 112, CostUSD: 1314.00},
	"Standard_NC24":  {CPUs: 24, MemoryGB: 224, CostUSD: 2628.00},
	"Standard_NC6s_v2":  {CPUs: 6, MemoryGB: 112, CostUSD: 876.00},
	"Standard_NC12s_v2": {CPUs: 12, MemoryGB: 224, CostUSD: 1752.00},
	"Standard_NC24s_v2": {CPUs: 24, MemoryGB: 448, CostUSD: 3504.00},
	"Standard_NC6s_v3":  {CPUs: 6, MemoryGB: 112, CostUSD: 1095.00},
	"Standard_NC12s_v3": {CPUs: 12, MemoryGB: 224, CostUSD: 2190.00},
	"Standard_NC24s_v3": {CPUs: 24, MemoryGB: 448, CostUSD: 4380.00},

	// NCas T4 series (AMD-based with NVIDIA T4 GPU) - common in AKS
	// Note: Keys must match normalized format (e.g., Standard_Nc8as_T4_V3)
	"Standard_Nc4as_T4_V3":  {CPUs: 4, MemoryGB: 28, CostUSD: 351.00},
	"Standard_Nc8as_T4_V3":  {CPUs: 8, MemoryGB: 56, CostUSD: 702.00},
	"Standard_Nc16as_T4_V3": {CPUs: 16, MemoryGB: 112, CostUSD: 1404.00},
	"Standard_Nc64as_T4_V3": {CPUs: 64, MemoryGB: 440, CostUSD: 5616.00},

	// NCads H100 series (AMD-based with NVIDIA H100 GPU)
	"Standard_Nc40ads_H100_V5": {CPUs: 40, MemoryGB: 320, CostUSD: 4234.00},
	"Standard_Nc80ads_H100_V5": {CPUs: 80, MemoryGB: 640, CostUSD: 8468.00},

	// Older D-series (DS v2) - still common
	"Standard_DS1_v2":  {CPUs: 1, MemoryGB: 3, CostUSD: 43.80},
	"Standard_DS2_v2":  {CPUs: 2, MemoryGB: 7, CostUSD: 87.60},
	"Standard_DS3_v2":  {CPUs: 4, MemoryGB: 14, CostUSD: 175.20},
	"Standard_DS4_v2":  {CPUs: 8, MemoryGB: 28, CostUSD: 350.40},
	"Standard_DS5_v2":  {CPUs: 16, MemoryGB: 56, CostUSD: 700.80},

	// Dv2 without SSD
	"Standard_D1_v2":  {CPUs: 1, MemoryGB: 3, CostUSD: 43.80},
	"Standard_D2_v2":  {CPUs: 2, MemoryGB: 7, CostUSD: 87.60},
	"Standard_D3_v2":  {CPUs: 4, MemoryGB: 14, CostUSD: 175.20},
	"Standard_D4_v2":  {CPUs: 8, MemoryGB: 28, CostUSD: 350.40},
	"Standard_D5_v2":  {CPUs: 16, MemoryGB: 56, CostUSD: 700.80},
}

// estimateAzureCostPerCPU returns cost per CPU based on specific VM sizes
// Falls back to series-based estimation for unknown sizes
func estimateAzureCostPerCPU(vmSizes []string) float64 {
	if len(vmSizes) == 0 {
		return 35.04 // Default D-series: $70.08 / 2 CPUs
	}

	totalCost := 0.0
	totalCPUs := 0
	unknownSizes := 0

	for _, vmSize := range vmSizes {
		// Normalize the size name (remove _ if needed)
		normalizedSize := normalizeVMSize(vmSize)

		if spec, ok := azureVMSizeMap[normalizedSize]; ok {
			totalCost += spec.CostUSD
			totalCPUs += spec.CPUs
		} else {
			// Fall back to series-based estimation
			costPerCPU := getSeriesCostPerCPU(vmSize)
			totalCost += costPerCPU * 2 // Assume 2 CPUs for unknown
			totalCPUs += 2
			unknownSizes++
		}
	}

	if totalCPUs > 0 {
		return totalCost / float64(totalCPUs)
	}
	return 35.04
}

// estimateAzureCostPerMemory returns cost per GB based on specific VM sizes
func estimateAzureCostPerMemory(vmSizes []string) float64 {
	if len(vmSizes) == 0 {
		return 4.38 // Default D-series: $35.04 / 8 GB
	}

	totalCost := 0.0
	totalMemory := 0

	for _, vmSize := range vmSizes {
		normalizedSize := normalizeVMSize(vmSize)

		if spec, ok := azureVMSizeMap[normalizedSize]; ok {
			totalCost += spec.CostUSD
			totalMemory += spec.MemoryGB
		} else {
			// Fall back to series-based estimation
			memGB := getSeriesDefaultMemory(vmSize)
			costPerGB := getSeriesCostPerMemory(vmSize)
			totalCost += costPerGB * float64(memGB)
			totalMemory += memGB
		}
	}

	if totalMemory > 0 {
		return totalCost / float64(totalMemory)
	}
	return 4.38
}

// estimateAzureNodeMonthlyCost returns the monthly cost for a specific VM size
func estimateAzureNodeMonthlyCost(vmSize string) float64 {
	normalizedSize := normalizeVMSize(vmSize)
	if spec, ok := azureVMSizeMap[normalizedSize]; ok {
		return spec.CostUSD
	}
	// Default to D2s_v3 cost if unknown
	return 70.08
}

// normalizeVMSize normalizes Azure VM size names
func normalizeVMSize(vmSize string) string {
	// Remove any leading/trailing whitespace
	size := strings.TrimSpace(vmSize)

	// Azure VM sizes are typically in Title Case (e.g., "Standard_NC6")
	// Kubernetes labels may be lowercase, so we normalize to Title Case
	// Examples:
	//   "standard_nc6" -> "Standard_NC6"
	//   "STANDARD_NC6" -> "Standard_NC6"
	//   "Standard_NC6" -> "Standard_NC6" (no change)

	// First uppercase the first letter, lowercase the rest of each part
	parts := strings.Split(size, "_")
	for i, part := range parts {
		if len(part) > 0 {
			parts[i] = strings.ToUpper(part[:1]) + strings.ToLower(part[1:])
		}
	}
	return strings.Join(parts, "_")
}

// getSeriesCostPerCPU returns fallback cost per CPU for unknown sizes
func getSeriesCostPerCPU(vmSize string) float64 {
	size := strings.ToUpper(vmSize)
	switch {
	case strings.Contains(size, "STANDARD_B"):
		return 26.28 // B2ms: $52.56 / 2
	case strings.Contains(size, "STANDARD_E"):
		return 45.99 // E2s_v3: $91.98 / 2
	case strings.Contains(size, "STANDARD_F"):
		return 28.44 // F2s_v2: $56.88 / 2
	case strings.Contains(size, "STANDARD_L"):
		return 43.80 // Assume similar to D
	case strings.Contains(size, "STANDARD_N"):
		return 109.50 // GPU is expensive
	default:
		return 35.04 // D2s_v3: $70.08 / 2
	}
}

// getSeriesCostPerMemory returns fallback cost per GB for unknown sizes
func getSeriesCostPerMemory(vmSize string) float64 {
	size := strings.ToUpper(vmSize)
	switch {
	case strings.Contains(size, "STANDARD_B"):
		return 6.57 // B2ms: $52.56 / 8
	case strings.Contains(size, "STANDARD_E"):
		return 5.75 // E2s_v3: $91.98 / 16
	case strings.Contains(size, "STANDARD_F"):
		return 14.22 // F2s_v2: $56.88 / 4
	case strings.Contains(size, "STANDARD_L"):
		return 5.48 // Similar to D
	case strings.Contains(size, "STANDARD_N"):
		return 11.73 // GPU nodes
	default:
		return 4.38 // D2s_v3: $70.08 / 16
	}
}

// getSeriesDefaultMemory returns default memory for series
func getSeriesDefaultMemory(vmSize string) int {
	size := strings.ToUpper(vmSize)
	switch {
	case strings.Contains(size, "STANDARD_B"):
		return 8
	case strings.Contains(size, "STANDARD_E"):
		return 16
	case strings.Contains(size, "STANDARD_F"):
		return 4
	case strings.Contains(size, "STANDARD_L"):
		return 8
	case strings.Contains(size, "STANDARD_N"):
		return 56
	default:
		return 8
	}
}
