package k8s

import (
	"bytes"
	"context"
	"io"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes"
)

type LogOptions struct {
	Lines int64
}

// GetPodLogs fetches logs from the first container of a pod
func GetPodLogs(ctx context.Context, client *kubernetes.Clientset, namespace, podName string, opts *LogOptions) (string, error) {
	req := client.CoreV1().Pods(namespace).GetLogs(podName, &corev1.PodLogOptions{
		TailLines: &opts.Lines,
	})

	podLogs, err := req.Stream(ctx)
	if err != nil {
		return "", err
	}
	defer podLogs.Close()

	buf := new(bytes.Buffer)
	_, err = io.Copy(buf, podLogs)
	if err != nil {
		return "", err
	}

	return buf.String(), nil
}
