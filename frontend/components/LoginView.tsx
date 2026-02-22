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
    <div className="min-h-screen w-full flex items-center justify-center bg-black selection:bg-primary-500/30 font-sans relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(14,165,233,0.1),rgba(0,0,0,0)_50%)]"></div>
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary-900/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-900/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4 pointer-events-none"></div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 p-4">
        {/* Card Container */}
        <div className="bg-dark-card/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] p-8 md:p-12 relative overflow-hidden group animate-in fade-in zoom-in duration-700 slide-in-from-bottom-4">

          {/* Top aesthetic border */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent opacity-50"></div>

          <div className="flex flex-col items-center mb-10">
            <div className="mb-6 p-4 bg-white/5 rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)] group-hover:scale-110 transition-transform duration-500">
              <img src={logo} alt="Logo" className="w-10 h-10 object-contain" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-widest uppercase mb-2 font-display text-center drop-shadow-lg">
              Kube<span className="text-primary-500">Triage</span>
            </h1>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] text-center border-b border-white/5 pb-4 w-full">
              KubeTriage Access Terminal
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary-400 transition-colors">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-4 text-white text-sm font-medium placeholder:text-zinc-700 focus:outline-none focus:border-primary-500/50 focus:bg-black/60 focus:ring-1 focus:ring-primary-500/20 transition-all font-mono"
                  placeholder="OPERATOR ID"
                />
              </div>

              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary-400 transition-colors">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-11 pr-4 py-4 text-white text-sm font-medium placeholder:text-zinc-700 focus:outline-none focus:border-primary-500/50 focus:bg-black/60 focus:ring-1 focus:ring-primary-500/20 transition-all font-mono"
                  placeholder="ACCESS KEY"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-lg shadow-primary-900/20 hover:shadow-primary-600/30 disabled:opacity-70 flex justify-center items-center gap-3 active:scale-[0.98] border border-white/10 group/btn mt-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Authenticate <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/5" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
                <span className="bg-transparent px-3 text-zinc-600">Alternative Access Protocols</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => window.location.href = '/api/auth/login'}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <Chrome className="h-4 w-4" />
                <span>GOOGLE CLOUD</span>
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <Github className="h-4 w-4" />
                <span>GITHUB ENT</span>
              </button>
            </div>
          </div>

          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-[10px] font-mono text-emerald-500/70">
              <Terminal className="w-3 h-3" /> SYSTEM ONLINE v2.4.0
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 text-[10px] text-zinc-600 font-mono tracking-widest uppercase opacity-50">
        &copy; 2026 KubeTriage. Secure Terminal.
      </div>
    </div>
  );
};