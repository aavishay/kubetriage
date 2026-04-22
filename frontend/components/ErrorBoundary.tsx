import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-bg-main flex flex-col items-center justify-center p-6 text-center font-sans animate-fade-in">
                    <div className="bg-bg-card border border-border-main rounded-3xl p-12 shadow-2xl max-w-lg w-full relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />

                        <div className="mb-8 flex justify-center">
                            <div className="p-6 bg-danger-light rounded-3xl animate-pulse">
                                <AlertTriangle className="w-12 h-12 text-danger" />
                            </div>
                        </div>

                        <h1 className="text-3xl font-black text-text-primary uppercase tracking-tighter mb-4">
                            Critical Runtime Event
                        </h1>

                        <p className="text-text-secondary font-medium mb-8">
                            The application encountered an unexpected state and invoked a safety shutdown to prevent data corruption.
                        </p>

                        <div className="bg-bg-hover rounded-2xl p-4 mb-8 text-left overflow-auto max-h-40 border border-border-main">
                            <code className="text-[10px] font-mono text-danger block">
                                {this.state.error?.toString()}
                            </code>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={this.handleReload}
                                className="kt-button kt-button-primary"
                            >
                                <RefreshCw className="w-4 h-4" /> System Reboot
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="kt-button kt-button-secondary"
                            >
                                <Home className="w-4 h-4" /> Return to Base
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 text-xs font-black uppercase tracking-widest text-text-tertiary">
                        KubeTriage Reliability Engine
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
