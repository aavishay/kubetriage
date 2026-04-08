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

            <div className="relative w-full max-w-md bg-bg-card border border-border-main rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-main bg-danger-light">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-bg-card rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-danger" />
                        </div>
                        <h3 className="font-semibold text-text-primary">Remove Cluster</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-bg-hover rounded-lg transition-colors text-text-secondary hover:text-text-primary">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <p className="text-sm text-text-secondary">
                        This will permanently remove the cluster{' '}
                        <span className="font-medium text-text-primary bg-bg-hover px-1.5 py-0.5 rounded">"{clusterName}"</span>
                        {' '}and all its associated data. This action cannot be undone.
                    </p>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-text-secondary">
                            Type <span className="text-danger font-mono">{clusterName}</span> to confirm
                        </label>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={clusterName}
                            className="kt-input font-mono text-sm"
                            autoFocus
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!isMatch || isDeleting}
                            className="kt-button bg-danger hover:bg-danger/90 disabled:bg-bg-hover disabled:text-text-tertiary disabled:cursor-not-allowed"
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
