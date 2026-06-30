import React from 'react';
import { Ghost, Home, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const NotFound: React.FC = () => {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-bg-main text-text-primary p-4 kt-animate-fade-in">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="relative inline-block">
                    <div className="kt-panel p-6">
                        <Ghost className="w-12 h-12 text-primary-500" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h1 className="font-display font-bold tracking-wider uppercase text-6xl text-text-primary">404</h1>
                    <h2 className="font-display font-bold tracking-wider uppercase text-xl text-text-secondary">Page Not Found</h2>
                    <p className="text-sm text-text-tertiary max-w-sm mx-auto leading-relaxed">
                        The page you are looking for might have been removed or moved to a different location.
                    </p>
                </div>

                <div className="flex items-center justify-center gap-3">
                    <button onClick={() => window.history.back()} className="kt-button kt-button-secondary" aria-label="Go back to previous page">
                        <ArrowLeft className="w-4 h-4" /> Go Back
                    </button>
                    <Link to="/" className="kt-button kt-button-primary" aria-label="Return to dashboard">
                        <Home className="w-4 h-4" /> Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
};
