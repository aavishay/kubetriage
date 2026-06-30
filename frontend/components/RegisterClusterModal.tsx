import React, { useState } from 'react';
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="register-modal-title">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm kt-animate-fade-in"
                onClick={onClose}
            />

            <div className="relative w-full max-w-lg kt-panel kt-animate-slide-up">
                <div className="kt-panel-header">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-primary-600 rounded-lg">
                            <Cloud className="w-4 h-4 text-white" />
                        </div>
                        <h3 id="register-modal-title" className="font-sans font-bold text-text-primary">Register cluster</h3>
                    </div>
                    <button onClick={onClose} className="kt-button kt-button-ghost kt-button-sm">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {error && (
                        <div role="alert" className="kt-panel-inset p-3 text-danger text-sm flex items-center gap-2 kt-animate-fade-in">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {success && (
                        <div role="alert" className="kt-panel-inset p-3 text-success text-sm flex items-center gap-2 kt-animate-fade-in">
                            <Check className="w-4 h-4 shrink-0" />
                            Connection established successfully
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="kt-text-label">
                            Display name (optional)
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="e.g., QA West Europe Cluster"
                            className="kt-input"
                        />
                        <p className="text-[10px] text-text-tertiary font-sans">
                            A friendly name for this cluster. If not provided, the context name from kubeconfig will be used.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="kt-text-label">
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
                        <div className="kt-panel-inset p-2.5 border-l-2 border-l-warning">
                            <p className="text-[10px] text-warning font-bold mb-1 font-sans">Local clusters (minikube, kind)</p>
                            <p className="text-[10px] text-text-tertiary font-sans">Use flattened kubeconfig:</p>
                            <code className="font-mono text-[10px] text-text-secondary bg-bg-hover px-2 py-1 rounded block mt-1">
                                kubectl config view --minify --flatten --context=&lt;name&gt;
                            </code>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="kt-button kt-button-ghost"
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
