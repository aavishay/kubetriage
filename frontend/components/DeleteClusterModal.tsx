import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { useEscapeKey } from '../utils/useEscapeKey';

interface DeleteClusterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    clusterName: string;
}

export const DeleteClusterModal: React.FC<DeleteClusterModalProps> = ({ isOpen, onClose, onConfirm, clusterName }) => {
    const [inputValue, setInputValue] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setInputValue('');
            setIsDeleting(false);
        }
    }, [isOpen]);

    useEscapeKey(isOpen, onClose);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        if (inputValue !== clusterName) return;

        setIsDeleting(true);
        try {
            await onConfirm();
            onClose();
        } catch (error) {
            console.error("Failed to delete cluster:", error);
            setIsDeleting(false);
        }
    };

    const isMatch = inputValue === clusterName;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            <div className="relative w-full max-w-md bg-dark-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-rose-500/5">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-rose-500/10 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                        </div>
                        <h3 className="font-semibold text-white">Remove Cluster</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <p className="text-sm text-zinc-400">
                        This will permanently remove the cluster{' '}
                        <span className="font-medium text-white bg-white/5 px-1.5 py-0.5 rounded">"{clusterName}"</span>
                        {' '}and all its associated data. This action cannot be undone.
                    </p>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-500">
                            Type <span className="text-rose-400 font-mono">{clusterName}</span> to confirm
                        </label>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={clusterName}
                            className="w-full px-3 py-2 bg-dark-bg border border-white/10 rounded-lg focus:border-rose-500/50 outline-none font-mono text-sm text-white placeholder:text-zinc-600 transition-colors"
                            autoFocus
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!isMatch || isDeleting}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-white/5 disabled:text-zinc-600 text-white rounded-lg font-medium text-sm transition-all disabled:cursor-not-allowed"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Removing...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" /> Remove
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
