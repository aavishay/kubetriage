import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2, Trash2 } from 'lucide-react';

interface DeleteClusterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    clusterName: string;
}

export const DeleteClusterModal: React.FC<DeleteClusterModalProps> = ({ isOpen, onClose, onConfirm, clusterName }) => {
    const [inputValue, setInputValue] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setInputValue('');
            setIsDeleting(false);
        }
    }, [isOpen]);

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
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in"
                onClick={onClose}
            />

            <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-rose-50/50 dark:bg-rose-900/10">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-500">
                        <AlertTriangle className="w-5 h-5" />
                        <h3 className="font-bold text-lg">Remove Cluster?</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        This will permanently remove the cluster <span className="font-bold text-zinc-900 dark:text-white">"{clusterName}"</span> and all its associated data from KubeTriage. This action cannot be undone.
                    </p>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                            Type <span className="text-rose-500 select-all">{clusterName}</span> to confirm
                        </label>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={clusterName}
                            className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none font-bold text-zinc-900 dark:text-white"
                            autoFocus
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!isMatch || isDeleting}
                            className="flex items-center gap-2 px-6 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-rose-600/20 disabled:shadow-none"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Removing...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" /> Remove Cluster
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
