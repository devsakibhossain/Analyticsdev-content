'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Lock, Mail, AlertCircle, ArrowRight, Loader2, Sun, Moon } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useTheme } from '@/components/theme/ThemeProvider';

export default function LoginPage() {
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await fetchApi<{ access_token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (data && data.access_token) {
        localStorage.setItem('leadfinder_token', data.access_token);
        router.push('/dashboard');
      } else {
        setError('Login failed: invalid response from server');
      }
    } catch (err: any) {
      setError(err.message || 'Incorrect email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-dark-950 relative overflow-hidden transition-colors duration-200">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-2xl glass-card text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm flex items-center justify-center group"
          title={resolvedTheme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          aria-label="Toggle Theme"
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-4 h-4 text-blue-500 group-hover:-rotate-12 transition-transform" />
          )}
        </button>
      </div>

      {/* Aurora Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-blue-600/20 via-indigo-600/15 to-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-glow-pulse" />

      <div className="w-full max-w-md glass-card rounded-3xl p-7 sm:p-9 shadow-2xl relative z-10 border border-white/10 animate-slide-up">
        {/* Header */}
        <div className="text-center space-y-2.5 mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/30 mb-3 border border-blue-500/30 p-[2px] bg-dark-950">
            <img src="/logo-icon.png" alt="CRM Ultra Logo" className="w-full h-full object-cover rounded-[22px]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100">
            CRM <span className="text-gradient-brand">Ultra</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Enterprise Client Prospecting, Outreach & CRM Hub
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs sm:text-sm flex items-start space-x-2.5 animate-slide-up">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Email Address
            </label>
            <div className="relative group">
              <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="demo@crmultra.io"
                className="w-full pl-10 pr-4 py-2.5 bg-dark-950/80 border border-white/10 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-sm text-slate-100 placeholder-slate-500 outline-none transition-all shadow-inner"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative group">
              <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-dark-950/80 border border-white/10 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-sm text-slate-100 placeholder-slate-500 outline-none transition-all shadow-inner"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:via-indigo-500 hover:to-cyan-400 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Access Console</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-white/5 text-center">
          <p className="text-[11px] text-slate-500 font-mono">
            Hostinger VPS Single Operator Portal • v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
