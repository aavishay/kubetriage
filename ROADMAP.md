# KubeTriage Roadmap

## 🩺 Vision
KubeTriage is an **Autonomous SRE Guard** — proactive in detecting, triaging, and suggesting fixes for Kubernetes cluster health issues. Distributed as a single CLI binary installable via `brew`, it starts a local web UI with one command.

---

## ✅ Phase 1: AI-Enhanced Diagnostics
*Status: Complete*

### 1. High-Fidelity AI Context
- [x] **Multi-Source Context**: Pass logs, Events, Metrics (Prometheus), and full YAML manifests to AI
- [x] **Interactive Triage**: Ask follow-up questions about specific diagnoses
- [x] **Agentic Debugging**: AI tool-calling to fetch logs from sidecars or related services

### 2. Live Log Streaming
- [x] **WebSocket Streaming**: Real-time sub-second log streaming
- [x] **Global Search**: Search across all pods in a namespace or deployment

---

## ✅ Phase 2: Proactive Triage
*Status: Complete*

### 1. Incident Stream
- [x] **Cluster Watcher**: Background monitoring for CrashLoopBackOff, ImagePullBackOff, OOMKilled
- [x] **Incident Cards**: Auto-created "Triage Cards" with Kanban-style board
- [x] **Auto-Triage**: AI analyzes issues and populates cards with summary + fix before SRE arrives

### 2. Automation Engine
- [x] **Recipe Engine**: Define triggers (e.g., "5xx error rate > 5%") and actions (e.g., Blue/Green rollback)
- [x] **Approval Workflow**: Human one-click approval via dashboard or Slack

---

## ✅ Phase 3: Collaborative Triage
*Status: Complete*

### 1. Real-Time Presence
- [x] **Presence Indicators**: See teammates viewing specific workloads or incidents
- [x] **Shared Terminal/Logs**: Synchronized log viewing for pair-debugging

### 2. Internal Annotations
- [x] **Incident Comments**: Persistent comments (stored in KubeTriage, not K8s)
- [x] **Handover Tools**: Export AI-generated summaries to Slack, PagerDuty, Jira

---

## ✅ Phase 4: Extreme Observability & Governance
*Status: Complete*

### 1. Tracing Integration
- [x] **O11y Links**: Deep link from logs/traces to Jaeger, Honeycomb, Grafana Tempo
- [x] **Topology Intelligence**: Visualize traffic flow, highlight bottlenecks

### 2. Right-Sizing & FinOps
- [x] **Cost Optimization**: Analyze requests vs. usage, suggest limits
- [x] **Karpenter/KEDA Integration**: Enhanced auto-scaling efficiency visualization with node pool utilization, bin-packing efficiency, cost per CPU/memory, and KEDA trigger performance metrics

### 3. Compliance Guardrails
- [x] **Security Triage**: Auto-scan against CIS benchmarks and OPA policies
- [x] **Compliance Reports**: One-click cluster security/configuration reports

---

## 🚀 Phase 5: Autonomous Operations (v2.0)
*Goal: Shift from "SRE Assistant" to "SRE Autopilot" with autonomous remediation capabilities.*

### 1. Autonomous Remediation
- [x] **AI-Generated Patch Suggestions**: AI analyzes errors and suggests Kubernetes patches (merge/JSON patch)
- [x] **One-Click Remediation Apply**: Apply AI-suggested patches directly to cluster resources
- [x] **Auto-Fix with Rollback Safety**: AI applies low-risk fixes with automatic rollback on failure (requires human approval)
- [x] **Runbook Automation**: Convert AI-generated runbooks into executable automation recipes (requires human approval at each step)
- [x] **Scheduled Remediation**: Time-based fixes (e.g., "Restart every 24h at 3am") (requires human approval before execution)

### 2. Multi-Cluster Federation
- [x] **Unified Dashboard**: Single pane of glass across multiple clusters with global workload and incident views
- [x] **Cross-Cluster Correlation**: Detect cascading and correlated incidents across clusters

### 3. ML-Driven Intelligence
- [x] **Anomaly Detection**: Real-time Z-score based anomaly detection with confidence scores for CPU, memory, and network metrics
- [x] **Root Cause Prediction**: ML-based root cause analysis with suggested actions for OOMKilled, CrashLoopBackOff, and ImagePullBackOff incidents
- [x] **Pattern Recognition**: Automated pattern discovery from historical incidents with suggested permanent fixes and recurrence tracking

### 4. Developer Experience
- [x] **Self-Service Portal**: Developers can view/resolve their own incidents (with guardrails)
- [x] **Pre-Deploy Checks**: CI/CD integration to catch issues before production
- [x] **Cost Visibility**: Per-team/per-namespace cost attribution

### 5. Ecosystem Integration
- [x] **Custom Metrics API**: Ingest external metrics (Datadog, New Relic, CloudWatch)

### 6. Distribution
- [x] **Homebrew Installation**: `brew install kubetriage` for macOS/Linux
- [x] **CLI with Browser Auto-Open**: `kubetriage serve` starts web UI and opens browser
- [x] **Shell Completions**: bash, zsh, fish auto-completion
- [x] **Cross-Platform Releases**: darwin/amd64, darwin/arm64, linux/amd64, linux/arm64

---

## ⚠️ Known Limitations

| Limitation | Description | Workaround |
|------------|-------------|------------|
| Local cluster routing | Loopback addresses must be rewritten for local clusters | Use `host.docker.internal` or remote clusters |
| OOMKill detection | Requires access to `/proc/<pid>/status` on node | Run node agent or use privileged mode |
| Large clusters | WebSocket connections scale with pod count | Use namespace filtering |
| OPA/CIS scanning | Requires OPA Gatekeeper or Kyverno to be installed | Install via Helm chart |

---

## 📋 Future Considerations

These are exploratory ideas not yet scheduled for implementation:

- **GitOps Integration**: Native ArgoCD/Flux reconciliation views
- **Capacity Planning**: Predictive pod scheduling based on trends
- **Custom AI Providers**: Support for Azure AI, AWS Bedrock, Vertex AI, Claude
- **Offline Mode**: Local-first operation with sync when online
