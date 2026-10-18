'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  RotateCw, 
  Trash2, 
  ExternalLink, 
  Eye, 
  SlidersHorizontal,
  Mail, 
  Phone, 
  CheckSquare, 
  Square,
  Copy,
  Check,
  Sparkles,
  KanbanSquare,
  Megaphone
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Lead, PipelineStage } from '@/types';
import { useToast } from '@/components/ui/Toast';
import ScoreBreakdown from '@/components/leads/ScoreBreakdown';
import LeadQuickDrawer from '@/components/leads/LeadQuickDrawer';

const STAGE_CONFIG: Record<string, { label: string; badge: string }> = {
  new: { label: 'New', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  contacted: { label: 'Contacted', badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  meeting: { label: 'Meeting', badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  proposal: { label: 'Proposal', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  won: { label: 'Won', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  lost: { label: 'Lost', badge: 'bg-slate-800 text-slate-400 border-slate-700' },
};

export default function LeadsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & search state
  const [search, setSearch] = useState('');
  const [qualification, setQualification] = useState('');
  const [industry, setIndustry] = useState('');
  const [cms, setCms] = useState('');
  const [isEcommerce, setIsEcommerce] = useState('');
  const [hasGa4, setHasGa4] = useState<string>('');
  const [hasMeta, setHasMeta] = useState<string>('');
  const [hasGads, setHasGads] = useState<string>('');
  const [stage, setStage] = useState<string>('');
  const [adPlatform, setAdPlatform] = useState<string>('');
  const [sortBy, setSortBy] = useState('score_desc');
  const [showFilters, setShowFilters] = useState(false);

  // Selection for batch actions
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Slide-over quick inspection
  const [inspectLead, setInspectLead] = useState<Lead | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadLeads();
  }, [search, qualification, industry, cms, isEcommerce, hasGa4, hasMeta, hasGads, stage, adPlatform, sortBy]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (qualification) params.append('qualification', qualification);
      if (industry) params.append('industry', industry);
      if (cms) params.append('cms', cms);
      if (isEcommerce) params.append('is_ecommerce', isEcommerce);
      if (hasGa4 !== '') params.append('has_ga4', hasGa4);
      if (hasMeta !== '') params.append('has_meta', hasMeta);
      if (hasGads !== '') params.append('has_google_ads', hasGads);
      if (stage) params.append('stage', stage);
      if (adPlatform) params.append('ad_platform', adPlatform);
      params.append('sort_by', sortBy);

      const data = await fetchApi<Lead[]>(`/leads?${params.toString()}`);
      setLeads(data || []);
    } catch (err) {
      console.error('Failed to load leads', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast(`${label} copied!`, 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteLead = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      await fetchApi(`/leads/${id}`, { method: 'DELETE' });
      setLeads((prev) => prev.filter(l => l.id !== id));
      if (inspectLead?.id === id) setInspectLead(null);
      selectedIds.delete(id);
      setSelectedIds(new Set(selectedIds));
      toast('Lead removed from database', 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to delete lead', 'error');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected lead(s)?`)) return;
    try {
      const idsParam = Array.from(selectedIds).join(',');
      await fetchApi(`/leads?ids=${idsParam}`, { method: 'DELETE' });
      setLeads((prev) => prev.filter(l => !selectedIds.has(l.id)));
      setSelectedIds(new Set());
      toast(`Deleted ${selectedIds.size} leads`, 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to delete selected leads', 'error');
    }
  };

  const handleClearAllLeads = async () => {
    if (leads.length === 0) return;
    if (!confirm(`Are you sure you want to delete ALL leads in the database? This cannot be undone.`)) return;
    try {
      await fetchApi(`/leads?all=true`, { method: 'DELETE' });
      setLeads([]);
      setSelectedIds(new Set());
      setInspectLead(null);
      toast('All leads cleared from database', 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to delete all leads', 'error');
    }
  };

  const handleRescanLead = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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

  const toggleSelectAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)));
    }
  };

  const toggleSelectLead = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleExportCsv = (mode: 'all' | 'filtered' | 'selected') => {
    const params = new URLSearchParams();
    if (mode === 'selected') {
      if (selectedIds.size === 0) {
        toast('Please select at least one lead to export.', 'info');
        return;
      }
      params.append('lead_ids', Array.from(selectedIds).join(','));
    } else if (mode === 'filtered') {
      if (search) params.append('q', search);
      if (qualification) params.append('qualification', qualification);
      if (industry) params.append('industry', industry);
      if (cms) params.append('cms', cms);
      if (isEcommerce) params.append('is_ecommerce', isEcommerce);
      if (stage) params.append('stage', stage);
      if (adPlatform) params.append('ad_platform', adPlatform);
    }

    const token = localStorage.getItem('leadfinder_token');
    const exportUrl = `/api/export/csv?${params.toString()}`;
    
    fetch(exportUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include'
    })
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads_export_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast('CSV export downloaded successfully', 'success');
      })
      .catch(() => {
        toast('Failed to download CSV export', 'error');
      });
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col lg:flex-row">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title="Leads Database" />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 animate-fade-in">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-100 flex items-center space-x-2 tracking-tight">
                <Users className="w-6 h-6 text-blue-400" />
                <span>Verified Leads Directory</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Filter, inspect, export, and manage CRM pipeline stages for scanned target websites.
              </p>
            </div>

            {/* Quick Actions & Export */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/pipeline"
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-300 text-xs font-bold transition-all shadow-sm"
              >
                <KanbanSquare className="w-4 h-4 text-blue-400" />
                <span>CRM Pipeline</span>
              </Link>

              {selectedIds.size > 0 && (
                <>
                  <button
                    onClick={() => handleExportCsv('selected')}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/25"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Selected ({selectedIds.size})</span>
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-bold transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>Delete Selected</span>
                  </button>
                </>
              )}

              <div className="relative group">
                <button className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-dark-900 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold transition-all">
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>Export</span>
                </button>
                <div className="absolute right-0 mt-1.5 w-44 bg-dark-900 border border-white/10 rounded-xl shadow-2xl py-1 hidden group-hover:block z-30 animate-fade-in">
                  <button
                    onClick={() => handleExportCsv('filtered')}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white"
                  >
                    Export Current Filter
                  </button>
                  <button
                    onClick={() => handleExportCsv('all')}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white"
                  >
                    Export Entire Database
                  </button>
                </div>
              </div>

              {leads.length > 0 && (
                <button
                  onClick={handleClearAllLeads}
                  className="inline-flex items-center space-x-1 px-3 py-2 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-slate-400 hover:text-red-400 text-xs transition-all"
                  title="Clear all leads from database"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear All</span>
                </button>
              )}
            </div>
          </div>

          {/* Search, Sort, and Filter Toolbar */}
          <div className="glass-card rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 group">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Instant filter by company name, domain, or email..."
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-950/80 border border-white/10 focus:border-blue-500/70 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 outline-none transition-all shadow-inner"
                />
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-dark-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-blue-500/50"
                >
                  <option value="score_desc">Highest Lead Score</option>
                  <option value="score_asc">Lowest Lead Score</option>
                  <option value="date_desc">Newest Scanned</option>
                  <option value="date_asc">Oldest Scanned</option>
                </select>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    showFilters 
                      ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                      : 'bg-dark-950 text-slate-300 border-white/10 hover:bg-white/5'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Filters {(stage || adPlatform) ? '• Active' : ''}</span>
                </button>
              </div>
            </div>

            {/* Collapsible Filter Panel */}
            {showFilters && (
              <div className="pt-3 border-t border-white/5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3 text-xs animate-slide-up">
                <div>
                  <label className="block text-slate-400 mb-1">CRM Stage</label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                    className="w-full bg-dark-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none"
                  >
                    <option value="">All Stages</option>
                    <option value="new">New Discovered</option>
                    <option value="contacted">Outreach Sent</option>
                    <option value="meeting">Meeting Booked</option>
                    <option value="proposal">Proposal Sent</option>
                    <option value="won">Closed Won</option>
                    <option value="lost">Lost / Archive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Ad Platform</label>
                  <select
                    value={adPlatform}
                    onChange={(e) => setAdPlatform(e.target.value)}
                    className="w-full bg-dark-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none"
                  >
                    <option value="">All Platforms</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="Meta Ads">Meta Ads</option>
                    <option value="TikTok Ads">TikTok Ads</option>
                    <option value="LinkedIn Ads">LinkedIn Ads</option>
                    <option value="Microsoft Ads">Microsoft Ads</option>
                    <option value="Twitter / X Ads">Twitter / X Ads</option>
                    <option value="Pinterest Ads">Pinterest Ads</option>
                    <option value="Taboola">Taboola</option>
                    <option value="Outbrain">Outbrain</option>
                    <option value="Criteo">Criteo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Qualification</label>
                  <select
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    className="w-full bg-dark-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none"
                  >
                    <option value="">All Categories</option>
                    <option value="High Opportunity">High Opportunity (80+)</option>
                    <option value="Medium Opportunity">Medium (60-79)</option>
                    <option value="Low Opportunity">Low (40-59)</option>
                    <option value="Unqualified">Unqualified</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Industry</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full bg-dark-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none"
                  >
                    <option value="">All Industries</option>
                    <option value="E-commerce">E-commerce</option>
                    <option value="SaaS">SaaS</option>
                    <option value="Dental">Dental</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Legal">Legal</option>
                    <option value="Real Estate">Real Estate</option>
                    <option value="Marketing Agency">Marketing Agency</option>
                    <option value="Restaurant">Restaurant</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">CMS Platform</label>
                  <select
                    value={cms}
                    onChange={(e) => setCms(e.target.value)}
                    className="w-full bg-dark-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none"
                  >
                    <option value="">All CMS</option>
                    <option value="WordPress">WordPress</option>
                    <option value="Shopify">Shopify</option>
                    <option value="Webflow">Webflow</option>
                    <option value="Wix">Wix</option>
                    <option value="Squarespace">Squarespace</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">E-Commerce</label>
                  <select
                    value={isEcommerce}
                    onChange={(e) => setIsEcommerce(e.target.value)}
                    className="w-full bg-dark-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none"
                  >
                    <option value="">Any</option>
                    <option value="Detected">Detected</option>
                    <option value="Not detected">Not detected</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">GA4</label>
                  <select
                    value={hasGa4}
                    onChange={(e) => setHasGa4(e.target.value)}
                    className="w-full bg-dark-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none"
                  >
                    <option value="">Any</option>
                    <option value="true">Detected</option>
                    <option value="false">Not detected</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Meta Pixel</label>
                  <select
                    value={hasMeta}
                    onChange={(e) => setHasMeta(e.target.value)}
                    className="w-full bg-dark-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none"
                  >
                    <option value="">Any</option>
                    <option value="true">Detected</option>
                    <option value="false">Not detected</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Leads Data Table */}
          <div className="glass-card rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-dark-950/90 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-10">
                      <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-200">
                        {selectedIds.size > 0 && selectedIds.size === leads.length ? (
                          <CheckSquare className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3.5 px-4">Company & Domain</th>
                    <th className="py-3.5 px-4">Stage</th>
                    <th className="py-3.5 px-4">Industry / Location</th>
                    <th className="py-3.5 px-4">Direct Contacts</th>
                    <th className="py-3.5 px-4">Stack & Active Ads</th>
                    <th className="py-3.5 px-4">Score & Rating</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-500">
                        <div className="flex items-center justify-center space-x-2">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-400"></span>
                          </span>
                          <span>Loading prospecting database...</span>
                        </div>
                      </td>
                    </tr>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-20 text-center text-slate-500">
                        <Users className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                        <p className="font-semibold text-slate-300">No matching leads found</p>
                        <p className="text-[11px] text-slate-500 mt-1">Adjust search parameters or launch a new scan from the dashboard.</p>
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => {
                      const isSelected = selectedIds.has(lead.id);
                      const email = lead.contacts?.find(c => c.contact_type === 'email');
                      const phone = lead.contacts?.find(c => c.contact_type === 'phone');
                      const currentStageKey = lead.pipeline_stage || 'new';
                      const stageInfo = STAGE_CONFIG[currentStageKey] || STAGE_CONFIG['new'];

                      return (
                        <tr 
                          key={lead.id} 
                          className={`hover:bg-white/[0.03] transition-colors cursor-pointer group ${
                            isSelected ? 'bg-blue-500/10' : ''
                          }`}
                          onClick={() => setInspectLead(lead)}
                        >
                          <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => toggleSelectLead(lead.id)} className="text-slate-400 hover:text-slate-200">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-400" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>

                          <td className="py-3.5 px-4 space-y-0.5">
                            <div className="font-bold text-slate-100 group-hover:text-blue-300 transition-colors flex items-center space-x-1.5">
                              <span>{lead.company_name || lead.domain}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center space-x-1">
                              <span>{lead.domain}</span>
                              <a
                                href={lead.website_url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-slate-400 hover:text-blue-400 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </td>

                          {/* Pipeline Stage Column */}
                          <td className="py-3.5 px-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${stageInfo.badge}`}>
                              {stageInfo.label}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 space-y-0.5">
                            <div className="text-slate-200 font-medium">{lead.industry || 'Unknown'}</div>
                            <div className="text-[11px] text-slate-400">{lead.country || 'Unknown'} {lead.city ? `• ${lead.city}` : ''}</div>
                          </td>

                          <td className="py-3.5 px-4 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                            {email ? (
                              <div 
                                onClick={(e) => handleCopy(email.value, 'Email', e)}
                                className="group/btn inline-flex items-center space-x-1.5 px-2 py-1 rounded-md bg-dark-950/80 border border-white/5 hover:border-blue-500/30 text-slate-300 hover:text-blue-300 transition-all cursor-pointer"
                                title="Click to copy email"
                              >
                                <Mail className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                <span className="font-mono text-[11px] truncate max-w-[130px]">{email.value}</span>
                                {copiedId === email.value ? (
                                  <Check className="w-3 h-3 text-blue-400 ml-1" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-500 group-hover/btn:text-blue-400 ml-1" />
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-600 text-[11px] block">No email</span>
                            )}
                            {phone && (
                              <div 
                                onClick={(e) => handleCopy(phone.value, 'Phone', e)}
                                className="group/btn inline-flex items-center space-x-1.5 px-2 py-1 rounded-md bg-dark-950/80 border border-white/5 hover:border-blue-500/30 text-slate-300 hover:text-blue-300 transition-all cursor-pointer"
                                title="Click to copy phone"
                              >
                                <Phone className="w-3 h-3 text-purple-400 flex-shrink-0" />
                                <span className="font-mono text-[11px]">{phone.value}</span>
                                {copiedId === phone.value ? (
                                  <Check className="w-3 h-3 text-blue-400 ml-1" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-500 group-hover/btn:text-blue-400 ml-1" />
                                )}
                              </div>
                            )}
                          </td>

                          {/* Tech & Active Ads */}
                          <td className="py-3.5 px-4 space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {/* Active Ad Networks */}
                              {lead.ad_platforms?.map((ad, idx) => (
                                <span 
                                  key={`ad-${idx}`} 
                                  className="bg-blue-500/15 border border-blue-500/30 text-blue-200 px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center space-x-1"
                                  title={`Active Advertising: ${ad}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                  <span>{ad}</span>
                                </span>
                              ))}

                              {/* Tech Stack */}
                              {lead.cms && lead.cms !== 'Unknown' && (
                                <span className="bg-white/5 border border-white/5 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                  {lead.cms}
                                </span>
                              )}
                              {lead.is_ecommerce === 'Detected' && (
                                <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                  Store
                                </span>
                              )}
                              {lead.technologies?.some(t => t.name === 'Google Analytics 4') && (
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded text-[10px]">
                                  GA4
                                </span>
                              )}
                              {lead.technologies?.some(t => t.name === 'Google Tag Manager') && (
                                <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded text-[10px]">
                                  GTM
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-2">
                              <ScoreBreakdown lead={lead} size="sm" />
                              <span className="text-[11px] text-slate-400 font-medium">{lead.qualification}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setInspectLead(lead)}
                              className="p-1.5 text-slate-400 hover:text-blue-300 rounded-lg hover:bg-white/5 transition-colors"
                              title="Quick Inspect & Notes"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleRescanLead(lead.id, e)}
                              className="p-1.5 text-slate-400 hover:text-cyan-300 rounded-lg hover:bg-white/5 transition-colors"
                              title="Rescan Website"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteLead(lead.id, e)}
                              className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
                              title="Delete Lead"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Slide-over Quick Inspector */}
      <LeadQuickDrawer
        lead={inspectLead}
        isOpen={Boolean(inspectLead)}
        onClose={() => setInspectLead(null)}
        onDelete={(id) => handleDeleteLead(id)}
        onRescan={(id) => handleRescanLead(id)}
        onLeadUpdated={(updatedLead) => {
          setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
          setInspectLead(updatedLead);
        }}
      />
    </div>
  );
}
