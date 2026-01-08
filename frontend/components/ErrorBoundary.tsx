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
                <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col items-center justify-center p-6 text-center font-sans">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[3rem] p-12 shadow-2xl max-w-lg w-full relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />

                        <div className="mb-8 flex justify-center">
                            <div className="p-6 bg-rose-500/10 rounded-3xl animate-pulse">
                                <AlertTriangle className="w-12 h-12 text-rose-500" />
                            </div>
                        </div>

                        <h1 className="text-3xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter mb-4">
                            Critical Runtime Event
                        </h1>

                        <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-8">
                            The application encountered an unexpected state and invoked a safety shutdown to prevent data corruption.
                        </p>

                        <div className="bg-zinc-100 dark:bg-zinc-950/50 rounded-2xl p-4 mb-8 text-left overflow-auto max-h-40 border border-zinc-200 dark:border-zinc-800">
                            <code className="text-[10px] font-mono text-rose-600 dark:text-rose-400 block">
                                {this.state.error?.toString()}
                            </code>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={this.handleReload}
                                className="flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl hover:shadow-indigo-600/20"
                            >
                                <RefreshCw className="w-4 h-4" /> System Reboot
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="flex items-center justify-center gap-2 px-8 py-4 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
                            >
                                <Home className="w-4 h-4" /> Return to Base
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                        KubeTriage Reliability Engine
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
