
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { GEMINI_FAST_MODEL, GEMINI_PRO_MODEL } from "../constants";
import { Workload, DiagnosticPlaybook, OptimizationProfile } from "../types";
import { fetchWithAuth } from "../contexts/AuthContext"; // Assuming we have or create a helper, or just use fetch

// Helper to create a fresh client instance every time to pick up the latest API Key
const createClient = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY || "DEMO_KEY_FOR_BUILD" });
};

export const analyzeWorkloadLogs = async (workload: Workload, playbook: DiagnosticPlaybook = 'General Health'): Promise<string> => {
    let playbookInstructions = "";
    switch (playbook) {
        case 'Network Connectivity':
            playbookInstructions = "Focus strictly on network patterns: DNS resolution failures, connection timeouts, upstream 502/503/504 errors, and ingress controller logs. Ignore minor application logic errors.";
            break;
        case 'Security Audit':
            playbookInstructions = "Focus strictly on security implications: Unauthorized access attempts (401/403), privilege escalation attempts, unusual binary executions, or capabilities violations.";
            break;
        case 'Resource Constraints':
            playbookInstructions = "Focus strictly on resource usage: OOMKilled events, eviction thresholds due to DiskPressure or MemoryPressure, storage capacity limits, CFS throttling, and high I/O wait times.";
            break;
        case 'Data Integrity':
            playbookInstructions = "Focus on database and storage: SQL connection errors, transaction rollbacks, volume mount failures, or data corruption warnings.";
            break;
        case 'Scheduling & Affinity':
            playbookInstructions = "Focus strictly on scheduling constraints. Analyze 'FailedScheduling' events. Look for issues related to Node Affinity, Pod Anti-Affinity rules, Node Taints that aren't tolerated, or insufficient resources on specific topology zones (e.g. AZ mismatch).";
            break;
        default:
            playbookInstructions = "Perform a holistic root cause analysis covering all aspects of reliability including CPU, RAM, and Disk storage.";
    }

    try {
        const response = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Add Authorization header if needed, managed by AuthContext usually
            },
            body: JSON.stringify({
                workloadName: workload.name,
                status: workload.status,
                playbook: playbook,
                instructions: playbookInstructions,
                cpuUsage: `${workload.metrics.cpuUsage}`,
                cpuLimit: `${workload.metrics.cpuLimit}`,
                memoryUsage: `${workload.metrics.memoryUsage}`,
                memoryLimit: `${workload.metrics.memoryLimit}`,
                storageUsage: `${workload.metrics.storageUsage || 0}`,
                storageLimit: `${workload.metrics.storageLimit || 0}`,
                diskIo: `${workload.metrics.diskIo}`,
                logs: workload.recentLogs,
                events: workload.events.map(e => `${e.type}: ${e.reason} - ${e.message}`)
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Backend API Error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.analysis || "No analysis generated.";
    } catch (error) {
        console.error("Gemini API Error (Backend):", error);
        return "Error generating analysis. Please check backend logs.";
    }
};

export const generateRightSizingRecommendation = async (workload: Workload, context: string, profile: OptimizationProfile = 'Balanced'): Promise<string> => {
    const ai = createClient();

    let profileContext = "";
    switch (profile) {
        case 'Cost-Saver':
            profileContext = "STRATEGY: MAXIMIZE COST SAVINGS. Target high utilization (85%+). Aggressively downsize underutilized CPU/RAM/Storage.";
            break;
        case 'Performance':
            profileContext = "STRATEGY: MAXIMIZE PERFORMANCE. Prioritize headroom for spikes. Ensure disk I/O and storage buffers are generous.";
            break;
        default:
            profileContext = "STRATEGY: BALANCED. Target P95 + 20% safety margin.";
    }

    const prompt = `
      Act as a Kubernetes Capacity Planning Expert. 
      Analyze the resource utilization for "${workload.name}" (${workload.kind}).
      
      **Optimization Strategy**: ${profile}
      ${profileContext}
      
      **Current Config**:
      - CPU (Req/Lim): ${workload.metrics.cpuRequest}/${workload.metrics.cpuLimit}c
      - Memory (Req/Lim): ${workload.metrics.memoryRequest}/${workload.metrics.memoryLimit}Mi
      - Storage (Req/Lim): ${workload.metrics.storageRequest || 0}/${workload.metrics.storageLimit || 0}Gi
      
      **Simulation Results**:
      ${context}

      **Output Requirements**:
      Return a highly structured Markdown report.
      Use comparison tables including Storage/Ephemeral disk metrics.
    `;

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_PRO_MODEL,
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 32768 }
            }
        });
        return response.text || "Unable to generate recommendation.";
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "Error generating recommendation.";
    }
};

export const generateHPARecommendation = async (workload: Workload, context?: string): Promise<string> => {
    const ai = createClient();
    const prompt = `
      Act as a Kubernetes Autoscaling Expert.
      Generate a HorizontalPodAutoscaler (HPA) YAML configuration for:
      Workload: ${workload.name} (${workload.kind})
      
      Return ONLY a valid YAML block for a HorizontalPodAutoscaler (autoscaling/v2).
    `;

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_PRO_MODEL,
            contents: prompt,
        });
        return response.text?.trim() || "# Error generating HPA";
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "# Failed to generate HPA";
    }
};

export const generateKubectlPatch = async (workload: Workload, recommendationText: string): Promise<string> => {
    const ai = createClient();
    const prompt = `
       Based on the following recommendation text, generate a single valid 'kubectl patch' command to update resources (CPU, RAM, and Storage limits).
       Workload: ${workload.name}
       Recommendation Text: ${recommendationText}

       Return ONLY the command string.
     `;

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_PRO_MODEL,
            contents: prompt,
        });
        return response.text?.trim() || "echo 'Error generating patch'";
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "echo 'Failed to patch'";
    }
};

export const summarizeWorkloadLogs = async (logs: string[]): Promise<string> => {
    const ai = createClient();
    const prompt = `Summarize these K8s logs into one sentence: ${logs.join('\n')}`;

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_FAST_MODEL,
            contents: prompt,
        });
        return response.text || "No summary available.";
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "Error summarizing logs.";
    }
};

export const generateTopologyDiagram = async (workloads: Workload[], requestedAspectRatio: string): Promise<string | null> => {
    const ai = createClient();

    let safeAspectRatio = requestedAspectRatio;
    switch (requestedAspectRatio) {
        case '2:3': safeAspectRatio = '3:4'; break;
        case '3:2': safeAspectRatio = '4:3'; break;
        case '21:9': safeAspectRatio = '16:9'; break;
        default: safeAspectRatio = requestedAspectRatio;
    }

    const workloadSummary = workloads.map(w =>
        `- ${w.name} (${w.kind}) in namespace '${w.namespace}'. Status: ${w.status}.`
    ).join('\n');

    const prompt = `Generate a modern architecture diagram for: ${workloadSummary}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: [{ text: prompt }] },
            config: {
                imageConfig: {
                    aspectRatio: safeAspectRatio as any,
                    imageSize: '2K'
                }
            }
        });

        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData && part.inlineData.mimeType.startsWith('image')) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        return null;
    } catch (error) {
        console.error("Topology Generation Error:", error);
        throw error;
    }
}

export const createChatSession = (): Chat => {
    const ai = createClient();
    return ai.chats.create({
        model: GEMINI_PRO_MODEL,
        config: {
            systemInstruction: "You are KubeTriage Copilot, an expert Kubernetes SRE assistant. Help triage CPU, Memory, and Disk Storage issues."
        }
    });
};

export const streamChatMessage = async (chat: Chat, message: string, onChunk: (text: string) => void): Promise<void> => {
    try {
        const result = await chat.sendMessageStream({ message });
        for await (const chunk of result) {
            const text = (chunk as GenerateContentResponse).text;
            if (text) onChunk(text);
        }
    } catch (error) {
        console.error("Chat Error:", error);
        onChunk("I encountered an error processing your request.");
    }
};
