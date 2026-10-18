'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { 
  Globe, 
  Search, 
  Sparkles, 
  SlidersHorizontal, 
  Layers, 
  Users, 
  Target, 
  Mail, 
  Phone, 
  BarChart3, 
  ArrowUpRight, 
  TrendingUp, 
  Activity, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Trash2,
  Eye,
  Zap,
  ShoppingBag,
  Laptop,
  Stethoscope,
  ChevronRight
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { HealthStatus, StatsOverview, Lead, ScanJob } from '@/types';
import { useToast } from '@/components/ui/Toast';
import ScoreBreakdown from '@/components/leads/ScoreBreakdown';
import LeadQuickDrawer from '@/components/leads/LeadQuickDrawer';

const QUICK_PRESETS = [
  { label: 'E-commerce', domain: 'gymshark.com', icon: ShoppingBag, maxPages: 20 },
  { label: 'SaaS Platform', domain: 'linear.app', icon: Laptop, maxPages: 15 },
  { label: 'Healthcare / Dental', domain: 'austinsmilecenter.com', icon: Stethoscope, maxPages: 10 },
  { label: 'Personal Portfolio', domain: 'sakibhossain.io', icon: Globe, maxPages: 10 },
];

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState<number>(20);
  const [useSitemap, setUseSitemap] = useState(true);
  const [scanJs, setScanJs] = useState(true);
  const [scanTracking, setScanTracking] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [recentScans, setRecentScans] = useState<ScanJob[]>([]);

  // Quick Inspection Drawer
  const [inspectLead, setInspectLead] = useState<Lead | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('leadfinder_token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadDashboardData();
    const interval = setInterval(loadDashboardData, 10000);
    return () => clearInterval(interval);
  }, [router]);

  const loadDashboardData = async () => {
    try {
      const [h, s, l, sc] = await Promise.all([
        fetchApi<HealthStatus>('/health'),
        fetchApi<StatsOverview>('/stats').catch(() => null),
        fetchApi<Lead[]>('/leads?limit=5').catch(() => []),
        fetchApi<ScanJob[]>('/scans?limit=5').catch(() => [])
      ]);
      setHealth(h);
      if (s) setStats(s);
      if (l) setRecentLeads(l);
      if (sc) setRecentScans(sc);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    }
  };

  const handleDeleteScan = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this scan record?')) return;
    try {
      await fetchApi(`/scans/${id}`, { method: 'DELETE' });
      setRecentScans((prev) => prev.filter((s) => s.id !== id));
      toast('Scan job removed', 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to delete scan', 'error');
    }
  };

  const handleClearFailedScans = async () => {
    if (!confirm('Are you sure you want to delete all failed scan jobs?')) return;
    try {
      await fetchApi('/scans?status=failed', { method: 'DELETE' });
      setRecentScans((prev) => prev.filter((s) => s.status !== 'failed'));
      toast('Cleared all failed scan records', 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to clear failed scans', 'error');
    }
  };

  const handleClearAllScans = async () => {
    if (!confirm('Are you sure you want to clear all scan history?')) return;
    try {
      await fetchApi('/scans?all=true', { method: 'DELETE' });
      setRecentScans([]);
      toast('All scan history cleared', 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to clear scans', 'error');
    }
  };

  const handleDeleteLead = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      await fetchApi(`/leads/${id}`, { method: 'DELETE' });
      setRecentLeads((prev) => prev.filter((l) => l.id !== id));
      if (inspectLead?.id === id) setInspectLead(null);
      loadDashboardData();
      toast('Lead removed from database', 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to delete lead', 'error');
    }
  };

  const handleRescanLead = async (id: number) => {
    try {
      const res = await fetchApi<{ scan_id: number }>(`/leads/${id}/rescan`, { method: 'POST' });
      if (res && res.scan_id) {
        toast('Deep rescan queued', 'success');
        router.push(`/scans?active=${res.scan_id}`);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to start rescan', 'error');
    }
  };

  const handleSelectPreset = (preset: typeof QUICK_PRESETS[0]) => {
    setUrl(`https://${preset.domain}`);
    setMaxPages(preset.maxPages);
    toast(`Loaded preset: ${preset.label}`, 'info');
  };

  const handleStartScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setScanError(null);
    setIsScanning(true);

    try {
      const response = await fetchApi<{ id: number }>('/scans', {
        method: 'POST',
        body: JSON.stringify({
          url: url.trim(),
          max_pages: maxPages,
          use_sitemap: useSitemap,
          scan_js: scanJs,
          scan_tracking: scanTracking,
        }),
      });

      if (response && response.id) {
        toast('Scan initialized successfully', 'success');
        router.push(`/scans?active=${response.id}`);
      }
    } catch (err: any) {
      setScanError(err.message || 'Failed to start scan job');
      toast(err.message || 'Failed to start scan job', 'error');
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col lg:flex-row">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title="Scanner Intelligence Center" />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 sm:space-y-8 animate-fade-in">
          {/* Hero & Scanner Card with Ambient Blue Aurora Glow */}
          <div className="relative rounded-3xl p-6 sm:p-8 lg:p-10 overflow-hidden border border-white/10 glass-card">
            {/* Ambient Aurora Glow Background in Blue / Indigo / Cyan */}
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-gradient-to-br from-blue-600/30 via-indigo-600/20 to-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-glow-pulse" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-gradient-to-tr from-cyan-600/15 via-blue-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-4xl space-y-5">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-semibold tracking-wide">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Deterministic Client Prospecting & Martech Audit Engine</span>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
                  Discover High-Opportunity <span className="text-gradient-brand">Website Leads</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
                  Extract direct emails, phone numbers, WhatsApp, social profiles, and detect CMS, e-commerce, GA4, GTM, Meta Pixel, and high-value conversion tracking audit gaps.
                </p>
              </div>

              {/* Main Input Form */}
              <form onSubmit={handleStartScan} className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1 group">
                    <Globe className="w-5 h-5 absolute left-4 top-3.5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                    <input
                      type="text"
                      required
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="Enter target domain e.g. example.com or https://company.com"
                      className="w-full pl-12 pr-4 py-3.5 bg-dark-950/80 border border-white/10 focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/25 rounded-2xl text-sm sm:text-base text-slate-100 placeholder-slate-500 outline-none transition-all shadow-inner"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isScanning}
                    className="inline-flex items-center justify-center space-x-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 text-white font-bold text-sm sm:text-base transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/45 hover:-translate-y-0.5 cursor-pointer flex-shrink-0"
                  >
                    <Search className="w-4 h-4" />
                    <span>{isScanning ? 'Queuing Crawler...' : 'Scan Website'}</span>
                  </button>
                </div>

                {/* Quick Presets Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="text-slate-400 flex items-center space-x-1 mr-1">
                    <Zap className="w-3 h-3 text-cyan-400" />
                    <span>Quick presets:</span>
                  </span>
                  {QUICK_PRESETS.map((p) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => handleSelectPreset(p)}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-blue-500/15 border border-white/5 hover:border-blue-500/30 text-slate-300 hover:text-blue-300 text-[11px] transition-all"
                      >
                        <Icon className="w-3 h-3 text-slate-400" />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Error message */}
                {scanError && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs animate-slide-up">
                    {scanError}
                  </div>
                )}

                {/* Options toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{showAdvanced ? 'Hide Advanced Crawler Settings' : 'Configure Crawler Parameters'}</span>
                  </button>
                  <span className="text-[11px] text-slate-400 font-mono">Max limit: {maxPages} pages</span>
                </div>

                {/* Advanced Configuration Panel */}
                {showAdvanced && (
                  <div className="p-4 bg-dark-950/70 border border-white/10 rounded-2xl space-y-4 text-xs text-slate-300 animate-slide-up">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-slate-400 mb-1.5 font-medium">Max Page Depth</label>
                        <select
                          value={maxPages}
                          onChange={(e) => setMaxPages(Number(e.target.value))}
                          className="w-full bg-dark-900 border border-white/10 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-blue-500/50"
                        >
                          <option value={10}>10 pages (Rapid scan)</option>
                          <option value={20}>20 pages (Recommended)</option>
                          <option value={50}>50 pages (Deep audit)</option>
                        </select>
                      </div>

                      <div className="flex items-center space-x-2 pt-6">
                        <input
                          type="checkbox"
                          id="sitemapToggle"
                          checked={useSitemap}
                          onChange={(e) => setUseSitemap(e.target.checked)}
                          className="rounded bg-dark-900 border-white/10 text-blue-500 focus:ring-blue-500/30"
                        />
                        <label htmlFor="sitemapToggle" className="cursor-pointer select-none text-slate-300">
                          Inspect sitemap.xml
                        </label>
                      </div>

                      <div className="flex items-center space-x-2 pt-6">
                        <input
                          type="checkbox"
                          id="jsToggle"
                          checked={scanJs}
                          onChange={(e) => setScanJs(e.target.checked)}
                          className="rounded bg-dark-900 border-white/10 text-blue-500 focus:ring-blue-500/30"
                        />
                        <label htmlFor="jsToggle" className="cursor-pointer select-none text-slate-300">
                          Execute JS & Playwright
                        </label>
                      </div>

                      <div className="flex items-center space-x-2 pt-6">
                        <input
                          type="checkbox"
                          id="trackingToggle"
                          checked={scanTracking}
                          onChange={(e) => setScanTracking(e.target.checked)}
                          className="rounded bg-dark-900 border-white/10 text-blue-500 focus:ring-blue-500/30"
                        />
                        <label htmlFor="trackingToggle" className="cursor-pointer select-none text-slate-300">
                          Intercept Pixel Beacons
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="glass-card glass-card-hover rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Leads</span>
                <div className="p-1 rounded-md bg-white/5 text-slate-400">
                  <Users className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-100">{stats?.total_leads ?? 0}</div>
              <div className="text-[10px] text-slate-400">Collected in database</div>
            </div>

            <div className="glass-card glass-card-hover rounded-2xl p-4 space-y-1 border-blue-500/30">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>High Opportunity</span>
                <div className="p-1 rounded-lg bg-blue-500/15 text-blue-400">
                  <Target className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-blue-400">{stats?.high_opportunity ?? 0}</div>
              <div className="text-[10px] text-blue-300/80">Score 80–100</div>
            </div>

            <div className="glass-card glass-card-hover rounded-2xl p-4 space-y-1 border-amber-500/20">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Medium Opp</span>
                <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400">
                  <Target className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-amber-400">{stats?.medium_opportunity ?? 0}</div>
              <div className="text-[10px] text-amber-400/80">Score 60–79</div>
            </div>

            <div className="glass-card glass-card-hover rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Emails Found</span>
                <div className="p-1 rounded-lg bg-cyan-500/15 text-cyan-400">
                  <Mail className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-100">{stats?.emails_found ?? 0}</div>
              <div className="text-[10px] text-slate-400">Verified addresses</div>
            </div>

            <div className="glass-card glass-card-hover rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Phones Found</span>
                <div className="p-1 rounded-lg bg-indigo-500/15 text-indigo-400">
                  <Phone className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-100">{stats?.phones_found ?? 0}</div>
              <div className="text-[10px] text-slate-400">Direct dial numbers</div>
            </div>

            <div className="glass-card glass-card-hover rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>E-Commerce</span>
                <div className="p-1 rounded-lg bg-rose-500/10 text-rose-400">
                  <Layers className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-100">{stats?.ecommerce_count ?? 0}</div>
              <div className="text-[10px] text-slate-400">Store platforms</div>
            </div>
          </div>

          {/* Marketing Technology Adoption Overview */}
          <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span>Martech Stack Penetration Matrix</span>
              </h3>
              <Link href="/leads" className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1 transition-colors">
                <span>View full database</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs">
              <div className="p-4 rounded-xl bg-dark-950/80 border border-white/5 space-y-1">
                <div className="text-slate-400 font-medium">Google Analytics 4</div>
                <div className="text-lg font-bold text-slate-100">{stats?.ga4_count ?? 0} sites</div>
                <div className="text-[10px] text-slate-400">Direct measurement</div>
              </div>
              <div className="p-4 rounded-xl bg-dark-950/80 border border-white/5 space-y-1">
                <div className="text-slate-400 font-medium">Google Tag Manager</div>
                <div className="text-lg font-bold text-slate-100">{stats?.gtm_count ?? 0} sites</div>
                <div className="text-[10px] text-slate-400">Container management</div>
              </div>
              <div className="p-4 rounded-xl bg-dark-950/80 border border-white/5 space-y-1">
                <div className="text-slate-400 font-medium">Meta Pixel</div>
                <div className="text-lg font-bold text-slate-100">{stats?.meta_pixel_count ?? 0} sites</div>
                <div className="text-[10px] text-slate-400">Social audience pixels</div>
              </div>
              <div className="p-4 rounded-xl bg-dark-950/80 border border-white/5 space-y-1">
                <div className="text-slate-400 font-medium">Google Ads</div>
                <div className="text-lg font-bold text-slate-100">{stats?.google_ads_count ?? 0} sites</div>
                <div className="text-[10px] text-slate-400">PPC conversion tracking</div>
              </div>
            </div>
          </div>

          {/* Two-Column Grid: Recent Leads & Recent Scans */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Leads */}
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>Recent Lead Profiles</span>
                </h3>
                <Link href="/leads" className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
                  View all leads
                </Link>
              </div>

              {recentLeads.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-dark-950/50 rounded-xl border border-white/5">
                  No leads discovered yet. Enter a website URL above to start scanning.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {recentLeads.map((l) => (
                    <div key={l.id} className="py-3 flex items-center justify-between group">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <Link 
                            href={`/leads/${l.id}`}
                            className="font-semibold text-slate-200 group-hover:text-blue-300 text-sm transition-colors truncate max-w-[200px]"
                          >
                            {l.company_name || l.domain}
                          </Link>
                          <a
                            href={l.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-blue-400 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center space-x-2 font-mono">
                          <span>{l.domain}</span>
                          <span>•</span>
                          <span className="text-slate-400">{l.industry || 'Unknown'}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Interactive score meter */}
                        <ScoreBreakdown lead={l} size="sm" />

                        {/* Quick Inspect eye button */}
                        <button
                          onClick={() => setInspectLead(l)}
                          className="p-1.5 text-slate-400 hover:text-blue-300 rounded-lg hover:bg-white/5 transition-colors"
                          title="Quick Inspect Lead"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={(e) => handleDeleteLead(l.id, e)}
                          className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
                          title="Delete Lead"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Scans */}
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span>Recent Scan Jobs</span>
                </h3>
                <div className="flex items-center space-x-2">
                  {recentScans.some((s) => s.status === 'failed') && (
                    <button
                      onClick={handleClearFailedScans}
                      className="px-2 py-0.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-medium transition-colors"
                    >
                      Clear Failed
                    </button>
                  )}
                  {recentScans.length > 0 && (
                    <button
                      onClick={handleClearAllScans}
                      className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-white/5 hover:border-red-500/20 text-[10px] font-medium transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                  <Link href="/scans" className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
                    View all
                  </Link>
                </div>
              </div>

              {recentScans.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-dark-950/50 rounded-xl border border-white/5">
                  No scan jobs executed yet.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {recentScans.map((s) => (
                    <div key={s.id} className="py-3 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-200 text-sm font-mono truncate max-w-[200px]">
                          {s.domain}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center space-x-2">
                          <span>{s.pages_crawled} pages</span>
                          <span>•</span>
                          <span>{s.current_step || s.status}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2.5">
                        <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full capitalize font-semibold ${
                          s.status === 'completed'
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            : s.status === 'running' || s.status === 'queued'
                            ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                            : s.status === 'failed'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-white/5 text-slate-400'
                        }`}>
                          {s.status}
                        </span>

                        <Link
                          href={`/scans?active=${s.id}`}
                          className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-white/5 transition-colors"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>

                        <button
                          onClick={(e) => handleDeleteScan(s.id, e)}
                          className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
                          title="Delete Scan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Slide-over Lead Quick Inspection Drawer */}
      <LeadQuickDrawer
        lead={inspectLead}
        isOpen={Boolean(inspectLead)}
        onClose={() => setInspectLead(null)}
        onDelete={(id) => handleDeleteLead(id)}
        onRescan={(id) => handleRescanLead(id)}
      />
    </div>
  );
}
