'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { 
  Settings, 
  Server, 
  ShieldCheck, 
  Database, 
  Cpu, 
  User, 
  Key, 
  Lock,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Palette,
  Sun,
  Moon,
  Laptop,
  Sparkles,
  Eye,
  Sliders,
  Check,
  Zap,
  Layout,
  Layers
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { HealthStatus, User as UserType } from '@/types';
import { useTheme, Theme } from '@/components/theme/ThemeProvider';
import { useToast } from '@/components/ui/Toast';

type TabType = 'appearance' | 'system' | 'security';

export default function SettingsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [user, setUser] = useState<UserType | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('appearance');

  // Display customizations
  const [blurEnabled, setBlurEnabled] = useState(true);
  const [glowEnabled, setGlowEnabled] = useState(true);
  const [accentColor, setAccentColor] = useState('blue');

  const { theme, resolvedTheme, setTheme } = useTheme();
  const { toast } = useToast();

  useEffect(() => {
    fetchApi<HealthStatus>('/health').then(setHealth).catch(() => setHealth(null));
    fetchApi<UserType>('/auth/me').then(setUser).catch(() => setUser(null));

    // Load display preferences
    if (typeof window !== 'undefined') {
      const savedBlur = localStorage.getItem('crm_ultra_blur');
      if (savedBlur !== null) setBlurEnabled(savedBlur === 'true');
      const savedGlow = localStorage.getItem('crm_ultra_glow');
      if (savedGlow !== null) setGlowEnabled(savedGlow === 'true');
      const savedAccent = localStorage.getItem('crm_ultra_accent');
      if (savedAccent) setAccentColor(savedAccent);
    }
  }, []);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    const label = newTheme === 'light' ? 'Light Theme' : newTheme === 'dark' ? 'Dark Cyber Theme' : 'System Theme';
    toast(`Switched to ${label}`, 'info');
  };

  const handleToggleBlur = () => {
    const next = !blurEnabled;
    setBlurEnabled(next);
    localStorage.setItem('crm_ultra_blur', String(next));
    toast(next ? 'Glassmorphism blur enabled' : 'Glassmorphism blur reduced', 'info');
  };

  const handleToggleGlow = () => {
    const next = !glowEnabled;
    setGlowEnabled(next);
    localStorage.setItem('crm_ultra_glow', String(next));
    toast(next ? 'Ambient glow effects enabled' : 'Ambient glow effects hidden', 'info');
  };

  const handleSelectAccent = (color: string) => {
    setAccentColor(color);
    localStorage.setItem('crm_ultra_accent', color);
    toast(`Primary accent set to ${color}`, 'info');
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col lg:flex-row transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title="Settings & Appearance" />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 sm:space-y-8 animate-fade-in">
          {/* Main Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
                <Settings className="w-3.5 h-3.5" />
                <span>Console Configuration & Theme</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
                Settings & <span className="text-gradient-brand">Preferences</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 font-mono">
                Manage appearance, light/dark themes, hostinger VPS engine, and security parameters
              </p>
            </div>

            {/* Quick Status Pill */}
            <div className="flex items-center space-x-2 px-3.5 py-2 rounded-2xl glass-card text-xs font-mono text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Theme: <strong className="text-blue-400 capitalize">{resolvedTheme}</strong></span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Node: 2.25.228.102</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-1 sm:space-x-2 p-1.5 rounded-2xl glass-card border border-white/5 overflow-x-auto">
            <button
              onClick={() => setActiveTab('appearance')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'appearance'
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Appearance & Theme</span>
            </button>

            <button
              onClick={() => setActiveTab('system')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'system'
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>Hostinger VPS & Engine</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Security & SSRF Firewall</span>
            </button>
          </div>

          {/* TAB 1: APPEARANCE & THEME */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 sm:space-y-8 animate-fade-in">
              {/* Theme Mode Selector Header */}
              <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-6">
                <div>
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      <Palette className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-slate-100">Theme Mode Selection</h3>
                      <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                        Choose your preferred workspace aesthetic. Supports high-contrast Light, signature Dark, and automatic system synchronization.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3 Theme Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* 1. LIGHT THEME CARD */}
                  <div
                    onClick={() => handleThemeChange('light')}
                    className={`relative rounded-2xl p-5 border cursor-pointer transition-all duration-200 group flex flex-col justify-between ${
                      theme === 'light'
                        ? 'border-blue-500 bg-blue-500/5 shadow-xl shadow-blue-500/10 ring-2 ring-blue-500/30'
                        : 'border-white/10 hover:border-blue-500/40 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Mini UI Mockup: Light Mode */}
                      <div className="w-full h-32 rounded-xl bg-slate-50 border border-slate-200 p-2.5 flex flex-col justify-between overflow-hidden shadow-inner relative group-hover:scale-[1.02] transition-transform">
                        {/* Mini Navbar */}
                        <div className="h-4 bg-white rounded-md border border-slate-200 flex items-center justify-between px-2 shadow-xs">
                          <div className="flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span className="w-12 h-1 bg-slate-300 rounded" />
                          </div>
                          <span className="w-3 h-3 rounded-full bg-blue-100 border border-blue-300" />
                        </div>

                        {/* Mini Dashboard Content */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="p-1.5 bg-white rounded-lg border border-slate-200 space-y-1 shadow-xs">
                            <span className="w-6 h-1 bg-slate-300 rounded block" />
                            <span className="w-4 h-2 bg-blue-500 rounded block" />
                          </div>
                          <div className="p-1.5 bg-white rounded-lg border border-slate-200 space-y-1 shadow-xs">
                            <span className="w-6 h-1 bg-slate-300 rounded block" />
                            <span className="w-5 h-2 bg-emerald-500 rounded block" />
                          </div>
                          <div className="p-1.5 bg-white rounded-lg border border-slate-200 space-y-1 shadow-xs">
                            <span className="w-6 h-1 bg-slate-300 rounded block" />
                            <span className="w-3 h-2 bg-amber-500 rounded block" />
                          </div>
                        </div>

                        {/* Mini Table Rows */}
                        <div className="space-y-1">
                          <div className="h-2.5 bg-white rounded border border-slate-200 flex items-center px-1.5 space-x-1">
                            <span className="w-2 h-1 bg-slate-400 rounded" />
                            <span className="w-10 h-1 bg-slate-200 rounded" />
                          </div>
                          <div className="h-2.5 bg-white rounded border border-slate-200 flex items-center px-1.5 space-x-1">
                            <span className="w-2 h-1 bg-slate-400 rounded" />
                            <span className="w-8 h-1 bg-slate-200 rounded" />
                          </div>
                        </div>

                        {/* Sun Icon Badge */}
                        <div className="absolute top-2 right-2 p-1 rounded-md bg-amber-100 text-amber-600 shadow-sm">
                          <Sun className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      {/* Details */}
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                            <Sun className="w-4 h-4 text-amber-400" />
                            <span>Light Theme</span>
                          </h4>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Daytime Clarity
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                          Clean slate background with high-contrast dark typography, crisp borders, and bright luminous accents.
                        </p>
                      </div>
                    </div>

                    {/* Active State / Selector Button */}
                    <div className="pt-4 border-t border-white/5 mt-4">
                      {theme === 'light' ? (
                        <div className="flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-500/20">
                          <Check className="w-3.5 h-3.5" />
                          <span>Active Theme</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors"
                        >
                          Select Light
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2. DARK THEME CARD (Signature) */}
                  <div
                    onClick={() => handleThemeChange('dark')}
                    className={`relative rounded-2xl p-5 border cursor-pointer transition-all duration-200 group flex flex-col justify-between ${
                      theme === 'dark'
                        ? 'border-blue-500 bg-blue-500/5 shadow-xl shadow-blue-500/10 ring-2 ring-blue-500/30'
                        : 'border-white/10 hover:border-blue-500/40 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Mini UI Mockup: Dark Mode */}
                      <div className="w-full h-32 rounded-xl bg-[#070b14] border border-blue-500/20 p-2.5 flex flex-col justify-between overflow-hidden shadow-inner relative group-hover:scale-[1.02] transition-transform">
                        {/* Glow orb */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/20 rounded-full blur-xl pointer-events-none" />

                        {/* Mini Navbar */}
                        <div className="h-4 bg-[#0c1322] rounded-md border border-white/10 flex items-center justify-between px-2">
                          <div className="flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span className="w-12 h-1 bg-slate-600 rounded" />
                          </div>
                          <span className="w-3 h-3 rounded-full bg-blue-600/30 border border-blue-400/50" />
                        </div>

                        {/* Mini Dashboard Content */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="p-1.5 bg-[#0c1322] rounded-lg border border-white/5 space-y-1">
                            <span className="w-6 h-1 bg-slate-600 rounded block" />
                            <span className="w-4 h-2 bg-blue-400 rounded block" />
                          </div>
                          <div className="p-1.5 bg-[#0c1322] rounded-lg border border-white/5 space-y-1">
                            <span className="w-6 h-1 bg-slate-600 rounded block" />
                            <span className="w-5 h-2 bg-emerald-400 rounded block" />
                          </div>
                          <div className="p-1.5 bg-[#0c1322] rounded-lg border border-white/5 space-y-1">
                            <span className="w-6 h-1 bg-slate-600 rounded block" />
                            <span className="w-3 h-2 bg-cyan-400 rounded block" />
                          </div>
                        </div>

                        {/* Mini Table Rows */}
                        <div className="space-y-1">
                          <div className="h-2.5 bg-[#0c1322] rounded border border-white/5 flex items-center px-1.5 space-x-1">
                            <span className="w-2 h-1 bg-slate-500 rounded" />
                            <span className="w-10 h-1 bg-slate-700 rounded" />
                          </div>
                          <div className="h-2.5 bg-[#0c1322] rounded border border-white/5 flex items-center px-1.5 space-x-1">
                            <span className="w-2 h-1 bg-slate-500 rounded" />
                            <span className="w-8 h-1 bg-slate-700 rounded" />
                          </div>
                        </div>

                        {/* Moon Icon Badge */}
                        <div className="absolute top-2 right-2 p-1 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-sm">
                          <Moon className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      {/* Details */}
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                            <Moon className="w-4 h-4 text-blue-400" />
                            <span>Dark Cyber Theme</span>
                          </h4>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            Signature Dark
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                          Signature deep navy glassmorphism with subtle aurora ambient glow and low eye-strain cyber styling.
                        </p>
                      </div>
                    </div>

                    {/* Active State / Selector Button */}
                    <div className="pt-4 border-t border-white/5 mt-4">
                      {theme === 'dark' ? (
                        <div className="flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-500/20">
                          <Check className="w-3.5 h-3.5" />
                          <span>Active Theme</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors"
                        >
                          Select Dark
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 3. SYSTEM SYNC THEME CARD */}
                  <div
                    onClick={() => handleThemeChange('system')}
                    className={`relative rounded-2xl p-5 border cursor-pointer transition-all duration-200 group flex flex-col justify-between ${
                      theme === 'system'
                        ? 'border-blue-500 bg-blue-500/5 shadow-xl shadow-blue-500/10 ring-2 ring-blue-500/30'
                        : 'border-white/10 hover:border-blue-500/40 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Mini UI Mockup: Split System */}
                      <div className="w-full h-32 rounded-xl border border-white/10 flex overflow-hidden shadow-inner relative group-hover:scale-[1.02] transition-transform">
                        {/* Left Half Light */}
                        <div className="w-1/2 bg-slate-50 border-r border-slate-300 p-2 flex flex-col justify-between">
                          <div className="h-3 bg-white rounded border border-slate-200 flex items-center px-1">
                            <span className="w-4 h-1 bg-blue-500 rounded" />
                          </div>
                          <div className="p-1 bg-white rounded border border-slate-200 space-y-1">
                            <span className="w-5 h-1 bg-slate-300 rounded block" />
                            <span className="w-3 h-1.5 bg-blue-500 rounded block" />
                          </div>
                          <div className="h-2 bg-white rounded border border-slate-200" />
                        </div>

                        {/* Right Half Dark */}
                        <div className="w-1/2 bg-[#070b14] p-2 flex flex-col justify-between">
                          <div className="h-3 bg-[#0c1322] rounded border border-white/10 flex items-center px-1">
                            <span className="w-4 h-1 bg-blue-400 rounded" />
                          </div>
                          <div className="p-1 bg-[#0c1322] rounded border border-white/10 space-y-1">
                            <span className="w-5 h-1 bg-slate-600 rounded block" />
                            <span className="w-3 h-1.5 bg-cyan-400 rounded block" />
                          </div>
                          <div className="h-2 bg-[#0c1322] rounded border border-white/10" />
                        </div>

                        {/* Monitor Icon Badge */}
                        <div className="absolute top-2 right-2 p-1 rounded-md bg-white/10 text-slate-200 border border-white/20 shadow-sm backdrop-blur-md">
                          <Laptop className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      {/* Details */}
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                            <Laptop className="w-4 h-4 text-cyan-400" />
                            <span>System Default</span>
                          </h4>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            Auto Adaptive
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                          Automatically switches between Light and Dark mode based on your operating system (macOS / Windows) settings.
                        </p>
                      </div>
                    </div>

                    {/* Active State / Selector Button */}
                    <div className="pt-4 border-t border-white/5 mt-4">
                      {theme === 'system' ? (
                        <div className="flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-500/20">
                          <Check className="w-3.5 h-3.5" />
                          <span>Active (Auto)</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors"
                        >
                          Sync with System
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual Effects & Layout Preferences */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Visual Glassmorphism & Aurora Controls */}
                <div className="glass-card rounded-2xl p-6 space-y-5">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <span>Visual Effects & Glassmorphism</span>
                  </h3>

                  <div className="space-y-4 text-xs">
                    {/* Glassmorphism Toggle */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-dark-950/80 border border-white/5">
                      <div className="space-y-0.5 max-w-[280px]">
                        <span className="font-semibold text-slate-200 block">Glassmorphism Backdrops</span>
                        <span className="text-slate-400 text-[11px]">
                          Enable real-time backdrop blur filters on navigation, cards, and modal dialogs.
                        </span>
                      </div>
                      <button
                        onClick={handleToggleBlur}
                        className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                          blurEnabled ? 'bg-blue-600' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
                            blurEnabled ? 'left-6.5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Ambient Aurora Glow Toggle */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-dark-950/80 border border-white/5">
                      <div className="space-y-0.5 max-w-[280px]">
                        <span className="font-semibold text-slate-200 block">Ambient Aurora Glow</span>
                        <span className="text-slate-400 text-[11px]">
                          Display animated radial blue/cyan aurora light orbs in the background.
                        </span>
                      </div>
                      <button
                        onClick={handleToggleGlow}
                        className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                          glowEnabled ? 'bg-blue-600' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
                            glowEnabled ? 'left-6.5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Brand Color & Typography Tuning */}
                <div className="glass-card rounded-2xl p-6 space-y-5">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-blue-400" />
                    <span>Brand Accent & Contrast</span>
                  </h3>

                  <div className="space-y-4 text-xs">
                    {/* Accent Colors */}
                    <div className="p-3.5 rounded-xl bg-dark-950/80 border border-white/5 space-y-2.5">
                      <span className="font-semibold text-slate-200 block">Primary Brand Color</span>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleSelectAccent('blue')}
                          className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition-all ${
                            accentColor === 'blue'
                              ? 'border-blue-500 bg-blue-500/20 text-blue-300 font-bold'
                              : 'border-white/10 hover:border-white/20 text-slate-400'
                          }`}
                        >
                          <span className="w-3 h-3 rounded-full bg-blue-500" />
                          <span>Ultra Blue</span>
                        </button>

                        <button
                          onClick={() => handleSelectAccent('indigo')}
                          className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition-all ${
                            accentColor === 'indigo'
                              ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300 font-bold'
                              : 'border-white/10 hover:border-white/20 text-slate-400'
                          }`}
                        >
                          <span className="w-3 h-3 rounded-full bg-indigo-500" />
                          <span>Indigo Night</span>
                        </button>

                        <button
                          onClick={() => handleSelectAccent('cyan')}
                          className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer transition-all ${
                            accentColor === 'cyan'
                              ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300 font-bold'
                              : 'border-white/10 hover:border-white/20 text-slate-400'
                          }`}
                        >
                          <span className="w-3 h-3 rounded-full bg-cyan-400" />
                          <span>Cyan Glow</span>
                        </button>
                      </div>
                    </div>

                    {/* Rendering Quality */}
                    <div className="p-3.5 rounded-xl bg-dark-950/80 border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-200 block">Subpixel Typography Anti-Aliasing</span>
                        <span className="text-slate-400 text-[11px]">Hardware-accelerated web font rendering</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                        ACTIVE
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HOSTINGER VPS & SYSTEM CONFIG */}
          {activeTab === 'system' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
              {/* Operator Account */}
              <div className="glass-card rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
                    <User className="w-4 h-4 text-blue-400" />
                    <span>Single Operator Account</span>
                  </h3>
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-blue-500/30 bg-dark-950 shadow-md">
                    <img src="/avatar.png" alt="Sakib Hossain" className="w-full h-full object-cover" />
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-dark-950/80 rounded-xl border border-white/5 space-y-1">
                    <span className="text-slate-500 uppercase text-[10px] font-mono">Authenticated Admin Email</span>
                    <div className="font-mono text-slate-200 text-sm font-semibold">{user?.email || 'admin@crmultra.io'}</div>
                  </div>

                  <div className="p-3 bg-dark-950/80 rounded-xl border border-white/5 space-y-1">
                    <span className="text-slate-500 uppercase text-[10px] font-mono">Authentication Mode</span>
                    <div className="text-slate-300">JWT Bearer Token + Secure HTTP-Only Cookie</div>
                  </div>

                  <div className="p-3 bg-dark-950/80 rounded-xl border border-white/5 space-y-1">
                    <span className="text-slate-500 uppercase text-[10px] font-mono">Password Encryption</span>
                    <div className="text-slate-300">Bcrypt Salted Hash (Configured via .env)</div>
                  </div>
                </div>
              </div>

              {/* Hostinger VPS Engine Status */}
              <div className="glass-card rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
                  <Server className="w-4 h-4 text-blue-400" />
                  <span>Deployment & VPS Parameters</span>
                </h3>

                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-slate-400">Database Engine</span>
                    <span className="font-mono text-blue-400 font-semibold">SQLite (WAL mode enabled)</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-slate-400">Worker Broker</span>
                    <span className="font-mono text-blue-400 font-semibold">
                      {health?.worker === 'ok' ? 'Redis 7.0 Queue' : 'In-Memory Async Worker'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-slate-400">Max Concurrent Scans</span>
                    <span className="font-mono text-slate-200">2 (Optimized for 8GB RAM)</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-slate-400">Per-Page Timeout</span>
                    <span className="font-mono text-slate-200">15,000 ms</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-400">Max Response Size</span>
                    <span className="font-mono text-slate-200">5 MB per page</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY & SSRF FIREWALL */}
          {activeTab === 'security' && (
            <div className="glass-card rounded-2xl p-6 space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Active Security & Network Protection</span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                The crawler enforces strict pre-flight DNS lookups and redirect validation before executing HTTP requests. It is physically blocked from initiating connections to loopback interfaces (<code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">127.0.0.1</code>, <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">::1</code>), RFC1918 private subnets (<code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">10.0.0.0/8</code>, <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">172.16.0.0/12</code>, <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">192.168.0.0/16</code>), link-local cloud metadata (<code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">169.254.169.254</code>), and internal TLDs.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
