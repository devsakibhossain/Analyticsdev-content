'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  KanbanSquare, 
  Search, 
  Filter, 
  ArrowRight, 
  ExternalLink, 
  Mail, 
  Phone, 
  MessageSquare, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RotateCw, 
  Target, 
  Eye,
  Megaphone,
  Briefcase,
  Send
} from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import ScoreBreakdown from '@/components/leads/ScoreBreakdown';
import LeadQuickDrawer from '@/components/leads/LeadQuickDrawer';
import EmailComposerModal from '@/components/emails/EmailComposerModal';
import { useToast } from '@/components/ui/Toast';
import { fetchApi } from '@/lib/api';
import { Lead, PipelineStage, LeadEmail } from '@/types';

interface StageColumn {
  id: PipelineStage;
  title: string;
  icon: any;
  color: string;
  badgeBg: string;
  borderColor: string;
}

const STAGES: StageColumn[] = [
  { 
    id: 'new', 
    title: 'New Discovered', 
    icon: Sparkles, 
    color: 'text-blue-400', 
    badgeBg: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    borderColor: 'border-blue-500/20'
  },
  { 
    id: 'contacted', 
    title: 'Outreach Sent', 
    icon: Mail, 
    color: 'text-cyan-400', 
    badgeBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    borderColor: 'border-cyan-500/20'
  },
  { 
    id: 'meeting', 
    title: 'Meeting Booked', 
    icon: Clock, 
    color: 'text-indigo-400', 
    badgeBg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    borderColor: 'border-indigo-500/20'
  },
  { 
    id: 'proposal', 
    title: 'Proposal Sent', 
    icon: Briefcase, 
    color: 'text-amber-400', 
    badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    borderColor: 'border-amber-500/20'
  },
  { 
    id: 'won', 
    title: 'Closed Won', 
    icon: CheckCircle2, 
    color: 'text-emerald-400', 
    badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    borderColor: 'border-emerald-500/20'
  },
  { 
    id: 'lost', 
    title: 'Lost / Archive', 
    icon: XCircle, 
    color: 'text-slate-400', 
    badgeBg: 'bg-slate-800 text-slate-400 border-slate-700',
    borderColor: 'border-slate-800'
  },
];

export default function PipelinePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adFilter, setAdFilter] = useState('');
  const [inspectLead, setInspectLead] = useState<Lead | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedLeadForEmail, setSelectedLeadForEmail] = useState<Lead | null>(null);
  const [composerRecipient, setComposerRecipient] = useState('');
  const { toast } = useToast();

  const loadLeads = async () => {
    try {
      setLoading(true);
      const data = await fetchApi<Lead[]>('/leads?limit=200');
      setLeads(data || []);
    } catch (err: any) {
      toast(err.message || 'Failed to load pipeline leads', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const handleStageChange = async (leadId: number, newStage: PipelineStage) => {
    // Optimistic UI update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, pipeline_stage: newStage } : l));
    if (inspectLead && inspectLead.id === leadId) {
      setInspectLead({ ...inspectLead, pipeline_stage: newStage });
    }

    try {
      await fetchApi<Lead>(`/leads/${leadId}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: newStage })
      });
      const stageName = STAGES.find(s => s.id === newStage)?.title || newStage;
      toast(`Moved to ${stageName}`, 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to update pipeline stage', 'error');
      loadLeads(); // Rollback
    }
  };

  // Filter leads by search & ad network
  const filteredLeads = leads.filter(lead => {
    const query = search.toLowerCase().trim();
    const matchSearch = !query || 
      (lead.company_name && lead.company_name.toLowerCase().includes(query)) ||
      lead.domain.toLowerCase().includes(query) ||
      (lead.website_title && lead.website_title.toLowerCase().includes(query));

    const matchAd = !adFilter || 
      (lead.ad_platforms && lead.ad_platforms.some(ad => ad.toLowerCase().includes(adFilter.toLowerCase()))) ||
      (lead.technologies && lead.technologies.some(t => t.name.toLowerCase().includes(adFilter.toLowerCase()) && t.status === 'Detected'));

    return matchSearch && matchAd;
  });

  // Calculate counts per stage
  const stageCounts = STAGES.reduce((acc, stage) => {
    acc[stage.id] = filteredLeads.filter(l => (l.pipeline_stage || 'new') === stage.id).length;
    return acc;
  }, {} as Record<PipelineStage, number>);

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col lg:flex-row">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title="CRM Outreach Pipeline" />

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6 animate-fade-in">
          {/* Header & Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 flex items-center space-x-2.5">
                <div className="p-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <KanbanSquare className="w-5 h-5" />
                </div>
                <span>Outreach CRM & Deal Pipeline</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 font-mono">
                Track pitch progression, outreach notes, and active advertising campaigns
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={loadLeads}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10 transition-all"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Refresh Pipeline</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {STAGES.map((s) => {
              const Icon = s.icon;
              const count = stageCounts[s.id] || 0;
              return (
                <div 
                  key={s.id} 
                  className={`glass-card rounded-2xl p-4 border transition-all ${s.borderColor}`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                    <span className="font-semibold truncate">{s.title}</span>
                    <Icon className={`w-3.5 h-3.5 ${s.color}`} />
                  </div>
                  <div className="text-xl font-mono font-extrabold text-slate-100">
                    {count}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Search & Ad Platform Filters */}
          <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pipeline leads by company or domain..."
                className="w-full pl-10 pr-4 py-2 bg-dark-950/80 border border-white/10 focus:border-blue-500/70 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 outline-none transition-all shadow-inner"
              />
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative flex items-center">
                <Megaphone className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                <select
                  value={adFilter}
                  onChange={(e) => setAdFilter(e.target.value)}
                  className="bg-dark-950 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-300 outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                >
                  <option value="">All Ad Platforms</option>
                  <option value="Google Ads">Running Google Ads</option>
                  <option value="Meta Pixel">Running Meta / FB Ads</option>
                  <option value="TikTok Pixel">Running TikTok Ads</option>
                  <option value="LinkedIn Insight Tag">Running LinkedIn Ads</option>
                  <option value="Microsoft Ads">Running Microsoft Ads</option>
                  <option value="Twitter / X Ads">Running Twitter / X Ads</option>
                  <option value="Pinterest Tag">Running Pinterest Ads</option>
                  <option value="Criteo">Running Criteo Retargeting</option>
                  <option value="Taboola">Running Taboola</option>
                  <option value="Outbrain">Running Outbrain</option>
                </select>
              </div>

              {(search || adFilter) && (
                <button
                  onClick={() => { setSearch(''); setAdFilter(''); }}
                  className="px-3 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Kanban Columns Board */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start overflow-x-auto pb-4">
            {STAGES.map((col) => {
              const Icon = col.icon;
              const columnLeads = filteredLeads.filter(
                (l) => (l.pipeline_stage || 'new') === col.id
              );

              return (
                <div 
                  key={col.id} 
                  className="glass-card rounded-2xl p-3 sm:p-3.5 space-y-3 flex flex-col min-w-[250px] bg-dark-900/60 border-white/5"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <div className="flex items-center space-x-2">
                      <Icon className={`w-4 h-4 ${col.color}`} />
                      <span className="font-bold text-slate-200 text-xs">{col.title}</span>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${col.badgeBg}`}>
                      {columnLeads.length}
                    </span>
                  </div>

                  {/* Cards inside column */}
                  <div className="space-y-3 min-h-[300px]">
                    {loading ? (
                      <div className="py-12 text-center text-slate-500 text-xs">
                        Loading...
                      </div>
                    ) : columnLeads.length === 0 ? (
                      <div className="py-12 text-center text-slate-600 text-xs border border-dashed border-white/5 rounded-xl">
                        No leads in this stage
                      </div>
                    ) : (
                      columnLeads.map((lead) => {
                        const email = lead.contacts?.find(c => c.contact_type === 'email');
                        const phone = lead.contacts?.find(c => c.contact_type === 'phone');
                        const adCount = (lead.ad_platforms?.length || 0) + (lead.technologies?.filter(t => t.category === 'advertising' || t.category === 'pixel').length || 0);

                        return (
                          <div
                            key={lead.id}
                            className="p-3.5 rounded-xl bg-dark-950/80 hover:bg-dark-950 border border-white/5 hover:border-blue-500/40 transition-all space-y-3 shadow-md group cursor-pointer"
                            onClick={() => setInspectLead(lead)}
                          >
                            {/* Card Top: Score & Domain */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <h4 className="font-bold text-slate-100 text-xs truncate group-hover:text-blue-300 transition-colors">
                                  {lead.company_name || lead.domain}
                                </h4>
                                <div className="text-[10px] text-slate-400 font-mono truncate flex items-center space-x-1">
                                  <span>{lead.domain}</span>
                                  <a 
                                    href={lead.website_url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    onClick={(e) => e.stopPropagation()} 
                                    className="text-slate-500 hover:text-blue-400"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                              </div>
                              <ScoreBreakdown lead={lead} size="sm" />
                            </div>

                            {/* Active Ad Platforms Highlight */}
                            {lead.ad_platforms && lead.ad_platforms.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {lead.ad_platforms.slice(0, 3).map((ad, idx) => (
                                  <span 
                                    key={idx}
                                    className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-semibold"
                                  >
                                    {ad.replace(' Tag', '').replace(' Pixel', '')}
                                  </span>
                                ))}
                                {lead.ad_platforms.length > 3 && (
                                  <span className="text-[9px] font-mono px-1 rounded bg-white/5 text-slate-400">
                                    +{lead.ad_platforms.length - 3}
                                  </span>
                                )}
                              </div>
                            ) : null}

                            {/* Direct Contacts & Notes Summary */}
                            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5">
                              <div className="flex items-center space-x-2">
                                {email && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedLeadForEmail(lead);
                                      setComposerRecipient(email.value);
                                      setComposerOpen(true);
                                    }}
                                    className="p-1 rounded hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors flex items-center space-x-1"
                                    title={`Send outreach email to ${email.value}`}
                                  >
                                    <Mail className="w-3 h-3" />
                                    <Send className="w-2.5 h-2.5 opacity-80" />
                                  </button>
                                )}
                                {phone && <span title={phone.value}><Phone className="w-3 h-3 text-purple-400" /></span>}
                                {lead.opportunities && lead.opportunities.length > 0 && (
                                  <span className="text-[10px] text-amber-400 font-mono">
                                    {lead.opportunities.length} gaps
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center space-x-1.5">
                                <span className="flex items-center space-x-0.5 text-[10px] text-slate-400">
                                  <MessageSquare className="w-2.5 h-2.5" />
                                  <span>{lead.notes?.length || 0}</span>
                                </span>
                              </div>
                            </div>

                            {/* Stage Selector Dropdown */}
                            <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={lead.pipeline_stage || 'new'}
                                onChange={(e) => handleStageChange(lead.id, e.target.value as PipelineStage)}
                                className="w-full bg-dark-900 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-slate-300 outline-none focus:border-blue-500 cursor-pointer"
                              >
                                {STAGES.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    Move: {s.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Slide-over Inspection & Notes Drawer */}
      <LeadQuickDrawer
        lead={inspectLead}
        onClose={() => setInspectLead(null)}
        onLeadUpdated={(updatedLead) => {
          setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
          setInspectLead(updatedLead);
        }}
      />

      {/* Direct Outreach Email Composer */}
      {selectedLeadForEmail && (
        <EmailComposerModal
          isOpen={composerOpen}
          onClose={() => {
            setComposerOpen(false);
            setSelectedLeadForEmail(null);
          }}
          initialLead={selectedLeadForEmail}
          initialRecipient={composerRecipient}
          onEmailSent={(sentEmail) => {
            // Update pipeline stage to contacted and add to emails
            setLeads(prev => prev.map(l => {
              if (l.id === selectedLeadForEmail.id) {
                return {
                  ...l,
                  pipeline_stage: 'contacted',
                  emails: [sentEmail, ...(l.emails || [])]
                };
              }
              return l;
            }));
            if (inspectLead && inspectLead.id === selectedLeadForEmail.id) {
              setInspectLead({
                ...inspectLead,
                pipeline_stage: 'contacted',
                emails: [sentEmail, ...(inspectLead.emails || [])]
              });
            }
          }}
        />
      )}
    </div>
  );
}
