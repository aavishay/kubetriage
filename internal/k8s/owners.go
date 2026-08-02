package k8s

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// ResolveTopLevelController walks the owner-reference chain from a pod's direct
// owner (usually a ReplicaSet or Job) up to the top-level user-facing workload
// controller (Deployment, StatefulSet, DaemonSet, CronJob, etc.).
//
// This prevents reports from being stored under generated intermediate names like
// "deployment-abc1234567" when the workload the user cares about is simply
// "deployment".
func ResolveTopLevelController(ctx context.Context, client *kubernetes.Clientset, namespace string, owner metav1.OwnerReference) (string, string) {
	currentName := owner.Name
	currentKind := owner.Kind

	for {
		switch currentKind {
		case "ReplicaSet":
			rs, err := client.AppsV1().ReplicaSets(namespace).Get(ctx, currentName, metav1.GetOptions{})
			if err != nil || len(rs.OwnerReferences) == 0 {
				return currentName, currentKind
			}
			ref := rs.OwnerReferences[0]
			currentName = ref.Name
			currentKind = ref.Kind
		case "Job":
			job, err := client.BatchV1().Jobs(namespace).Get(ctx, currentName, metav1.GetOptions{})
			if err != nil || len(job.OwnerReferences) == 0 {
				return currentName, currentKind
			}
			ref := job.OwnerReferences[0]
			if ref.Kind == "CronJob" {
				currentName = ref.Name
				currentKind = ref.Kind
			} else {
				return currentName, currentKind
			}
		default:
			// Deployment, StatefulSet, DaemonSet, CronJob, or any unknown kind -
			// stop here and report what we have.
			return currentName, currentKind
		}
	}
}
