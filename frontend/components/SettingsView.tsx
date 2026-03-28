import React, { useEffect, useState } from 'react';
import { Bot, Cpu, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useMonitoring } from '../contexts/MonitoringContext';

export const SettingsView: React.FC = () => {
    const { aiConfig, updateAIConfig, notificationSettings, updateNotificationSettings } = useMonitoring();
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
        <div className="w-full h-full p-6 overflow-y-auto custom-scrollbar">
            <div className="max-w-3xl mx-auto space-y-6 pb-20">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold text-white">
                        Settings
                    </h1>
                    <p className="text-sm text-zinc-500">
                        Manage AI provider and notification preferences.
                    </p>
                </div>

                <div className="bg-dark-card border border-white/10 rounded-xl overflow-hidden shadow-sm">
                    {/* Header Section */}
                    <div className="p-5 border-b border-white/5 flex items-center gap-4">
                        <div className="p-2.5 bg-primary-500/10 rounded-lg">
                            <Bot className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-medium text-white">AI Provider</h2>
                            <p className="text-xs text-zinc-500">Configure the LLM backend for analysis.</p>
                        </div>
                    </div>

                    <div className="p-5 space-y-6">
                        {/* Provider Selection */}
                        <div className="space-y-3">
                            <label className="text-xs font-medium text-zinc-400 uppercase flex items-center gap-1.5">
                                <Cpu className="w-3.5 h-3.5" /> Provider
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <button
                                    onClick={() => { setProvider('gemini'); setModel(''); }}
                                    className={`relative p-4 rounded-lg border text-left transition-all ${provider === 'gemini'
                                        ? 'border-primary-500 bg-primary-500/10'
                                        : 'border-white/10 hover:border-white/20 hover:bg-white/5'}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-white">Google Gemini</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${provider === 'gemini' ? 'bg-primary-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>Cloud</span>
                                    </div>
                                    <p className="text-xs text-zinc-500 leading-relaxed">
                                        High-performance cloud inference. Requires API key.
                                    </p>
                                    {provider === 'gemini' && (
                                        <div className="absolute top-3 right-3">
                                            <div className="p-1 rounded-full bg-primary-500/20"><Check className="w-3 h-3 text-primary-400" /></div>
                                        </div>
                                    )}
                                </button>

                                <button
                                    onClick={() => { setProvider('ollama'); setModel(''); }}
                                    className={`relative p-4 rounded-lg border text-left transition-all ${provider === 'ollama'
                                        ? 'border-emerald-500 bg-emerald-500/10'
                                        : 'border-white/10 hover:border-white/20 hover:bg-white/5'}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-white">Ollama</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${provider === 'ollama' ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>Local</span>
                                    </div>
                                    <p className="text-xs text-zinc-500 leading-relaxed">
                                        Private, local inference. Best for air-gapped environments.
                                    </p>
                                    {provider === 'ollama' && (
                                        <div className="absolute top-3 right-3">
                                            <div className="p-1 rounded-full bg-emerald-500/20"><Check className="w-3 h-3 text-emerald-400" /></div>
                                        </div>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Model Selection */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-400 uppercase">
                                Model
                            </label>

                            {isLoadingModels ? (
                                <div className="flex items-center gap-2 text-zinc-400 text-sm p-3 bg-white/5 rounded-lg border border-white/5">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                                    <span>Loading models...</span>
                                </div>
                            ) : fetchError ? (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm rounded-lg flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{fetchError}</span>
                                </div>
                            ) : (
                                <div className="relative">
                                    <select
                                        value={model}
                                        onChange={(e) => setModel(e.target.value)}
                                        className="w-full appearance-none bg-dark-bg border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-primary-500/50 transition-colors cursor-pointer"
                                    >
                                        <option value="" disabled>Select model...</option>
                                        {fetchedModels.map(m => (
                                            <option key={m} value={m} className="bg-zinc-900">{m}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                                        <Cpu className="w-4 h-4" />
                                    </div>
                                </div>
                            )}
                            <p className="text-xs text-zinc-600">
                                {provider === 'ollama' ? 'Models must be pulled via `ollama pull <model>` to appear here.' : 'Select the optimal model for your use case.'}
                            </p>
                        </div>

                        {/* Divider */}
                        <div className="h-px w-full bg-white/5"></div>

                        {/* Notification Settings */}
                        <div className="space-y-3">
                            <label className="text-xs font-medium text-zinc-400 uppercase flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5" /> Notifications
                            </label>
                            <div className="bg-dark-bg rounded-lg p-4 border border-white/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-medium text-white">Toast Notifications</h3>
                                        <p className="text-xs text-zinc-500 mt-0.5">Display alerts when thresholds are breached.</p>
                                    </div>
                                    <button
                                        onClick={() => updateNotificationSettings({ ...notificationSettings, toastEnabled: !notificationSettings.toastEnabled })}
                                        className={`w-11 h-6 rounded-full transition-colors relative ${notificationSettings.toastEnabled ? 'bg-primary-600' : 'bg-zinc-700'}`}
                                    >
                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${notificationSettings.toastEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {notificationSettings.toastEnabled && (
                                    <div className="space-y-2 pt-3 border-t border-white/5">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-zinc-400">Cooldown</span>
                                            <span className="font-mono text-primary-400">{notificationSettings.toastFrequency}s</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="2"
                                            max="60"
                                            step="1"
                                            value={notificationSettings.toastFrequency}
                                            onChange={(e) => updateNotificationSettings({ ...notificationSettings, toastFrequency: parseInt(e.target.value) })}
                                            className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer Action */}
                    <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-primary-600 hover:bg-primary-500 disabled:opacity-70 text-white font-medium py-2 px-6 rounded-lg transition-colors text-sm flex items-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
