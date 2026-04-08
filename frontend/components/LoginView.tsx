import React, { useState } from 'react';
import { Box, Loader2, Github, Chrome, ArrowRight, Lock, Mail, Terminal } from 'lucide-react';
import logo from '../src/assets/kubetriage_logo.svg';

interface LoginViewProps {
  onLogin: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('admin@kubetriage.io');
  const [password, setPassword] = useState('password');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate network authentication request
    setTimeout(() => {
      setIsLoading(false);
      onLogin();
    }, 1000);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg-main selection:bg-primary-500/30 font-sans">
      <div className="w-full max-w-md p-6">
        <div className="bg-bg-card border border-border-main rounded-2xl shadow-xl p-8 relative">
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4 p-3 bg-bg-hover rounded-xl border border-border-main">
              <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
            </div>
            <h1 className="text-2xl font-semibold text-text-primary mb-1 text-center">
              Kube<span className="text-primary-500">Triage</span>
            </h1>
            <p className="text-sm text-text-secondary text-center">
              Sign in to your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="kt-input pl-10 pr-4"
                  placeholder="Email address"
                />
              </div>

              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="kt-input pl-10 pr-4"
                  placeholder="Password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-70 text-white font-medium py-3 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card flex justify-center items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border-main" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-bg-card px-3 text-text-tertiary">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => window.location.href = '/api/auth/login'}
                className="flex items-center justify-center gap-2 rounded-xl border border-border-main bg-bg-hover hover:bg-bg-hover/70 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary transition-all duration-200 font-medium"
              >
                <Chrome className="h-4 w-4" />
                <span>Google</span>
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-xl border border-border-main bg-bg-hover hover:bg-bg-hover/70 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary transition-all duration-200 font-medium"
              >
                <Github className="h-4 w-4" />
                <span>GitHub</span>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-light border border-success/20 text-xs text-success">
              <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
              System Online v2.4.0
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};