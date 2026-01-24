# KubeTriage Roadmap (v1.0+)

## 🩺 Vision
To evolve from a **troubleshooting dashboard** into an **Autonomous SRE Guard**, proactive in detecting, triaging, and suggesting fixes for Kubernetes cluster health issues before they impact production.

---

## 📅 Phase 1: AI-Enhanced Diagnostics ("The Elite SRE")
*Goal: Deepen the AI's understanding of the cluster state and improve diagnostic fidelity.*

### 1. High-Fidelity AI Context
- **Multi-Source Context**: Pass not just logs, but matching Events, Metrics (Prometheus), and the full YAML Manifest to the AI.
- [x] **Interactive Triage**: Allow users to ask follow-up questions about a specific diagnosis (e.g., "Why do you think it is a memory leak?").
- [x] **Agentic Debugging**: Implement tool-calling so the AI can proactively fetch logs from sidecars or related services (e.g., Ingress) to verify its hypothesis.

### 2. Live Log Streaming
- [x] **WebSocket Streaming**: Replace "recent logs" polling with real-time sub-second log streaming.
- [x] **Global Search**: Search for strings across *all* pods in a namespace or deployment.

---

## 🤖 Phase 2: Proactive Triage ("The Work OS")
*Goal: Shift from reactive troubleshooting to proactive remediation.*

### 1. Incident Stream
- [x] **Cluster Watcher**: Background service that monitors the cluster for states like `CrashLoopBackOff`, `ImagePullBackOff`, or `OOMKilled`.
- [x] **Incident Cards**: Automatically create a "Triage Card" when an issue is detected, similar to a Kanban board for cluster health.
- [x] **Auto-Triage**: AI analyzes common issues in the background and populates the card with a "Quick Summary" and "Ready-to-Apply" fix before the SRE arrives.

### 2. Automation Engine (User-in-the-loop)
- **Recipe Engine**: Define triggers (e.g., "When 5xx error rate > 5%") and actions (e.g., "Initiate Blue/Green rollback").
- [x] **Approval Workflow**: All automated actions require human one-click approval via the dashboard or Slack.

---

## 🤝 Phase 3: Collaborative Triage ("The War Room")
*Goal: Enable teams to resolve incidents together in real-time.*

### 1. Real-Time Presence
- [x] **Presence Indicators**: See which teammates are currently looking at specific workloads or incidents.
- [x] **Shared Terminal/Logs**: Synchronized log viewing for pair-debugging.

### 2. Internal Annotations
- [x] **Incident Comments**: Add meta-comments to workloads that persist in KubeTriage (not in K8s) for post-mortem context.
- [x] **Handover Tools**: Export an AI-generated incident summary directly to Slack, PagerDuty, or Jira.

---

## 📊 Phase 4: Extreme Observability & Governance
*Goal: Provide a 360-degree view of cluster health, cost, and compliance.*

### 1. Tracing Integration
- [x] **O11y Links**: Deep link from a log line or 5xx spike directly to the corresponding trace in Jaeger/Honeycomb/Grafana Tempo.
- **Topology Intelligence**: Visualize traffic flow between services and highlight bottlenecks using AI.

### 2. Right-Sizing & Financial Ops
- [x] **Cost Optimization**: Analyze requests vs usage (right-sizing) and suggest limits to save money. historical usage (e.g., "This pod is requesting 2Gi but only using 100Mi. Save $X/mo").
- **Karpenter/KEDA Integration**: Enhanced visualization of auto-scaling efficiency.

### 3. Compliance Guardrails
- **Security Triage**: Auto-scan manifests against CIS benchmarks or OPA policies and flag violations (e.g., "Privileged container detected").
- **Compliance Reports**: One-click generation of cluster security and configuration reports.
