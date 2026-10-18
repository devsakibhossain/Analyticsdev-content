'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Menu, LogOut, CheckCircle2, AlertTriangle, ChevronDown, Settings, Server, ShieldCheck, Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { HealthStatus, User } from '@/types';
import { useTheme } from '@/components/theme/ThemeProvider';

interface NavbarProps {
  onMenuClick: () => void;
  title?: string;
}

export default function Navbar({ onMenuClick, title }: NavbarProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch health status
    fetchApi<HealthStatus>('/health')
      .then(setHealth)
      .catch(() => setHealth(null));

    // Fetch user info
    fetchApi<User>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null));

    // Close menu when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('leadfinder_token');
      window.location.href = '/login';
    }
  };

  return (
    <header className="h-16 bg-dark-950/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 shadow-sm">
      <div className="flex items-center space-x-3">
        <button
          onClick={onMenuClick}
          className="p-2 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-white/5 lg:hidden transition-colors"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight">
            {title || 'CRM Ultra • Sales & Outreach Platform'}
          </h1>
        </div>
      </div>

      <div className="flex items-center space-x-2.5">
        {/* Quick Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm flex items-center justify-center group"
          title={resolvedTheme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          aria-label="Toggle Theme"
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-4 h-4 text-blue-500 group-hover:-rotate-12 transition-transform" />
          )}
        </button>

        {/* Smart Account & System Diagnostics Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center space-x-2.5 p-1.5 pr-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm"
            title="System Status & Account"
          >
            <div className="relative">
              <div className="w-7 h-7 rounded-lg overflow-hidden border border-blue-500/30 bg-dark-950 flex items-center justify-center shadow-sm">
                <img src="/avatar.png" alt="Profile" className="w-full h-full object-cover" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                {health?.status === 'ok' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 ring-2 ring-dark-950"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 ring-2 ring-dark-950"></span>
                )}
              </span>
            </div>

            <span className="hidden sm:inline font-mono text-[11px] text-slate-300 max-w-[130px] truncate">
              {user ? user.email.split('@')[0] : 'Sakib'}
            </span>

            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${menuOpen ? 'rotate-180 text-blue-400' : ''}`} />
          </button>

          {/* Smart Popover Menu */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-dark-900 border border-white/10 shadow-2xl p-3 z-50 animate-slide-up space-y-3">
              {/* User Account Info */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-blue-500/30 bg-dark-950 flex-shrink-0 shadow-md">
                  <img src="/avatar.png" alt="Profile" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs text-slate-200 truncate">{user?.email || 'admin@crmultra.io'}</div>
                  <div className="text-[10px] text-slate-400 font-mono">Administrator • Sakib Hossain</div>
                </div>
              </div>

              {/* System Diagnostics (Revealed when needed) */}
              <div className="p-3 rounded-xl bg-dark-950/80 border border-white/5 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center justify-between">
                  <span>System Diagnostics</span>
                  {health?.status === 'ok' ? (
                    <span className="text-emerald-400 font-bold flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Nodes Healthy</span>
                    </span>
                  ) : (
                    <span className="text-amber-400 font-bold flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <span>Degraded</span>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                  <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                    <span className="text-[9px] text-slate-500 block uppercase">Cluster Node</span>
                    <span className="text-blue-400 font-medium text-[10px] truncate block">2.25.228.102</span>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 border border-white/5">
                    <span className="text-[9px] text-slate-500 block uppercase">Hostinger Mail</span>
                    <span className="text-emerald-400 font-medium text-[10px]">Connected</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-1 border-t border-white/5 space-y-1">
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center space-x-2.5">
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Settings & Appearance</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-white/10 text-slate-300">
                    {resolvedTheme === 'dark' ? 'Dark' : 'Light'}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2.5 w-full px-3 py-2 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-red-400" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
