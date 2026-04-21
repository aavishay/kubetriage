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
    const [displayName, setDisplayName] = useState('');
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
                body: JSON.stringify({ kubeconfig, displayName: displayName || undefined }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to register cluster');
            }

            setSuccess(true);
            setKubeconfig('');
            setDisplayName('');
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

            <div className="relative w-full max-w-lg bg-bg-card border border-border-main rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-main bg-primary-500/5">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-primary-500/10 rounded-lg">
                            <Cloud className="w-4 h-4 text-primary-400" />
                        </div>
                        <h3 className="font-semibold text-text-primary">Register Cluster</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-bg-hover rounded-lg transition-colors text-text-secondary hover:text-text-primary">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 bg-danger-light border border-danger/20 text-danger text-sm rounded-lg flex items-center gap-2 animate-fade-in">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="p-3 bg-success-light border border-success/20 text-success text-sm rounded-lg flex items-center gap-2 animate-fade-in">
                            <Check className="w-4 h-4 shrink-0" />
                            Connection established successfully
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-text-secondary uppercase">
                            Display Name (Optional)
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="e.g., QA West Europe Cluster"
                            className="kt-input"
                        />
                        <p className="text-[10px] text-text-tertiary">
                            A friendly name for this cluster. If not provided, the context name from kubeconfig will be used.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-text-secondary uppercase">
                            Kubeconfig
                        </label>
                        <textarea
                            value={kubeconfig}
                            onChange={(e) => setKubeconfig(e.target.value)}
                            placeholder="Paste your kubeconfig file here..."
                            className="kt-input h-40 resize-none custom-scrollbar font-mono text-xs"
                            spellCheck={false}
                            required
                        />
                        <div className="p-2.5 bg-warning-light border border-warning/20 rounded-lg">
                            <p className="text-[10px] text-warning font-medium mb-1">Local clusters (minikube, kind)</p>
                            <p className="text-[10px] text-text-tertiary">Use flattened kubeconfig:</p>
                            <code className="text-[10px] text-text-secondary font-mono bg-bg-hover px-2 py-1 rounded block mt-1">
                                kubectl config view --minify --flatten --context=&lt;name&gt;
                            </code>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !kubeconfig}
                            className="kt-button kt-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
