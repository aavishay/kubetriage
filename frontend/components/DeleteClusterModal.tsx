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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm kt-animate-fade-in"
                onClick={onClose}
            />

            <div className="relative w-full max-w-md kt-panel kt-animate-slide-up">
                <div className="kt-panel-header bg-danger-light">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-bg-card rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-danger" />
                        </div>
                        <h3 id="delete-modal-title" className="font-sans font-bold text-text-primary">Remove cluster</h3>
                    </div>
                    <button onClick={onClose} className="kt-button kt-button-ghost kt-button-sm">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <p className="text-sm text-text-secondary">
                        This will permanently remove the cluster{' '}
                        <span className="font-bold text-text-primary bg-bg-hover px-1.5 py-0.5 rounded font-sans">"{clusterName}"</span>
                        {' '}and all its associated data. This action cannot be undone.
                    </p>

                    <div className="space-y-2">
                        <label id="confirm-instructions" className="kt-text-label">
                            Type <span className="text-danger font-sans">{clusterName}</span> to confirm
                        </label>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={clusterName}
                            className="kt-input text-sm font-sans"
                            autoFocus
                            aria-describedby="confirm-instructions"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={onClose}
                            className="kt-button kt-button-ghost"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!isMatch || isDeleting}
                            className="kt-button kt-button-danger disabled:opacity-50 disabled:cursor-not-allowed"
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
