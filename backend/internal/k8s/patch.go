package k8s

import (
	"context"
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

// ApplyPatch applies a patch to a K8s resource
func ApplyPatch(gvr schema.GroupVersionResource, namespace, name string, patchType types.PatchType, patchData []byte) error {
	if DynamicClient == nil {
		return fmt.Errorf("dynamic client not initialized")
	}

	// Validate JSON if it's a JSON patch
	if patchType == types.JSONPatchType || patchType == types.MergePatchType {
		if !json.Valid(patchData) {
			return fmt.Errorf("invalid json patch data")
		}
	}

	_, err := DynamicClient.Resource(gvr).Namespace(namespace).Patch(
		context.TODO(),
		name,
		patchType,
		patchData,
		metav1.PatchOptions{},
	)

	return err
}
