import React, { useEffect, useState } from 'react';
import { Bot, Cpu, Check, AlertCircle, Loader2, RefreshCw, Clock } from 'lucide-react';
import { useMonitoring } from '../contexts/MonitoringContext';

export const SettingsView: React.FC = () => {
    const { aiConfig, updateAIConfig, notificationSettings, updateNotificationSettings, isDarkMode, refreshInterval, setRefreshInterval } = useMonitoring();
    const [fetchedModels, setFetchedModels] = useState<string[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [provider, setProvider] = useState(aiConfig?.provider || 'ollama');
    const [model, setModel] = useState(aiConfig?.model || 'llama3:latest');

    // Sync local state with context on mount
    useEffect(() => {
        if (aiConfig) {
            setProvider(aiConfig.provider);
            setModel(aiConfig.model);
        }
    }, [aiConfig]);

    // Fetch models when provider changes
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

                // If current model is not in the list, default to first one if possible
                if (data.models && data.models.length > 0) {
                    if (!data.models.includes(model) && model !== '') {
                        // Keep existing if possible
                    }
                }
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

        // Simulate save delay for effect
        setTimeout(() => setIsSaving(false), 800);
    };

    return (
        <div className="w-full h-full p-6 overflow-y-auto custom-scrollbar bg-bg-main animate-fade-in">
            <div className="max-w-3xl mx-auto space-y-6 pb-20">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold text-text-primary tracking-tight">
                        Settings
                    </h1>
                    <p className="text-sm text-text-tertiary">
                        Manage AI provider and notification preferences.
                    </p>
                </div>

                <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-sm shadow-black/5">
                    {/* Header Section */}
                    <div className="p-5 border-b border-border-main flex items-center gap-4 bg-bg-hover/30">
                        <div className="p-2.5 bg-primary-500/10 rounded-xl">
                            <Bot className="w-5 h-5 text-primary-500 dark:text-primary-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-text-primary">AI Provider</h2>
                            <p className="text-xs text-text-tertiary">Configure the LLM backend for analysis.</p>
                        </div>
                    </div>

                    <div className="p-5 space-y-6">
                        {/* Provider Selection */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5 opacity-70">
                                <Cpu className="w-3.5 h-3.5" /> Provider
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                <button
                                    onClick={() => { setProvider('gemini'); setModel(''); }}
                                    className={`relative p-5 rounded-xl border text-left transition-all duration-200 group ${provider === 'gemini'
                                        ? 'border-primary-500 bg-primary-500/5 ring-1 ring-primary-500/50'
                                        : 'border-border-main hover:border-primary-500/30 hover:bg-bg-hover active:scale-[0.98]'}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`font-semibold transition-colors ${provider === 'gemini' ? 'text-primary-500 dark:text-primary-400' : 'text-text-primary'}`}>Google Gemini</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${provider === 'gemini' ? 'bg-primary-500 text-white' : 'bg-bg-hover text-text-tertiary border border-border-main'}`}>Cloud</span>
                                    </div>
                                    <p className="text-xs text-text-tertiary leading-relaxed">
                                        High-performance cloud inference. Requires API key.
                                    </p>
                                    {provider === 'gemini' && (
                                        <div className="absolute top-4 right-4">
                                            <div className="p-1 rounded-full bg-primary-500/20"><Check className="w-3 h-3 text-primary-500 dark:text-primary-400" /></div>
                                        </div>
                                    )}
                                </button>

                                <button
                                    onClick={() => { setProvider('ollama'); setModel(''); }}
                                    className={`relative p-5 rounded-xl border text-left transition-all duration-200 group ${provider === 'ollama'
                                        ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/50'
                                        : 'border-border-main hover:border-emerald-500/30 hover:bg-bg-hover active:scale-[0.98]'}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`font-semibold transition-colors ${provider === 'ollama' ? 'text-emerald-500 dark:text-emerald-400' : 'text-text-primary'}`}>Ollama</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${provider === 'ollama' ? 'bg-emerald-500 text-white' : 'bg-bg-hover text-text-tertiary border border-border-main'}`}>Local</span>
                                    </div>
                                    <p className="text-xs text-text-tertiary leading-relaxed">
                                        Private, local inference. Best for air-gapped environments.
                                    </p>
                                    {provider === 'ollama' && (
                                        <div className="absolute top-4 right-4">
                                            <div className="p-1 rounded-full bg-emerald-500/20"><Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /></div>
                                        </div>
                                    )}
                                </button>

                                <button
                                    onClick={() => { setProvider('azure'); setModel(''); }}
                                    className={`relative p-5 rounded-xl border text-left transition-all duration-200 group ${provider === 'azure'
                                        ? 'border-sky-500 bg-sky-500/5 ring-1 ring-sky-500/50'
                                        : 'border-border-main hover:border-sky-500/30 hover:bg-bg-hover active:scale-[0.98]'}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`font-semibold transition-colors ${provider === 'azure' ? 'text-sky-500 dark:text-sky-400' : 'text-text-primary'}`}>Azure OpenAI</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${provider === 'azure' ? 'bg-sky-500 text-white' : 'bg-bg-hover text-text-tertiary border border-border-main'}`}>Cloud</span>
                                    </div>
                                    <p className="text-xs text-text-tertiary leading-relaxed">
                                        Microsoft Azure OpenAI Service. Requires endpoint and key.
                                    </p>
                                    {provider === 'azure' && (
                                        <div className="absolute top-4 right-4">
                                            <div className="p-1 rounded-full bg-sky-500/20"><Check className="w-3 h-3 text-sky-500 dark:text-sky-400" /></div>
                                        </div>
                                    )}
                                </button>

                                <button
                                    onClick={() => { setProvider('bedrock'); setModel(''); }}
                                    className={`relative p-5 rounded-xl border text-left transition-all duration-200 group ${provider === 'bedrock'
                                        ? 'border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/50'
                                        : 'border-border-main hover:border-amber-500/30 hover:bg-bg-hover active:scale-[0.98]'}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`font-semibold transition-colors ${provider === 'bedrock' ? 'text-amber-500 dark:text-amber-400' : 'text-text-primary'}`}>AWS Bedrock</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${provider === 'bedrock' ? 'bg-amber-500 text-white' : 'bg-bg-hover text-text-tertiary border border-border-main'}`}>Cloud</span>
                                    </div>
                                    <p className="text-xs text-text-tertiary leading-relaxed">
                                        Amazon Bedrock managed foundation models. Requires AWS credentials.
                                    </p>
                                    {provider === 'bedrock' && (
                                        <div className="absolute top-4 right-4">
                                            <div className="p-1 rounded-full bg-amber-500/20"><Check className="w-3 h-3 text-amber-500 dark:text-amber-400" /></div>
                                        </div>
                                    )}
                                </button>

                                <button
                                    onClick={() => { setProvider('vertex'); setModel(''); }}
                                    className={`relative p-5 rounded-xl border text-left transition-all duration-200 group ${provider === 'vertex'
                                        ? 'border-violet-500 bg-violet-500/5 ring-1 ring-violet-500/50'
                                        : 'border-border-main hover:border-violet-500/30 hover:bg-bg-hover active:scale-[0.98]'}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`font-semibold transition-colors ${provider === 'vertex' ? 'text-violet-500 dark:text-violet-400' : 'text-text-primary'}`}>Vertex AI</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${provider === 'vertex' ? 'bg-violet-500 text-white' : 'bg-bg-hover text-text-tertiary border border-border-main'}`}>Cloud</span>
                                    </div>
                                    <p className="text-xs text-text-tertiary leading-relaxed">
                                        Google Cloud Vertex AI platform. Requires project ID and API key.
                                    </p>
                                    {provider === 'vertex' && (
                                        <div className="absolute top-4 right-4">
                                            <div className="p-1 rounded-full bg-violet-500/20"><Check className="w-3 h-3 text-violet-500 dark:text-violet-400" /></div>
                                        </div>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Model Selection */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider opacity-70">
                                ModelSelection
                            </label>

                            {isLoadingModels ? (
                                <div className="flex items-center gap-2 text-text-tertiary text-sm p-4 bg-bg-hover rounded-xl border border-border-main animate-pulse">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                                    <span className="font-medium">Fetching models...</span>
                                </div>
                            ) : fetchError ? (
                                <div className="p-4 bg-rose-500/5 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm rounded-xl flex items-center gap-2 shadow-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span className="font-medium">{fetchError}</span>
                                </div>
                            ) : (
                                <div className="relative group">
                                    <select
                                        value={model}
                                        onChange={(e) => setModel(e.target.value)}
                                        className="kt-input appearance-none cursor-pointer"
                                    >
                                        <option value="" disabled>Select a model...</option>
                                        {fetchedModels.map(m => (
                                            <option key={m} value={m} className={isDarkMode ? 'bg-bg-card' : 'bg-bg-card'}>{m}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary group-hover:text-primary-500 transition-colors">
                                        <Cpu className="w-5 h-5 opacity-50" />
                                    </div>
                                </div>
                            )}
                            <div className="flex items-start gap-1.5 px-1">
                                <div className="mt-1 w-1 h-1 rounded-full bg-primary-500/50" />
                                <p className="text-[11px] text-text-tertiary leading-normal">
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

                        {/* Divider */}
                        <div className="h-px w-full bg-border-main/50"></div>

                        {/* Refresh Interval Settings */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                                <RefreshCw className="w-3.5 h-3.5" /> Auto Refresh
                            </label>
                            <div className="bg-bg-hover/20 rounded-xl p-5 border border-border-main space-y-4 shadow-inner">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold text-text-primary">Resource Refresh Interval</h3>
                                        <p className="text-xs text-text-tertiary mt-1">How often to update workload and resource data.</p>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-medium">
                                        <Clock className="w-3.5 h-3.5 text-primary-500" />
                                        <span className="font-bold text-primary-600 dark:text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-md min-w-[3rem] text-center">{refreshInterval}s</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {[10, 30, 60].map((interval) => (
                                        <button
                                            key={interval}
                                            onClick={() => setRefreshInterval(interval)}
                                            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${refreshInterval === interval
                                                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                                                : 'bg-bg-card border border-border-main text-text-secondary hover:text-text-primary hover:border-primary-500/30'
                                                }`}
                                        >
                                            {interval}s
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-start gap-1.5 px-1 pt-2">
                                    <div className="mt-1 w-1 h-1 rounded-full bg-primary-500/50" />
                                    <p className="text-[11px] text-text-tertiary leading-normal">
                                        Shorter intervals provide more real-time data but increase API load. 30s is recommended for most use cases.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px w-full bg-border-main/50"></div>

                        {/* Notification Settings */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5" /> Notifications
                            </label>
                            <div className="bg-bg-hover/20 rounded-xl p-5 border border-border-main space-y-4 shadow-inner">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold text-text-primary">Toast Notifications</h3>
                                        <p className="text-xs text-text-tertiary mt-1">Display alerts when thresholds are breached.</p>
                                    </div>
                                    <button
                                        onClick={() => updateNotificationSettings({ ...notificationSettings, toastEnabled: !notificationSettings.toastEnabled })}
                                        className={`w-12 h-6.5 rounded-full transition-all relative border border-transparent shadow-sm ${notificationSettings.toastEnabled ? 'bg-primary-600 shadow-primary-500/30' : 'bg-bg-card border-border-main'}`}
                                    >
                                        <div className={`absolute top-1 left-1 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${notificationSettings.toastEnabled ? 'translate-x-[22px]' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {notificationSettings.toastEnabled && (
                                    <div className="space-y-3 pt-4 border-t border-border-main animate-fade-in">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-text-secondary font-medium uppercase tracking-tight opacity-80">Cooldown Frequency</span>
                                            <span className="font-bold text-primary-600 dark:text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-md min-w-[3rem] text-center">{notificationSettings.toastFrequency}s</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="2"
                                            max="60"
                                            step="1"
                                            value={notificationSettings.toastFrequency}
                                            onChange={(e) => updateNotificationSettings({ ...notificationSettings, toastFrequency: parseInt(e.target.value) })}
                                            className="w-full h-1.5 bg-bg-card border border-border-main rounded-lg appearance-none cursor-pointer accent-primary-500 shadow-sm"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer Action */}
                    <div className="p-4 bg-bg-hover/20 border-t border-border-main flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`bg-primary-600 hover:bg-primary-500 disabled:opacity-70 text-white font-bold py-2.5 px-8 rounded-xl transition-all text-sm flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-[0.98] ${isSaving ? 'animate-pulse' : ''}`}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> saving...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" /> Save Configuration
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
