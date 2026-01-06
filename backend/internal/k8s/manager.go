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
)

// Cluster represents a connected Kubernetes context
type Cluster struct {
	ID            string // Usually the context name
	Name          string
	ClientSet     *kubernetes.Clientset
	DynamicClient *dynamic.DynamicClient
	Config        *rest.Config
}

type ClusterManager struct {
	clusters map[string]*Cluster
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
			clusters: make(map[string]*Cluster),
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

		m.clusters[contextName] = &Cluster{
			ID:            contextName,
			Name:          contextName,
			ClientSet:     clientset,
			DynamicClient: dynamicClient,
			Config:        restConfig,
		}
		fmt.Printf("Loaded cluster: %s\n", contextName)
	}

	// If running in-cluster (Pod), attempt to load that as "in-cluster" if map is empty
	if len(m.clusters) == 0 {
		if config, err := rest.InClusterConfig(); err == nil {
			cls, _ := kubernetes.NewForConfig(config)
			dyn, _ := dynamic.NewForConfig(config)
			m.clusters["in-cluster"] = &Cluster{
				ID: "in-cluster", Name: "In Cluster", ClientSet: cls, DynamicClient: dyn, Config: config,
			}
		}
	}

	return nil
}

// GetCluster returns a cluster by ID
func (m *ClusterManager) GetCluster(id string) (*Cluster, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if cluster, ok := m.clusters[id]; ok {
		return cluster, nil
	}
	return nil, fmt.Errorf("cluster not found: %s", id)
}

// ListClusters returns all loaded clusters
func (m *ClusterManager) ListClusters() []*Cluster {
	m.mu.RLock()
	defer m.mu.RUnlock()

	list := make([]*Cluster, 0, len(m.clusters))
	for _, c := range m.clusters {
		list = append(list, c)
	}
	return list
}
