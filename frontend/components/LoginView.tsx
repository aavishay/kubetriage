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
    <div className="min-h-screen w-full flex items-center justify-center bg-dark-bg selection:bg-primary-500/30 font-sans">
      <div className="w-full max-w-md p-6">
        <div className="bg-dark-card border border-white/10 rounded-2xl shadow-xl p-8 relative">
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
              <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
            </div>
            <h1 className="text-2xl font-semibold text-white mb-1 text-center">
              Kube<span className="text-primary-500">Triage</span>
            </h1>
            <p className="text-sm text-zinc-500 text-center">
              Sign in to your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-dark-bg border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-primary-500/50 transition-colors"
                  placeholder="Email address"
                />
              </div>

              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-dark-bg border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-primary-500/50 transition-colors"
                  placeholder="Password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-70 text-white font-medium py-3 rounded-lg transition-colors flex justify-center items-center gap-2"
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
                <span className="w-full border-t border-white/5" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-dark-card px-3 text-zinc-500">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => window.location.href = '/api/auth/login'}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Chrome className="h-4 w-4" />
                <span>Google</span>
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Github className="h-4 w-4" />
                <span>GitHub</span>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              System Online v2.4.0
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};