import React, { useEffect, useState } from 'react';
import { Bot, Cpu, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useMonitoring } from '../contexts/MonitoringContext';

export const SettingsView: React.FC = () => {
    const { aiConfig, updateAIConfig, notificationSettings, updateNotificationSettings } = useMonitoring();
    const [fetchedModels, setFetchedModels] = useState<string[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [provider, setProvider] = useState(aiConfig?.provider || 'gemini');
    const [model, setModel] = useState(aiConfig?.model || '');

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
                const token = localStorage.getItem('mock_token') || 'mock-token';
                const res = await fetch(`/api/ai/models?provider=${provider}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!res.ok) throw new Error('Failed to fetch models');
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
        <div className="w-full h-full p-8 overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-black text-white tracking-widest font-display uppercase drop-shadow-lg">
                        System Configuration
                    </h1>
                    <p className="text-zinc-400 font-light tracking-wide border-l-2 border-primary-500 pl-4">
                        Manage global parameters for the Neural Operations Center.
                    </p>
                </div>

                <div className="relative overflow-hidden rounded-[2.5rem] p-[1px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-[2.5rem]"></div>
                    <div className="bg-dark-card/80 backdrop-blur-xl rounded-[2.5rem] relative z-10 overflow-hidden shadow-2xl">

                        {/* Header Section */}
                        <div className="p-8 border-b border-white/5 flex items-center gap-6 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-transparent opacity-50"></div>

                            <div className="relative p-4 bg-gradient-to-br from-zinc-800 to-black rounded-2xl border border-white/10 shadow-xl">
                                <Bot className="w-8 h-8 text-primary-400" />
                            </div>
                            <div className="relative">
                                <h2 className="text-xl font-bold text-white tracking-wide">Artificial Intelligence Engine</h2>
                                <p className="text-sm text-zinc-400 mt-1">Configure the Neural LLM backbone for triage analysis.</p>
                            </div>
                        </div>

                        <div className="p-8 space-y-10">
                            {/* Provider Selection */}
                            <div className="space-y-6">
                                <label className="text-xs font-bold text-primary-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Cpu className="w-4 h-4" /> Inference Provider
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <button
                                        onClick={() => { setProvider('gemini'); setModel(''); }}
                                        className={`relative group p-6 rounded-3xl border transition-all duration-300 text-left overflow-hidden ${provider === 'gemini'
                                            ? 'border-primary-500 bg-primary-500/10 shadow-[0_0_30px_rgba(14,165,233,0.15)] scale-[1.02]'
                                            : 'border-white/5 hover:border-white/20 hover:bg-white/5'}`}
                                    >
                                        <div className="relative z-10 flex flex-col h-full">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="font-black text-lg text-white tracking-wide">Google Gemini</div>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold border ${provider === 'gemini' ? 'bg-primary-500 text-white border-primary-400' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>Cloud</span>
                                            </div>
                                            <div className="text-sm text-zinc-400 leading-relaxed flex-1">
                                                High-performance cloud inference. Requires valid API Key. Optimized for complex reasoning.
                                            </div>
                                            {provider === 'gemini' && (
                                                <div className="absolute top-4 right-4 text-primary-400">
                                                    <div className="p-1 rounded-full bg-primary-500/20 border border-primary-500/50"><Check className="w-4 h-4" /></div>
                                                </div>
                                            )}
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => { setProvider('ollama'); setModel(''); }}
                                        className={`relative group p-6 rounded-3xl border transition-all duration-300 text-left overflow-hidden ${provider === 'ollama'
                                            ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.15)] scale-[1.02]'
                                            : 'border-white/5 hover:border-white/20 hover:bg-white/5'}`}
                                    >
                                        <div className="relative z-10 flex flex-col h-full">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="font-black text-lg text-white tracking-wide">Ollama</div>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold border ${provider === 'ollama' ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>Local</span>
                                            </div>
                                            <div className="text-sm text-zinc-400 leading-relaxed flex-1">
                                                Private, local inference running on your machine. Best for air-gapped security.
                                            </div>
                                            {provider === 'ollama' && (
                                                <div className="absolute top-4 right-4 text-emerald-400">
                                                    <div className="p-1 rounded-full bg-emerald-500/20 border border-emerald-500/50"><Check className="w-4 h-4" /></div>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Model Selection */}
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-[0.2em]">
                                    Target Model Variant
                                </label>

                                {isLoadingModels ? (
                                    <div className="flex items-center gap-3 text-zinc-400 text-sm p-4 bg-white/5 rounded-xl border border-white/5 border-dashed">
                                        <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                                        <span>Querying model registry...</span>
                                    </div>
                                ) : fetchError ? (
                                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl flex items-center gap-3">
                                        <AlertCircle className="w-5 h-5 shrink-0" />
                                        <span>{fetchError}</span>
                                    </div>
                                ) : (
                                    <div className="relative group">
                                        <select
                                            value={model}
                                            onChange={(e) => setModel(e.target.value)}
                                            className="w-full appearance-none bg-black/20 border border-white/10 rounded-xl px-5 py-4 text-white font-mono text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-all hover:bg-black/40 cursor-pointer"
                                        >
                                            <option value="" disabled>Select neural model...</option>
                                            {fetchedModels.map(m => (
                                                <option key={m} value={m} className="bg-zinc-900">{m}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 group-hover:text-primary-400 transition-colors">
                                            <Cpu className="w-4 h-4" />
                                        </div>
                                    </div>
                                )}
                                <p className="text-[10px] text-zinc-500 font-mono pl-1">
                                    {provider === 'ollama' ? 'NOTE: Models must be pulled via `ollama pull <model>` to appear here.' : 'Select the optimal model for latency vs accuracy balance.'}
                                </p>
                            </div>

                            {/* Divider */}
                            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

                            {/* Notification Settings */}
                            <div className="space-y-6">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> Alert Protocols
                                </label>
                                <div className="bg-black/20 rounded-2xl p-6 border border-white/5 space-y-6 hover:border-white/10 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-white">Heads-Up Notifications</h3>
                                            <p className="text-xs text-zinc-500 mt-1">Display toast alerts when anomaly thresholds are breached.</p>
                                        </div>
                                        <button
                                            onClick={() => updateNotificationSettings({ ...notificationSettings, toastEnabled: !notificationSettings.toastEnabled })}
                                            className={`w-14 h-7 rounded-full transition-all duration-300 relative border ${notificationSettings.toastEnabled ? 'bg-primary-900/50 border-primary-500' : 'bg-zinc-800 border-zinc-700'}`}
                                        >
                                            <div className={`absolute top-1 left-1 w-4 h-4 rounded-full shadow-md transition-all duration-300 ${notificationSettings.toastEnabled ? 'translate-x-7 bg-primary-400 shadow-[0_0_10px_rgba(56,189,248,0.5)]' : 'translate-x-0 bg-zinc-500'}`} />
                                        </button>
                                    </div>

                                    {notificationSettings.toastEnabled && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 pt-4 border-t border-white/5">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-medium text-zinc-400">Cooldown Period</span>
                                                <span className="font-mono font-bold text-primary-400 bg-primary-900/30 px-2 py-0.5 rounded border border-primary-500/20">{notificationSettings.toastFrequency}s</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="2"
                                                max="60"
                                                step="1"
                                                value={notificationSettings.toastFrequency}
                                                onChange={(e) => updateNotificationSettings({ ...notificationSettings, toastFrequency: parseInt(e.target.value) })}
                                                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary-500 hover:accent-primary-400"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer Action */}
                        <div className="p-6 bg-black/20 border-t border-white/5 flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="relative overflow-hidden bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-[0_4px_20px_rgba(2,132,199,0.3)] hover:shadow-[0_4px_25px_rgba(2,132,199,0.5)] text-sm uppercase tracking-wider active:scale-95 disabled:opacity-70 disabled:active:scale-100 group"
                            >
                                <span className={isSaving ? "opacity-0" : "relative z-10"}>Apply Configuration</span>
                                {isSaving && (
                                    <div className="absolute inset-0 flex items-center justify-center z-20">
                                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
