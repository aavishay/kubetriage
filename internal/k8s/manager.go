package k8s

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
	metrics "k8s.io/metrics/pkg/client/clientset/versioned"
)

// ClusterConn represents a connected Kubernetes context
type ClusterConn struct {
	ID            string // Usually the context name
	Name          string
	ClientSet     *kubernetes.Clientset
	DynamicClient *dynamic.DynamicClient
	MetricsClient *metrics.Clientset
	Config        *rest.Config
	Namespace     string
}

type ClusterManager struct {
	clusters map[string]*ClusterConn
	mu       sync.RWMutex
}

var (
	Manager *ClusterManager
	onceMgr sync.Once
)

// InitManager initializes the global ClusterManager
func InitManager() *ClusterManager {
	onceMgr.Do(func() {
		Manager = &ClusterManager{
			clusters: make(map[string]*ClusterConn),
		}
	})
	return Manager
}

// LoadClustersFromKubeconfig loads all contexts from the default kubeconfig
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
		// For now, let's just return error or try in-cluster as a single "default" cluster
		return err
	}

	for contextName := range config.Contexts {
		// Build config for this specific context
		clientConfig := clientcmd.NewNonInteractiveClientConfig(
			*config,
			contextName,
			&clientcmd.ConfigOverrides{},
			nil,
		)
		restConfig, err := clientConfig.ClientConfig()
		if err != nil {
			fmt.Printf("Warning: Failed to create config for context %s: %v\n", contextName, err)
			continue
		}

		clientset, err := kubernetes.NewForConfig(restConfig)
		if err != nil {
			fmt.Printf("Warning: Failed to create clientset for context %s: %v\n", contextName, err)
			continue
		}

		dynamicClient, err := dynamic.NewForConfig(restConfig)
		if err != nil {
			fmt.Printf("Warning: Failed to create dynamic client for context %s: %v\n", contextName, err)
			continue
		}

		metricsClient, err := metrics.NewForConfig(restConfig)
		if err != nil {
			fmt.Printf("Warning: Failed to create metrics client for context %s: %v\n", contextName, err)
			// Don't continue, metrics are optional
		}

		namespace, _, _ := clientConfig.Namespace()

		m.clusters[contextName] = &ClusterConn{
			ID:            contextName,
			Name:          contextName,
			ClientSet:     clientset,
			DynamicClient: dynamicClient,
			MetricsClient: metricsClient,
			Config:        restConfig,
			Namespace:     namespace,
		}
		fmt.Printf("Loaded cluster: %s\n", contextName)
	}

	// If running in-cluster (Pod), attempt to load that as "in-cluster" if map is empty
	if len(m.clusters) == 0 {
		if config, err := rest.InClusterConfig(); err == nil {
			cls, _ := kubernetes.NewForConfig(config)
			dyn, _ := dynamic.NewForConfig(config)
			met, _ := metrics.NewForConfig(config)
			m.clusters["in-cluster"] = &ClusterConn{
				ID: "in-cluster", Name: "In Cluster", ClientSet: cls, DynamicClient: dyn, MetricsClient: met, Config: config,
			}
		}
	}

	return nil
}

// GetCluster returns a cluster by ID
func (m *ClusterManager) GetCluster(id string) (*ClusterConn, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if cluster, ok := m.clusters[id]; ok {
		return cluster, nil
	}
	return nil, fmt.Errorf("cluster not found: %s", id)
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
func (m *ClusterManager) AddClusterFromKubeconfig(rawConfig []byte) (*ClusterConn, error) {
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

	// 3. Add to Map
	cluster := &ClusterConn{
		ID:            contextName, // using context name as ID for simplicity
		Name:          contextName,
		ClientSet:     clientset,
		DynamicClient: dynamicClient,
		MetricsClient: metricsClient,
		Config:        restConfig,
		Namespace:     namespace,
	}

	m.clusters[cluster.ID] = cluster
	fmt.Printf(" dynamically registered cluster: %s\n", cluster.Name)
	return cluster, nil
}

// RemoveCluster removes a cluster by ID
func (m *ClusterManager) RemoveCluster(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.clusters, id)
}
