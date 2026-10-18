'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { 
  Radar, 
  RotateCw, 
  XCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ExternalLink,
  ArrowUpRight,
  Loader2,
  Trash2,
  CheckSquare,
  Square,
  Sparkles
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { ScanJob } from '@/types';
import { useToast } from '@/components/ui/Toast';

function ScansContent() {
  const searchParams = useSearchParams();
  const activeParamId = searchParams.get('active');
  const { toast } = useToast();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scans, setScans] = useState<ScanJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadScans();
    const interval = setInterval(loadScans, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadScans = async () => {
    try {
      const data = await fetchApi<ScanJob[]>('/scans?limit=50');
      setScans(data || []);
    } catch (err) {
      console.error('Failed to load scans', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelScan = async (id: number) => {
    try {
      await fetchApi(`/scans/${id}/cancel`, { method: 'POST' });
      toast('Scan cancelled by operator', 'info');
      loadScans();
    } catch (err: any) {
      toast(err.message || 'Failed to cancel scan', 'error');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === scans.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(scans.map(s => s.id)));
    }
  };

  const toggleSelectScan = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleDeleteScan = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this scan record?')) return;
    try {
      await fetchApi(`/scans/${id}`, { method: 'DELETE' });
      setScans(prev => prev.filter(s => s.id !== id));
      selectedIds.delete(id);
      setSelectedIds(new Set(selectedIds));
      toast('Scan record removed', 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to delete scan', 'error');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected scan(s)?`)) return;
    try {
      const idsStr = Array.from(selectedIds).join(',');
      await fetchApi(`/scans?ids=${idsStr}`, { method: 'DELETE' });
      setScans(prev => prev.filter(s => !selectedIds.has(s.id)));
      setSelectedIds(new Set());
      toast(`Deleted ${selectedIds.size} scan records`, 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to delete selected scans', 'error');
    }
  };

  const handleClearFailed = async () => {
    if (!confirm('Are you sure you want to delete all failed scan jobs?')) return;
    try {
      await fetchApi('/scans?status=failed', { method: 'DELETE' });
      setScans(prev => prev.filter(s => s.status !== 'failed'));
      setSelectedIds(new Set());
      toast('Cleared failed scan records', 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to clear failed scans', 'error');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete ALL scan history?')) return;
    try {
      await fetchApi('/scans?all=true', { method: 'DELETE' });
      setScans([]);
      setSelectedIds(new Set());
      toast('All scan history cleared', 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to clear all scans', 'error');
    }
  };

  // Find active scan (either from URL param or highest active job)
  const activeScan = scans.find(s => String(s.id) === activeParamId) || scans.find(s => s.status === 'running' || s.status === 'queued');

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col lg:flex-row">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title="Scanner Activity & Monitor" />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 flex items-center space-x-2.5">
                <div className="p-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Radar className="w-5 h-5" />
                </div>
                <span>Crawler Monitor & Live Queue</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 font-mono">
                Real-time multi-page crawling, JavaScript rendering, and audit discovery
              </p>
            </div>

            <button
              onClick={loadScans}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10 transition-all self-start sm:self-auto"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Active Scan Progress Hero (if any active or selected) */}
          {activeScan && (
            <div className="glass-card rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5 border-blue-500/20 relative overflow-hidden animate-slide-up">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase font-mono tracking-wider text-blue-400 font-bold flex items-center space-x-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400"></span>
                    </span>
                    <span>
                      {activeScan.status === 'running' || activeScan.status === 'queued'
                        ? 'Active Live Crawler Engine' 
                        : `Scan #${activeScan.id} Summary`}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-2xl font-extrabold text-slate-100 flex items-center space-x-2 mt-1">
                    <span className="font-mono">{activeScan.domain}</span>
                    <a href={activeScan.target_url} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-blue-400 transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </h3>
                </div>

                <div className="flex items-center space-x-3">
                  <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full capitalize ${
                    activeScan.status === 'running' || activeScan.status === 'queued'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse'
                      : activeScan.status === 'completed'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : activeScan.status === 'failed'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-white/5 text-slate-400'
                  }`}>
                    {activeScan.status}
                  </span>

                  {(activeScan.status === 'running' || activeScan.status === 'queued') && (
                    <button
                      onClick={() => handleCancelScan(activeScan.id)}
                      className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold transition-colors"
                    >
                      Cancel Scan
                    </button>
                  )}

                  {activeScan.lead_id && (
                    <Link
                      href={`/leads/${activeScan.lead_id}`}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
                    >
                      <span>View Lead Profile</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>

              {/* Progress Bar with Shimmer */}
              <div className="space-y-2 relative z-10">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-medium flex items-center space-x-2">
                    {(activeScan.status === 'running' || activeScan.status === 'queued') && (
                      <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                    )}
                    <span>{activeScan.current_step || 'Initializing crawl...'}</span>
                  </span>
                  <span className="font-mono text-blue-400 font-bold">{activeScan.progress}%</span>
                </div>
                <div className="w-full h-3 bg-dark-950 rounded-full overflow-hidden border border-white/10 p-0.5">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 rounded-full transition-all duration-300 shimmer-progress"
                    style={{ width: `${Math.max(activeScan.progress, 5)}%` }}
                  />
                </div>
              </div>

              {/* Scan Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1 relative z-10">
                <div className="p-3 bg-dark-950/80 rounded-xl border border-white/5 space-y-0.5">
                  <div className="text-slate-400 text-[10px] uppercase font-mono">Pages Scanned</div>
                  <div className="font-bold text-slate-100 text-sm font-mono">{activeScan.pages_crawled} / {activeScan.max_pages}</div>
                </div>
                <div className="p-3 bg-dark-950/80 rounded-xl border border-white/5 space-y-0.5">
                  <div className="text-slate-400 text-[10px] uppercase font-mono">Pages Failed</div>
                  <div className="font-bold text-slate-100 text-sm font-mono">{activeScan.pages_failed}</div>
                </div>
                <div className="p-3 bg-dark-950/80 rounded-xl border border-white/5 space-y-0.5">
                  <div className="text-slate-400 text-[10px] uppercase font-mono">Sitemap Discovery</div>
                  <div className="font-bold text-slate-100 text-sm">{activeScan.use_sitemap ? 'Active' : 'Bypassed'}</div>
                </div>
                <div className="p-3 bg-dark-950/80 rounded-xl border border-white/5 space-y-0.5">
                  <div className="text-slate-400 text-[10px] uppercase font-mono">JS Engine</div>
                  <div className="font-bold text-slate-100 text-sm">{activeScan.scan_js ? 'Playwright Headless' : 'Fast HTTP'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Full Scan History Table */}
          <div className="glass-card rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <h3 className="text-sm font-bold text-slate-100">All Scan Records</h3>
                <span className="text-xs text-slate-400 font-mono">({scans.length} total)</span>
              </div>

              <div className="flex items-center space-x-2 flex-wrap gap-2">
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl shadow-md shadow-red-600/20 flex items-center space-x-1.5 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedIds.size})</span>
                  </button>
                )}
                {scans.some(s => s.status === 'failed') && (
                  <button
                    onClick={handleClearFailed}
                    className="px-3 py-1.5 text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 rounded-xl flex items-center space-x-1.5 transition-all"
                    title="Delete all failed scan jobs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Failed</span>
                  </button>
                )}
                {scans.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="px-3 py-1.5 text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl flex items-center space-x-1.5 transition-all"
                    title="Clear entire scan history"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-dark-950/90 text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-3.5 px-4 w-8">
                      <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-200">
                        {scans.length > 0 && selectedIds.size === scans.length ? (
                          <CheckSquare className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3.5 px-4">Domain</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Progress</th>
                    <th className="py-3.5 px-4">Pages</th>
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center text-slate-500">
                        <div className="flex items-center justify-center space-x-2">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-400"></span>
                          </span>
                          <span>Loading scan history...</span>
                        </div>
                      </td>
                    </tr>
                  ) : scans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-500">
                        No scan jobs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    scans.map((s) => (
                      <tr key={s.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3.5 px-4">
                          <button onClick={() => toggleSelectScan(s.id)} className="text-slate-400 hover:text-slate-200">
                            {selectedIds.has(s.id) ? (
                              <CheckSquare className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-100 font-mono">
                          {s.domain}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full capitalize font-semibold ${
                            s.status === 'completed'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : s.status === 'running' || s.status === 'queued'
                              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                              : s.status === 'failed'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-white/5 text-slate-400'
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] font-bold">
                          {s.progress}%
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 font-mono">
                          {s.pages_crawled} pages {s.pages_failed > 0 ? `(${s.pages_failed} failed)` : ''}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 text-[11px] font-mono">
                          {new Date(s.created_at).toLocaleDateString()} {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {s.lead_id ? (
                              <Link 
                                href={`/leads/${s.lead_id}`}
                                className="text-blue-400 hover:text-blue-300 font-bold inline-flex items-center space-x-1"
                              >
                                <span>View Lead</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </Link>
                            ) : null}
                            <button
                              onClick={(e) => handleDeleteScan(s.id, e)}
                              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                              title="Delete scan record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ScansPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark-950 p-12 text-center text-xs text-slate-500">
        Loading scans monitor...
      </div>
    }>
      <ScansContent />
    </Suspense>
  );
}
