import React from 'react';
import { Ghost, Home, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const NotFound: React.FC = () => {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-dark-bg text-white p-4">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="relative inline-block">
                    <div className="p-6 bg-dark-card rounded-2xl border border-white/10 shadow-xl">
                        <Ghost className="w-12 h-12 text-primary-500" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h1 className="text-6xl font-bold text-white">404</h1>
                    <h2 className="text-xl font-medium text-zinc-300">Page Not Found</h2>
                    <p className="text-sm text-zinc-500 max-w-sm mx-auto leading-relaxed">
                        The page you are looking for might have been removed or moved to a different location.
                    </p>
                </div>

                <div className="flex items-center justify-center gap-3">
                    <button onClick={() => window.history.back()} className="px-5 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 text-sm font-medium transition-colors flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" /> Go Back
                    </button>
                    <Link to="/" className="px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-colors flex items-center gap-2">
                        <Home className="w-4 h-4" /> Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
};
