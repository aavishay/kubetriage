import React, { useEffect, useState } from 'react';
import { Bot, Cpu, Check, AlertCircle, Loader2, RefreshCw, Clock, Wifi, WifiOff, Database, Trash2, ArrowUpCircle } from 'lucide-react';
import { useMonitoring } from '../contexts/MonitoringContext';
import { clearCache, getCacheStats } from '../services/offlineService';

export const SettingsView: React.FC = () => {
    const { aiConfig, updateAIConfig, notificationSettings, updateNotificationSettings, isDarkMode, refreshInterval, setRefreshInterval } = useMonitoring();
    const [fetchedModels, setFetchedModels] = useState<string[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [offlineStats, setOfflineStats] = useState({ entries: 0, queueSize: 0 });
    const [isClearing, setIsClearing] = useState(false);

    const [provider, setProvider] = useState(aiConfig?.provider || 'ollama');
    const [model, setModel] = useState(aiConfig?.model || 'llama3:latest');

    useEffect(() => {
        if (aiConfig) {
            setProvider(aiConfig.provider);
            setModel(aiConfig.model);
        }
    }, [aiConfig]);

    useEffect(() => {
        const loadStats = async () => {
            const stats = await getCacheStats();
            setOfflineStats(stats);
        };
        loadStats();
        const interval = setInterval(loadStats, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchModels = async () => {
            setIsLoadingModels(true);
            setFetchError(null);
            try {
                const res = await fetch(`/api/ai/models?provider=${provider}`);
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.error || `Failed to fetch models (${res.status})`);
                }
                const data = await res.json();
                setFetchedModels(data.models || []);
            } catch (e: any) {
                console.error(e);
                setFetchError(e.message);
                setFetchedModels([]);
            } finally {
                setIsLoadingModels(false);
            }
        };
        fetchModels();
    }, [provider]);

    const handleSave = () => {
        setIsSaving(true);
        updateAIConfig({ provider, model });
        setTimeout(() => setIsSaving(false), 800);
    };

    const handleClearCache = async () => {
        setIsClearing(true);
        await clearCache();
        const stats = await getCacheStats();
        setOfflineStats(stats);
        setIsClearing(false);
    };

    const providers = [
      { key: 'gemini', label: 'Google Gemini', tag: 'Cloud', color: 'primary' },
      { key: 'ollama', label: 'Ollama', tag: 'Local', color: 'success' },
      { key: 'azure', label: 'Azure OpenAI', tag: 'Cloud', color: 'info' },
      { key: 'bedrock', label: 'AWS Bedrock', tag: 'Cloud', color: 'warning' },
      { key: 'vertex', label: 'Vertex AI', tag: 'Cloud', color: 'purple' },
    ] as const;

    const colorMap: Record<string, { border: string; bg: string; text: string; tagBg: string }> = {
      primary: { border: 'border-primary-500', bg: 'bg-primary-500/5', text: 'text-primary-500', tagBg: 'bg-primary-500' },
      success: { border: 'border-success', bg: 'bg-success/5', text: 'text-success', tagBg: 'bg-success' },
      info: { border: 'border-info', bg: 'bg-info/5', text: 'text-info', tagBg: 'bg-info' },
      warning: { border: 'border-warning', bg: 'bg-warning/5', text: 'text-warning', tagBg: 'bg-warning' },
      purple: { border: 'border-violet-500', bg: 'bg-violet-500/5', text: 'text-violet-500', tagBg: 'bg-violet-500' },
    };

    return (
        <div className="w-full h-full p-5 overflow-y-auto custom-scrollbar bg-bg-main animate-fade-in">
            <div className="max-w-3xl mx-auto space-y-5 pb-20">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-display font-bold text-text-primary">Settings</h1>
                    <p className="text-sm text-text-tertiary font-sans">Manage AI provider and notification preferences.</p>
                </div>

                <div className="kt-panel overflow-hidden">
                    <div className="kt-panel-header">
                        <div className="flex items-center gap-2">
                            <Bot className="w-4 h-4 text-primary-500" /> AI Provider
                        </div>
                    </div>

                    <div className="p-5 space-y-6 relative z-10">
                        <div className="space-y-3">
                            <label className="text-[10px] text-text-tertiary flex items-center gap-1.5 font-sans font-medium uppercase">
                                <Cpu className="w-3.5 h-3.5" /> Provider
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {providers.map(p => {
                                    const active = provider === p.key;
                                    const c = colorMap[p.color];
                                    return (
                                        <button
                                            key={p.key}
                                            onClick={() => { setProvider(p.key); setModel(''); }}
                                            className={`relative p-4 border text-left transition-all duration-200 group ${active ? `${c.border} ${c.bg} kt-amber-glow` : 'border-border-main hover:border-primary-500/30 hover:bg-bg-hover'}`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`font-sans font-semibold transition-colors ${active ? c.text : 'text-text-primary'}`}>{p.label}</span>
                                                <span className={`px-1.5 py-0.5 text-[10px] font-sans font-semibold ${active ? `${c.tagBg} text-black` : 'bg-bg-hover text-text-tertiary border border-border-main'}`}>{p.tag}</span>
                                            </div>
                                            <p className="text-xs text-text-tertiary leading-relaxed font-sans">
                                                {p.key === 'gemini' && 'High-performance cloud inference. Requires API key.'}
                                                {p.key === 'ollama' && 'Private, local inference. Best for air-gapped environments.'}
                                                {p.key === 'azure' && 'Microsoft Azure OpenAI Service. Requires endpoint and key.'}
                                                {p.key === 'bedrock' && 'Amazon Bedrock managed foundation models. Requires AWS credentials.'}
                                                {p.key === 'vertex' && 'Google Cloud Vertex AI platform. Requires project ID and API key.'}
                                            </p>
                                            {active && (
                                                <div className="absolute top-3 right-3">
                                                    <div className="p-1 bg-primary-500/20"><Check className="w-3 h-3 text-primary-500" /></div>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] text-text-tertiary font-sans font-medium uppercase">
                                Model Selection
                            </label>
                            {isLoadingModels ? (
                                <div className="flex items-center gap-2 text-text-tertiary text-sm p-4 kt-panel-inset animate-pulse">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                                    <span className="font-sans">Fetching models...</span>
                                </div>
                            ) : fetchError ? (
                                <div className="p-4 bg-danger/5 border border-danger/20 text-danger text-sm flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span className="font-sans">{fetchError}</span>
                                </div>
                            ) : (
                                <div className="relative group">
                                    <select value={model} onChange={(e) => setModel(e.target.value)} className="kt-input appearance-none cursor-pointer">
                                        <option value="" disabled>Select a model...</option>
                                        {fetchedModels.map(m => (
                                            <option key={m} value={m} className={isDarkMode ? 'bg-bg-card' : 'bg-bg-card'}>{m}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary group-hover:text-primary-500 transition-colors">
                                        <Cpu className="w-5 h-5 opacity-50" />
                                    </div>
                                </div>
                            )}
                            <div className="flex items-start gap-1.5 px-1">
                                <div className="mt-1 w-1 h-1 rounded-full bg-primary-500/50" />
                                <p className="text-[11px] text-text-tertiary leading-normal font-sans">
                                    {provider === 'ollama'
                                        ? 'Models must be pulled via `ollama pull <model>` to appear here.'
                                        : provider === 'azure'
                                            ? 'Select your Azure OpenAI deployment model.'
                                            : provider === 'bedrock'
                                                ? 'Select the Bedrock foundation model for inference.'
                                                : provider === 'vertex'
                                                    ? 'Select the Vertex AI Gemini model for inference.'
                                                    : 'Select the optimal model for your use case.'}
                                </p>
                            </div>
                        </div>

                        <div className="h-px w-full bg-border-main/50" />

                        <div className="space-y-3">
                            <label className="text-[10px] text-text-tertiary flex items-center gap-1.5 font-sans font-medium uppercase">
                                <RefreshCw className="w-3.5 h-3.5" /> Auto Refresh
                            </label>
                            <div className="kt-panel-inset p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-sans font-semibold text-text-primary">Resource Refresh Interval</h3>
                                        <p className="text-xs text-text-tertiary mt-1 font-sans">How often to update workload and resource data.</p>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-medium">
                                        <Clock className="w-3.5 h-3.5 text-primary-500" />
                                        <span className="font-mono font-bold text-primary-500 bg-primary-500/10 border border-primary-500/20 px-2 py-0.5 rounded-sm min-w-[3rem] text-center">{refreshInterval}s</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {[10, 30, 60].map((interval) => (
                                        <button key={interval} onClick={() => setRefreshInterval(interval)} className={`px-4 py-2 text-xs font-sans font-semibold border transition-all ${refreshInterval === interval ? 'bg-primary-500 text-black border-primary-500 kt-amber-glow' : 'bg-bg-card border-border-main text-text-secondary hover:text-text-primary hover:border-primary-500/30'}`}>
                                            {interval}s
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-start gap-1.5 px-1 pt-2">
                                    <div className="mt-1 w-1 h-1 rounded-full bg-primary-500/50" />
                                    <p className="text-[11px] text-text-tertiary leading-normal font-sans">
                                        Shorter intervals provide more real-time data but increase API load. 30s is recommended for most use cases.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="h-px w-full bg-border-main/50" />

                        <div className="space-y-3">
                            <label className="text-[10px] text-text-tertiary flex items-center gap-1.5 font-sans font-medium uppercase">
                                <AlertCircle className="w-3.5 h-3.5" /> Notifications
                            </label>
                            <div className="kt-panel-inset p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-sans font-semibold text-text-primary">Toast Notifications</h3>
                                        <p className="text-xs text-text-tertiary mt-1 font-sans">Display alerts when thresholds are breached.</p>
                                    </div>
                                    <button
                                        onClick={() => updateNotificationSettings({ ...notificationSettings, toastEnabled: !notificationSettings.toastEnabled })}
                                        className={`w-12 h-6 rounded-sm transition-all relative border border-transparent ${notificationSettings.toastEnabled ? 'bg-primary-500 kt-amber-glow' : 'bg-bg-card border-border-main'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-black shadow-sm transition-transform duration-200 ${notificationSettings.toastEnabled ? 'translate-x-[22px]' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {notificationSettings.toastEnabled && (
                                    <div className="space-y-3 pt-4 border-t border-border-main animate-fade-in">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-text-secondary font-sans font-semibold opacity-80">Cooldown Frequency</span>
                                            <span className="font-mono font-bold text-primary-500 bg-primary-500/10 border border-primary-500/20 px-2 py-0.5 rounded-sm min-w-[3rem] text-center">{notificationSettings.toastFrequency}s</span>
                                        </div>
                                        <input type="range" min="2" max="60" step="1" value={notificationSettings.toastFrequency} onChange={(e) => updateNotificationSettings({ ...notificationSettings, toastFrequency: parseInt(e.target.value) })} className="w-full h-1.5 bg-bg-card border border-border-main rounded-sm appearance-none cursor-pointer accent-primary-500" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="h-px w-full bg-border-main/50" />

                        <div className="space-y-3">
                            <label className="text-[10px] text-text-tertiary flex items-center gap-1.5 font-sans font-medium uppercase">
                                <Wifi className="w-3.5 h-3.5" /> Offline Mode
                            </label>
                            <div className="kt-panel-inset p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 border ${navigator.onLine ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'}`}>
                                            {navigator.onLine ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-sans font-semibold text-text-primary">Offline Support</h3>
                                            <p className="text-xs text-text-tertiary mt-1 font-sans">
                                                {navigator.onLine
                                                    ? 'Connected. GET responses are cached locally; mutations queue when offline.'
                                                    : 'Offline. Data is served from cache and actions are queued for sync.'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`kt-badge ${navigator.onLine ? 'kt-badge-success' : 'kt-badge-danger'}`}>
                                        {navigator.onLine ? 'Online' : 'Offline'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="kt-panel p-3">
                                        <div className="flex items-center gap-2 mb-1 relative z-10">
                                            <Database className="w-3.5 h-3.5 text-primary-500" />
                                            <span className="text-[10px] text-text-tertiary font-sans font-medium uppercase">Cached Entries</span>
                                        </div>
                                        <p className="text-lg font-mono font-bold text-text-primary relative z-10">{offlineStats.entries}</p>
                                    </div>
                                    <div className="kt-panel p-3">
                                        <div className="flex items-center gap-2 mb-1 relative z-10">
                                            <ArrowUpCircle className="w-3.5 h-3.5 text-warning" />
                                            <span className="text-[10px] text-text-tertiary font-sans font-medium uppercase">Queued Actions</span>
                                        </div>
                                        <p className="text-lg font-mono font-bold text-text-primary relative z-10">{offlineStats.queueSize}</p>
                                    </div>
                                </div>

                                <button onClick={handleClearCache} disabled={isClearing || offlineStats.entries === 0} className="kt-button kt-button-danger kt-button-sm">
                                    <Trash2 className="w-3.5 h-3.5" />
                                    {isClearing ? 'Clearing...' : 'Clear Cache'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-bg-hover/20 border-t border-border-main flex justify-end relative z-10">
                        <button onClick={handleSave} disabled={isSaving} className={`kt-button kt-button-primary ${isSaving ? 'animate-pulse' : ''}`}>
                            {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> saving...</> : <><Check className="w-4 h-4" /> Save Configuration</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
