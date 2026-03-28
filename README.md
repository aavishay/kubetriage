# KubeTriage 🩺

> **AI-Powered Kubernetes Troubleshooting & Observability Platform**

KubeTriage is a next-generation observability dashboard designed to reduce Mean Time To Resolution (MTTR) for Kubernetes incidents. It combines real-time metrics, log analysis, and AI-driven remediation suggestions into a single, premium interface.

## 🚀 Features

### 🧠 Advanced AI Copilot
-   **Automated Root Cause Analysis**: Instantly analyze logs and events to find *why* a pod crashed.
-   **Remediation Suggestions**: Generates executable YAML patches to fix configuration errors (e.g., missing limits, wrong env vars).
-   **One-Click Fix**: Apply AI-suggested patches directly to the cluster with a built-in diff viewer.

### 🌐 Multi-Cluster Management
-   **Unified View**: manage workloads across multiple clusters (EKS, GKE, On-Prem) from a single pane of glass.
-   **Context-Aware**: Seamlessly switch contexts without re-authenticating.

### 📊 Deep Observability
-   **Historical Metrics**: Integrated Prometheus charts for CPU & Memory usage trends.
-   **Live Logs**: Real-time log streaming via Kubernetes WebSockets.
-   **Custom Playbooks**: Define organization-specific diagnostic recipes for standard operating procedures.

### 🛡️ Enterprise Ready
-   **Secure Authentication**: OIDC / RBAC integration.
-   **Audit Logs**: Track every action (especially patch applications).
-   **OpenTelemetry**: Full tracing for backend performance monitoring.

## 🛠️ Architecture

KubeTriage follows a modern cloud-native architecture:

-   **Frontend**: React 19, Vite, TailwindCSS (Premium Dark Mode Design).
-   **Backend**: Go (Gin), client-go (Dynamic Client), Prometheus Client.
-   **Database**: PostgreSQL (User prefs, Chat history, Playbooks).
-   **Infrastructure**: Helm Charts, GitHub Actions CI/CD.

## 🏁 Getting Started

### Prerequisites
-   Go 1.22+
-   Node.js 18+ & npm
-   A running Kubernetes cluster (or Minikube/Docker Desktop)
-   `kubectl` configured locally

### Local Development

1.  **Clone the repository**
    ```bash
    git clone https://github.com/aavishay/kubetriage.git
    cd kubetriage
    ```

2.  **Build the application**
    ```bash
    make build
    ```

3.  **Run the application**
    ```bash
    ./kubetriage
    ```

4.  **Access the Dashboard**
    Open [http://localhost:3001](http://localhost:3001) in your browser.

### Production Deployment

Deploy to your cluster using Helm:

```bash
helm install kubetriage ./charts/kubetriage \
  --set ingress.enabled=true \
  --set ingress.host=triage.internal.corp
```

## 🤝 Contributing

We welcome contributions! Please see `CONTRIBUTING.md` for details on how to set up your dev environment.

## 📄 License

MIT © 2026 KubeTriage Contributors
