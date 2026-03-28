import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Loader2, Cloud } from 'lucide-react';
import { useMonitoring } from '../contexts/MonitoringContext';
import { useEscapeKey } from '../utils/useEscapeKey';

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

    useEscapeKey(isOpen, onClose);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const response = await fetch('/api/clusters/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ kubeconfig }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to register cluster');
            }

            setSuccess(true);
            setKubeconfig('');
            await refreshClusters();

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
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            <div className="relative w-full max-w-lg bg-dark-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-primary-500/5">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-primary-500/10 rounded-lg">
                            <Cloud className="w-4 h-4 text-primary-400" />
                        </div>
                        <h3 className="font-semibold text-white">Register Cluster</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-lg flex items-center gap-2 animate-fade-in">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-lg flex items-center gap-2 animate-fade-in">
                            <Check className="w-4 h-4 shrink-0" />
                            Connection established successfully
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-500 uppercase">
                            Kubeconfig
                        </label>
                        <textarea
                            value={kubeconfig}
                            onChange={(e) => setKubeconfig(e.target.value)}
                            placeholder="Paste your kubeconfig file here..."
                            className="w-full h-40 px-3 py-2 bg-dark-bg border border-white/10 rounded-lg focus:border-primary-500/50 outline-none font-mono text-xs text-zinc-300 placeholder:text-zinc-600 resize-none custom-scrollbar"
                            spellCheck={false}
                            required
                        />
                        <div className="p-2.5 bg-amber-500/5 border border-amber-500/15 rounded-lg">
                            <p className="text-[10px] text-amber-400/80 font-medium mb-1">Local clusters (minikube, kind)</p>
                            <p className="text-[10px] text-zinc-500">Use flattened kubeconfig:</p>
                            <code className="text-[10px] text-zinc-400 font-mono bg-black/40 px-2 py-1 rounded block mt-1">
                                kubectl config view --minify --flatten --context=&lt;name&gt;
                            </code>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !kubeconfig}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:bg-white/5 disabled:text-zinc-600 text-white rounded-lg font-medium text-sm transition-all disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Connecting...
                                </>
                            ) : (
                                'Connect'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
