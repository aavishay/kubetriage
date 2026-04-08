package watcher

import (
	"context"
	"fmt"
	"log"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// scanSecurity checks strictly for security violations (Phase 4)
func (w *Watcher) scanSecurity(ctx context.Context, cls *k8s.ClusterConn) {
	client := cls.ClientSet
	if client == nil {
		return
	}

	// We scan Deployments for configuration issues (more stable than Pods for config)
	deployments, err := client.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("Watcher: Failed to list deployments for security scan in %s: %v", cls.ID, err)
		return
	}

	for _, deploy := range deployments.Items {
		w.checkSecurityContext(ctx, cls, deploy.Namespace, deploy.Name, "Deployment", deploy.Spec.Template.Spec)
	}

	// Scan StatefulSets
	sts, err := client.AppsV1().StatefulSets("").List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, s := range sts.Items {
			w.checkSecurityContext(ctx, cls, s.Namespace, s.Name, "StatefulSet", s.Spec.Template.Spec)
		}
	}

	// Scan DaemonSets
	ds, err := client.AppsV1().DaemonSets("").List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, d := range ds.Items {
			w.checkSecurityContext(ctx, cls, d.Namespace, d.Name, "DaemonSet", d.Spec.Template.Spec)
		}
	}
}

func (w *Watcher) checkSecurityContext(ctx context.Context, cls *k8s.ClusterConn, ns, name, kind string, podSpec corev1.PodSpec) {
	// Check 1: Privileged Containers
	for _, c := range podSpec.Containers {
		if c.SecurityContext != nil && c.SecurityContext.Privileged != nil && *c.SecurityContext.Privileged {
			w.reportSecurityViolation(
				ctx,
				cls,
				ns,
				name,
				kind,
				"Privileged Container Detected",
				fmt.Sprintf("Container '%s' is running in privileged mode. This provides full access to the host kernel.", c.Name),
				"High",
				w.generatePrivilegedPatch(c.Name),
			)
		}
	}

	// Check 2: RunAsRoot
	if podSpec.SecurityContext != nil && podSpec.SecurityContext.RunAsNonRoot != nil && !*podSpec.SecurityContext.RunAsNonRoot {
		w.reportSecurityViolation(
			ctx,
			cls,
			ns,
			name,
			kind,
			"Root Execution Allowed",
			"Pod is explicitly configured to allow running as Root (RunAsNonRoot=false).",
			"Medium",
			w.generateRunAsNonRootPatch(),
		)
	}

	// Check 3: Resource Limits (Phase 4 - Reliability/Governance)
	for _, c := range podSpec.Containers {
		if c.Resources.Limits == nil || (c.Resources.Limits.Cpu().IsZero() && c.Resources.Limits.Memory().IsZero()) {
			w.reportSecurityViolation(
				ctx,
				cls,
				ns,
				name,
				kind,
				"Missing Resource Limits",
				fmt.Sprintf("Container '%s' does not have CPU or Memory limits defined. This can lead to resource exhaustion of the node.", c.Name),
				"Low",
				"", // No auto-fix for limits as they require careful tuning (user should use Right-Sizer)
			)
		}
	}
}

func (w *Watcher) reportSecurityViolation(ctx context.Context, cls *k8s.ClusterConn, ns, name, kind, incidentType, analysis, severity, remediation string) {
	// Dedup checking
	var count int64
	db.DB.Model(&db.TriageReport{}).
		Where("cluster_id = ? AND namespace = ? AND workload_name = ? AND incident_type = ? AND is_read = ?", cls.ID, ns, name, incidentType, false).
		Count(&count)

	if count > 0 {
		return
	}

	report := db.TriageReport{
		ClusterID:              cls.ID,
		Namespace:              ns,
		WorkloadName:           name,
		Kind:                   kind,
		Severity:               severity,
		IncidentType:           incidentType,
		ApprovalStatus:         "Pending",
		Analysis:               fmt.Sprintf("### Security Violation Detected\n\n%s", analysis),
		AutoRemediationPayload: remediation,
	}


	if err := db.DB.Create(&report).Error; err != nil {
		log.Printf("Watcher: Failed to create security report: %v", err)
	} else {
		log.Printf("Watcher: Security Alert Created: %s on %s/%s", incidentType, ns, name)
	}
}

func (w *Watcher) generatePrivilegedPatch(containerName string) string {
	// JSON Patch or Strategic Merge Patch
	// For arrays (containers), strategic merge on name is cleaner if supported,
	// but specific path is safer for JSON patch.
	// Let's use Strategic Merge Patch format which is human readable and supported by our handler.
	return fmt.Sprintf(`
spec:
  template:
    spec:
      containers:
      - name: %s
        securityContext:
          privileged: false
`, containerName)
}

func (w *Watcher) generateRunAsNonRootPatch() string {
	return `
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
`
}
