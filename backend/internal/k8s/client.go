package k8s

import (
	"flag"
	"path/filepath"
	"sync"
	"os"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
)

var (
	ClientSet *kubernetes.Clientset
	once      sync.Once
)

// InitK8sClient initializes the Kubernetes clientset singleton
func InitK8sClient() (*kubernetes.Clientset, error) {
	var err error
	once.Do(func() {
		var config *rest.Config
		
		// Try in-cluster config first
		config, err = rest.InClusterConfig()
		if err != nil {
			// Fallback to local kubeconfig
			var kubeconfig *string
			if home := homedir.HomeDir(); home != "" {
				s := filepath.Join(home, ".kube", "config")
				kubeconfig = &s
			} else {
				// Should have been provided via flags if home is empty, but we'll try default
				s := ""
				kubeconfig = &s
			}
			
			// If running via go run, flags might interfere, so we check env var or default
			if envKube := os.Getenv("KUBECONFIG"); envKube != "" {
				config, err = clientcmd.BuildConfigFromFlags("", envKube)
			} else {
				// Basic flag parsing if not initiated
				if flag.Lookup("kubeconfig") == nil {
					flag.String("kubeconfig", *kubeconfig, "absolute path to the kubeconfig file")
					flag.Parse()
				}
				config, err = clientcmd.BuildConfigFromFlags("", *kubeconfig)
			}
		}

		if err != nil {
			return
		}

		ClientSet, err = kubernetes.NewForConfig(config)
	})

	return ClientSet, err
}
