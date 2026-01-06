import React from 'react';
import { Ghost, Home, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const NotFound: React.FC = () => {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-white p-4">
            <div className="max-w-lg w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="relative inline-block group">
                    <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl group-hover:bg-indigo-500/30 transition-all duration-500"></div>
                    <div className="relative p-8 bg-white dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-2xl">
                        <Ghost className="w-16 h-16 text-indigo-500 animate-bounce" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-500">
                        404
                    </h1>
                    <h2 className="text-2xl font-bold uppercase tracking-wide">Signal Lost</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                        The telemetry for this route has gone dark. The page you are looking for might have been decommissioned or moved to a different cluster.
                    </p>
                </div>

                <div className="flex items-center justify-center gap-4">
                    <button onClick={() => window.history.back()} className="px-6 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold text-sm transition-all flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> Go Back
                    </button>
                    <Link to="/" className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-500/20 transition-all flex items-center gap-2">
                        <Home className="w-4 h-4" /> Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
};
