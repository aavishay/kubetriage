import React, { useState } from 'react';
import { X, Check, AlertCircle, Loader2, Cloud } from 'lucide-react';
import { useMonitoring } from '../contexts/MonitoringContext';

interface RegisterClusterModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const RegisterClusterModal: React.FC<RegisterClusterModalProps> = ({ isOpen, onClose }) => {
    const [kubeconfig, setKubeconfig] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const { refreshClusters } = useMonitoring();

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const response = await fetch('/api/clusters/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer mock-token'
                },
                body: JSON.stringify({ kubeconfig }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to register cluster');
            }

            setSuccess(true);
            setKubeconfig('');
            await refreshClusters(); // Reload cluster list

            // Close after short delay
            setTimeout(() => {
                setSuccess(false);
                onClose();
            }, 1500);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            />

            <div className="relative w-full max-w-lg bg-dark-card border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(79,70,229,0.15)] overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-indigo-500/5">
                    <div className="flex items-center gap-3 text-indigo-400">
                        <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                            <Cloud className="w-5 h-5" />
                        </div>
                        <h3 className="font-black text-lg font-display tracking-wide text-white uppercase">Register Cluster</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <Check className="w-5 h-5 shrink-0" />
                            Connection established successfully. Synchronizing telemetry...
                        </div>
                    )}

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex justify-between">
                            <span>Kubeconfig Payload</span>
                            <span className="text-zinc-600">YAML Format</span>
                        </label>
                        <textarea
                            value={kubeconfig}
                            onChange={(e) => setKubeconfig(e.target.value)}
                            placeholder="Paste your kubeconfig file here..."
                            className="w-full h-48 px-4 py-3 bg-black/50 border border-white/10 rounded-xl focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none font-mono text-xs text-zinc-300 placeholder:text-zinc-700 resize-none custom-scrollbar"
                            spellCheck={false}
                            required
                        />
                        <p className="text-[10px] text-zinc-600 font-mono flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-indigo-500"></span> Configuration is stored in transient memory. Ensure API reachability.
                        </p>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-white transition-colors mr-2 uppercase tracking-wider"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !kubeconfig}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 disabled:text-zinc-600 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] disabled:shadow-none active:scale-[0.98]"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> PROVISIONING...
                                </>
                            ) : (
                                'CONNECT CLUSTER'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
