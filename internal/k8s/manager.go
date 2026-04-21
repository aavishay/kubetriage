package k8s

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
	"k8s.io/client-go/util/homedir"
	metrics "k8s.io/metrics/pkg/client/clientset/versioned"
)

// ClusterInfo holds static cluster info from kubeconfig (no live connection)
type ClusterInfo struct {
	ID        string // Usually the context name
	Name      string
	Namespace string
	Provider  string // e.g., "AKS", "EKS", "GKE"
}

// ClusterConn represents a connected Kubernetes context
type ClusterConn struct {
	ID            string // Usually the context name
	Name          string
	DisplayName   string // Custom display name (can be different from context name)
	ClientSet     *kubernetes.Clientset
	DynamicClient *dynamic.DynamicClient
	MetricsClient *metrics.Clientset
	Config        *rest.Config
	Namespace     string
	connected     bool // true if connection was successfully established
	lastError     error
}

// IsConnected returns true if this cluster has an active connection
func (c *ClusterConn) IsConnected() bool {
	if c == nil {
		return false
	}
	return c.connected && c.ClientSet != nil
}

type ClusterManager struct {
	clusters   map[string]*ClusterConn
	rawConfigs map[string][]byte // kubeconfig bytes per context (for lazy connection)
	mu         sync.RWMutex
}

var (
	Manager *ClusterManager
	onceMgr sync.Once
)

// rewriteLoopback replaces 127.0.0.1/localhost server addresses with
// host.docker.internal so the container can reach services on the host
// (e.g. minikube, kind). The original hostname is preserved as TLSClientConfig.ServerName
// so certificate verification still passes against the original cert SANs.
func rewriteLoopback(cfg *rest.Config) {
	if strings.Contains(cfg.Host, "127.0.0.1") || strings.Contains(cfg.Host, "localhost") {
		original := cfg.Host
		cfg.Host = strings.NewReplacer(
			"127.0.0.1", "host.docker.internal",
			"localhost", "host.docker.internal",
		).Replace(cfg.Host)
		// Keep TLS verification against the original hostname so minikube/kind
		// certs (which are signed for 127.0.0.1) continue to validate correctly.
		if cfg.TLSClientConfig.ServerName == "" {
			cfg.TLSClientConfig.ServerName = "127.0.0.1"
		}
		fmt.Printf("Rewriting loopback address: %s -> %s\n", original, cfg.Host)
	}
}

// InitManager initializes the global ClusterManager
func InitManager() *ClusterManager {
	onceMgr.Do(func() {
		Manager = &ClusterManager{
			clusters:   make(map[string]*ClusterConn),
			rawConfigs: make(map[string][]byte),
		}
	})
	return Manager
}

// LoadClustersFromKubeconfig loads all contexts from the default kubeconfig
// In VPN mode, this only stores config data - actual connections are made on-demand
func (m *ClusterManager) LoadClustersFromKubeconfig() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Find kubeconfig
	var kubeconfig string
	if home := homedir.HomeDir(); home != "" {
		kubeconfig = filepath.Join(home, ".kube", "config")
	}
	if envKube := os.Getenv("KUBECONFIG"); envKube != "" {
		kubeconfig = envKube
	}

	if kubeconfig == "" {
		return fmt.Errorf("kubeconfig not found")
	}

	// Load the raw config to get contexts
	config, err := clientcmd.LoadFromFile(kubeconfig)
	if err != nil {
		// Fallback to in-cluster if file not found
		return m.loadInCluster()
	}

	// Store raw config for lazy connection
	rawConfigBytes, err := clientcmd.Write(*config)
	if err != nil {
		return fmt.Errorf("failed to serialize kubeconfig: %v", err)
	}

	for contextName, ctx := range config.Contexts {
		// Get namespace for this context
		clientConfig := clientcmd.NewNonInteractiveClientConfig(
			*config,
			contextName,
			&clientcmd.ConfigOverrides{},
			nil,
		)
		namespace, _, _ := clientConfig.Namespace()

		// Detect provider from context or cluster info
		provider := detectProviderFromContext(ctx, config.Clusters[ctx.Cluster])

		// Store minimal info - DON'T connect yet
		m.clusters[contextName] = &ClusterConn{
			ID:        contextName,
			Name:      contextName,
			Namespace: namespace,
			connected: false, // Will connect on-demand
		}
		// Store raw config for this context for later connection
		m.rawConfigs[contextName] = rawConfigBytes
		fmt.Printf("Registered cluster (not connected): %s [%s]\n", contextName, provider)
	}

	// If running in-cluster (Pod), attempt to load that as "in-cluster" if map is empty
	if len(m.clusters) == 0 {
		return m.loadInCluster()
	}

	return nil
}

// loadInCluster loads the in-cluster configuration when running inside a Kubernetes pod
func (m *ClusterManager) loadInCluster() error {
	if config, err := rest.InClusterConfig(); err == nil {
		// For in-cluster, we can connect immediately since it's local
		cls, err := kubernetes.NewForConfig(config)
		if err != nil {
			return fmt.Errorf("failed to create in-cluster clientset: %v", err)
		}
		dyn, _ := dynamic.NewForConfig(config)
		met, _ := metrics.NewForConfig(config)
		m.clusters["in-cluster"] = &ClusterConn{
			ID:            "in-cluster",
			Name:          "In Cluster",
			ClientSet:     cls,
			DynamicClient: dyn,
			MetricsClient: met,
			Config:        config,
			connected:     true,
		}
		fmt.Println("Connected to in-cluster configuration")
	}
	return nil
}

// ConnectCluster establishes a live connection to the specified cluster
// This is called on-demand when the cluster is selected
func (m *ClusterManager) ConnectCluster(id string) (*ClusterConn, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	cluster, exists := m.clusters[id]
	if !exists {
		return nil, fmt.Errorf("cluster not found: %s", id)
	}

	// If already connected, return the existing connection
	if cluster.connected && cluster.ClientSet != nil {
		return cluster, nil
	}

	// Get the raw config for this cluster
	rawConfig, exists := m.rawConfigs[id]
	if !exists {
		// Might be in-cluster or dynamically added
		if cluster.Config != nil {
			// Try to reconnect with existing config
			clientset, err := kubernetes.NewForConfig(cluster.Config)
			if err != nil {
				cluster.lastError = err
				return cluster, fmt.Errorf("failed to reconnect to cluster %s: %v", id, err)
			}
			cluster.ClientSet = clientset
			cluster.connected = true
			return cluster, nil
		}
		return nil, fmt.Errorf("no configuration found for cluster: %s", id)
	}

	// Parse the kubeconfig
	apiConfig, err := clientcmd.Load(rawConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to parse kubeconfig for %s: %v", id, err)
	}

	// Create client config specifically for this context (not the current context)
	clientConfig := clientcmd.NewNonInteractiveClientConfig(
		*apiConfig,
		id, // Use the specific context ID
		&clientcmd.ConfigOverrides{},
		nil,
	)

	// Create REST config for the specific context
	config, err := clientConfig.ClientConfig()
	if err != nil {
		cluster.lastError = err
		return cluster, fmt.Errorf("failed to create client config for %s: %v", id, err)
	}
	rewriteLoopback(config)

	// Create Kubernetes clients
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		cluster.lastError = err
		return cluster, fmt.Errorf("failed to create clientset for %s: %v", id, err)
	}

	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		cluster.lastError = err
		return cluster, fmt.Errorf("failed to create dynamic client for %s: %v", id, err)
	}

	metricsClient, err := metrics.NewForConfig(config)
	if err != nil {
		// Metrics are optional
		fmt.Printf("Warning: Failed to create metrics client for %s: %v\n", id, err)
	}

	// Update the cluster with the live connection
	cluster.ClientSet = clientset
	cluster.DynamicClient = dynamicClient
	cluster.MetricsClient = metricsClient
	cluster.Config = config
	cluster.connected = true
	cluster.lastError = nil

	fmt.Printf("Connected to cluster: %s\n", id)
	return cluster, nil
}

// detectProviderFromContext attempts to detect the cloud provider from context/cluster info
func detectProviderFromContext(ctx *api.Context, cluster *api.Cluster) string {
	if cluster == nil {
		return "Unknown"
	}
	server := cluster.Server
	if server == "" {
		return "Unknown"
	}

	// Check for cloud provider patterns in server URL
	if contains(server, "azmk8s.io") || contains(server, "azure") {
		return "AKS"
	}
	if contains(server, "eks") || contains(server, "amazonaws.com") {
		return "EKS"
	}
	if contains(server, "gke") || contains(server, "googleapis.com") {
		return "GKE"
	}
	if contains(server, "127.0.0.1") || contains(server, "localhost") {
		return "Local"
	}

	return "On-Prem"
}

func contains(s, substr string) bool {
	return len(s) > 0 && len(substr) > 0 &&
		(s == substr || len(s) > len(substr) &&
			(s[:len(substr)] == substr ||
				s[len(s)-len(substr):] == substr ||
				containsSubstring(s, substr)))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// GetCluster returns a cluster by ID
// In VPN mode, this returns the cluster info without connecting
// Use ConnectCluster to establish a live connection
func (m *ClusterManager) GetCluster(id string) (*ClusterConn, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if cluster, ok := m.clusters[id]; ok {
		return cluster, nil
	}
	return nil, fmt.Errorf("cluster not found: %s", id)
}

// GetOrConnectCluster returns a cluster, connecting if not already connected
// Use this when the cluster is actively being used
func (m *ClusterManager) GetOrConnectCluster(id string) (*ClusterConn, error) {
	// Try to get existing connected cluster first
	m.mu.RLock()
	cluster, exists := m.clusters[id]
	m.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("cluster not found: %s", id)
	}

	// If already connected, return it
	if cluster.IsConnected() {
		return cluster, nil
	}

	// Not connected - establish connection (ConnectCluster handles locking)
	return m.ConnectCluster(id)
}

// ListClusters returns all loaded clusters
func (m *ClusterManager) ListClusters() []*ClusterConn {
	m.mu.RLock()
	defer m.mu.RUnlock()

	list := make([]*ClusterConn, 0, len(m.clusters))
	for _, c := range m.clusters {
		list = append(list, c)
	}
	return list
}

// AddClusterFromKubeconfig parses a raw kubeconfig and adds it to the manager
func (m *ClusterManager) AddClusterFromKubeconfig(rawConfig []byte, displayName string) (*ClusterConn, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// 1. Parse Config
	clientConfig, err := clientcmd.NewClientConfigFromBytes(rawConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to parse kubeconfig: %v", err)
	}
	raw, err := clientConfig.RawConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get raw config: %v", err)
	}

	// use the current context name, or "default" if missing
	contextName := raw.CurrentContext
	if contextName == "" {
		// fallback: try to pick the first context key
		for k := range raw.Contexts {
			contextName = k
			break
		}
	}
	if contextName == "" {
		contextName = "imported-cluster-" + fmt.Sprintf("%d", len(m.clusters)+1)
	}

	restConfig, err := clientConfig.ClientConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to create rest config: %v", err)
	}
	rewriteLoopback(restConfig)

	// 2. Create Clients
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create clientset: %v", err)
	}

	dynamicClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %v", err)
	}

	metricsClient, err := metrics.NewForConfig(restConfig)
	if err != nil {
		fmt.Printf("Warning: Failed to create metrics client: %v\n", err)
	}

	namespace, _, _ := clientConfig.Namespace()

	// Use display name if provided, otherwise use context name
	finalDisplayName := displayName
	if finalDisplayName == "" {
		finalDisplayName = contextName
	}

	// 3. Add to Map
	cluster := &ClusterConn{
		ID:            contextName, // using context name as ID for simplicity
		Name:          contextName,
		DisplayName:   finalDisplayName,
		ClientSet:     clientset,
		DynamicClient: dynamicClient,
		MetricsClient: metricsClient,
		Config:        restConfig,
		Namespace:     namespace,
	}

	m.clusters[cluster.ID] = cluster
	fmt.Printf(" dynamically registered cluster: %s (display: %s)\n", cluster.Name, cluster.DisplayName)
	return cluster, nil
}

// RemoveCluster removes a cluster by ID
func (m *ClusterManager) RemoveCluster(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.clusters, id)
}

// ClusterOperation is a function that operates on a cluster connection
type ClusterOperation func(*ClusterConn) error

// ForEachCluster iterates over all clusters and executes the provided operation.
// It returns an error if the manager is not initialized, or if any operation fails.
// Operations on clusters with nil ClientSet are skipped silently.
func (m *ClusterManager) ForEachCluster(op ClusterOperation) error {
	if m == nil {
		return fmt.Errorf("cluster manager not initialized")
	}
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, cluster := range m.clusters {
		if cluster.ClientSet == nil {
			continue
		}
		if err := op(cluster); err != nil {
			return err
		}
	}
	return nil
}

// FindFirstCluster iterates over clusters and returns the first successful result.
// Useful for operations that only need to find a resource in any cluster.
func FindFirstCluster[T any](m *ClusterManager, finder func(*ClusterConn) (T, bool)) (T, bool) {
	var zero T
	if m == nil {
		return zero, false
	}
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, cluster := range m.clusters {
		if cluster.ClientSet == nil {
			continue
		}
		if result, found := finder(cluster); found {
			return result, true
		}
	}
	return zero, false
}
