import React, { useEffect, useState } from 'react';
import { Bot, Cpu, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useMonitoring } from '../contexts/MonitoringContext';

export const SettingsView: React.FC = () => {
    const { aiConfig, updateAIConfig, notificationSettings, updateNotificationSettings } = useMonitoring();
    const [fetchedModels, setFetchedModels] = useState<string[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

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
                const res = await fetch(`/api/ai/models?provider=${provider}`);
                if (!res.ok) throw new Error('Failed to fetch models');
                const data = await res.json();
                setFetchedModels(data.models || []);

                // If current model is not in the list, default to first one
                if (data.models && data.models.length > 0) {
                    if (!data.models.includes(model) && model !== '') {
                        // Keep existing if possible, otherwise don't force change immediately to avoid annoyance
                        // unless empty.
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
        updateAIConfig({ provider, model });
        // Optional: Show toast
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">Settings</h1>
                <p className="text-zinc-500 dark:text-zinc-400">Manage global configuration and preferences.</p>
            </div>

            <div className="glass rounded-3xl shadow-2xl shadow-indigo-500/10 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div className="p-6 border-b border-zinc-200/50 dark:border-white/5 flex items-center gap-4 relative z-10">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/20 text-white">
                        <Bot className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Artificial Intelligence</h2>
                        <p className="text-xs text-zinc-500 font-medium">Configure the LLM engine used for triage and remediation</p>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Provider Selection */}
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <Cpu className="w-4 h-4" /> AI Provider
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => { setProvider('gemini'); setModel(''); }}
                                className={`relative group p-6 rounded-2xl border-2 transition-all duration-300 text-left ${provider === 'gemini' ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/10 shadow-lg mb-0 scale-[1.02]' : 'border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-zinc-700 hover:bg-white/50 dark:hover:bg-zinc-800/50'}`}
                            >
                                <div className="font-black text-lg text-zinc-900 dark:text-white mb-2 flex items-center gap-2">Google Cloud AI <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] uppercase tracking-wider font-bold">Cloud</span></div>
                                <div className="text-sm text-zinc-500 leading-relaxed">High-performance cloud inference. Requires valid API Key. Best for complex reasoning.</div>
                                {provider === 'gemini' && <div className="absolute top-4 right-4 text-indigo-600 bg-indigo-100 rounded-full p-1"><Check className="w-4 h-4" /></div>}
                            </button>
                            <button
                                onClick={() => { setProvider('ollama'); setModel(''); }}
                                className={`relative group p-6 rounded-2xl border-2 transition-all duration-300 text-left ${provider === 'ollama' ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/10 shadow-lg mb-0 scale-[1.02]' : 'border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-zinc-700 hover:bg-white/50 dark:hover:bg-zinc-800/50'}`}
                            >
                                <div className="font-black text-lg text-zinc-900 dark:text-white mb-2 flex items-center gap-2">Ollama <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] uppercase tracking-wider font-bold">Local</span></div>
                                <div className="text-sm text-zinc-500 leading-relaxed">Private, local inference running on your machine. Best for data privacy and offline use.</div>
                                {provider === 'ollama' && <div className="absolute top-4 right-4 text-indigo-600 bg-indigo-100 rounded-full p-1"><Check className="w-4 h-4" /></div>}
                            </button>
                        </div>
                    </div>

                    {/* Model Selection */}
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            Select Model
                        </label>

                        {isLoadingModels ? (
                            <div className="flex items-center gap-2 text-zinc-500 text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" /> Fetching available models...
                            </div>
                        ) : fetchError ? (
                            <div className="p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> {fetchError}
                            </div>
                        ) : (
                            <div className="relative">
                                <select
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    className="w-full appearance-none bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                >
                                    <option value="" disabled>Select a model...</option>
                                    {fetchedModels.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                    <Cpu className="w-4 h-4" />
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-zinc-400">
                            {provider === 'ollama' ? 'Models must be pulled via `ollama pull <model>` to appear here.' : 'Select a model variant.'}
                        </p>
                    </div>


                    {/* Notification Settings */}
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> Notifications
                        </label>
                        <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Popup Alerts</h3>
                                    <p className="text-xs text-zinc-500 mt-1">Show toast notifications when alert thresholds are breached.</p>
                                </div>
                                <button
                                    onClick={() => updateNotificationSettings({ ...notificationSettings, toastEnabled: !notificationSettings.toastEnabled })}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${notificationSettings.toastEnabled ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${notificationSettings.toastEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {notificationSettings.toastEnabled && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-medium text-zinc-600 dark:text-zinc-400">Wait time between popups</span>
                                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{notificationSettings.toastFrequency}s</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="2"
                                        max="60"
                                        step="1"
                                        value={notificationSettings.toastFrequency}
                                        onChange={(e) => updateNotificationSettings({ ...notificationSettings, toastFrequency: parseInt(e.target.value) })}
                                        className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                        <button
                            onClick={handleSave}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
