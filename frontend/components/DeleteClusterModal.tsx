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
                className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            />

            <div className="relative w-full max-w-md bg-dark-card border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(225,29,72,0.15)] overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-rose-500/5">
                    <div className="flex items-center gap-3 text-rose-500">
                        <div className="p-2 bg-rose-500/10 rounded-lg border border-rose-500/20">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <h3 className="font-black text-lg font-display tracking-wide text-white uppercase">Remove Cluster</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                        This will permanently remove the cluster <span className="font-bold text-white bg-white/5 px-1 py-0.5 rounded border border-white/10">"{clusterName}"</span> and all its associated telemetry from Neural Ops. This action cannot be undone.
                    </p>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                            Type <span className="text-rose-500 select-all">{clusterName}</span> to confirm
                        </label>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={clusterName}
                            className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 outline-none font-bold text-white placeholder:text-zinc-700 transition-all font-mono text-sm"
                            autoFocus
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-wider"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!isMatch || isDeleting}
                            className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-white/5 disabled:text-zinc-600 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(225,29,72,0.3)] hover:shadow-[0_0_30px_rgba(225,29,72,0.5)] disabled:shadow-none active:scale-[0.98]"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> TERMINATING...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" /> CONFIRM REMOVAL
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
