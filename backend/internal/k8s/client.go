package k8s

import (
	"fmt"
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
func InitK8sClient() (*kubernetes.Clientset, error) {
	var err error
	once.Do(func() {
		// Initialize Manager
		mgr := InitManager()
		err = mgr.LoadClustersFromKubeconfig()
		if err != nil {
			// Try creating a default config if loading from file failed (e.g. in-cluster)
			// For now, we rely on LoadClustersFromKubeconfig's fallback
		}

		// Set default client to the first one found (or "minikube"/"docker-desktop" if preferred)
		clusters := mgr.ListClusters()
		if len(clusters) > 0 {
			ClientSet = clusters[0].ClientSet
			DynamicClient = clusters[0].DynamicClient
			fmt.Printf("Default K8s Client set to: %s\n", clusters[0].Name)
		} else {
			err = fmt.Errorf("no clusters loaded")
		}
	})

	return ClientSet, err
}
