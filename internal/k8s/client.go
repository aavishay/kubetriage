package k8s

import (
	"fmt"
	"log"
	"sync"

	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
)

var (
	ClientSet     *kubernetes.Clientset
	DynamicClient *dynamic.DynamicClient
	once          sync.Once
	GlobalManager *ClusterManager
)

func GetClusterManager() *ClusterManager {
	return GlobalManager
}

// InitK8sClient initializes the Kubernetes clientset singleton
// In VPN mode, this only registers clusters - connections are made on-demand
func InitK8sClient() (*kubernetes.Clientset, error) {
	var err error
	once.Do(func() {
		// Initialize Manager
		mgr := InitManager()
		GlobalManager = mgr // <-- FIX: Assign to exported variable
		err = mgr.LoadClustersFromKubeconfig()
		if err != nil {
			log.Printf("Warning: Failed to load clusters from kubeconfig: %v", err)
		}

		// In lazy mode, we don't pre-connect to any cluster
		// The first cluster that gets selected will be connected on-demand
		clusters := mgr.ListClusters()
		if len(clusters) > 0 {
			// Store reference to first cluster but don't connect yet
			fmt.Printf("Registered %d cluster(s) (connections deferred until selected)\n", len(clusters))
			for _, c := range clusters {
				fmt.Printf("  - %s\n", c.Name)
			}
		} else if err == nil {
			err = fmt.Errorf("no clusters loaded")
		}
	})

	return ClientSet, err
}

// GetClientForCluster returns a connected clientset for the specified cluster
// Connects on-demand if not already connected
func GetClientForCluster(clusterID string) (*kubernetes.Clientset, error) {
	if GlobalManager == nil {
		return nil, fmt.Errorf("cluster manager not initialized")
	}

	cluster, err := GlobalManager.GetOrConnectCluster(clusterID)
	if err != nil {
		return nil, err
	}

	if cluster.ClientSet == nil {
		return nil, fmt.Errorf("cluster %s is not reachable (may be behind VPN)", clusterID)
	}

	return cluster.ClientSet, nil
}
