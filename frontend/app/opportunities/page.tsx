'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { 
  Target, 
  ArrowUpRight, 
  Sparkles, 
  ExternalLink,
  Layers,
  ShieldAlert,
  BarChart2,
  ShoppingCart,
  Send
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface OpportunityGroup {
  opportunity_type: string;
  title: string;
  description: string;
  total_count: number;
  leads: {
    lead_id: number;
    company_name: string;
    domain: string;
    lead_score: number;
    qualification: string;
    evidence: string;
    source_url: string;
  }[];
}

export default function OpportunitiesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [groups, setGroups] = useState<OpportunityGroup[]>([]);
  const [totalAffected, setTotalAffected] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi<{ opportunities: OpportunityGroup[]; total_leads_affected: number }>('/opportunities')
      .then((data) => {
        setGroups(data.opportunities || []);
        setTotalAffected(data.total_leads_affected || 0);
      })
      .catch((err) => console.error('Failed to load opportunities', err))
      .finally(() => setLoading(false));
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'ga4_audit': return <Layers className="w-5 h-5 text-amber-400" />;
      case 'meta_audit': return <ShieldAlert className="w-5 h-5 text-cyan-400" />;
      case 'gads_audit': return <BarChart2 className="w-5 h-5 text-blue-400" />;
      case 'ecommerce_audit': return <ShoppingCart className="w-5 h-5 text-rose-400" />;
      case 'lead_audit': return <Send className="w-5 h-5 text-purple-400" />;
      default: return <Target className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col lg:flex-row">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title="Tracking Audit Intelligence" />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 flex items-center space-x-2.5">
                <div className="p-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Target className="w-5 h-5" />
                </div>
                <span>Tracking & Analytics Audit Angles</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 font-mono">
                High-converting pitch opportunities across {totalAffected} qualified businesses
              </p>
            </div>
          </div>

          {/* Grouped Opportunities Grid */}
          {loading ? (
            <div className="p-16 text-center text-xs text-slate-500 glass-card rounded-2xl">
              <div className="flex items-center justify-center space-x-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-400"></span>
                </span>
                <span>Synthesizing audit intelligence...</span>
              </div>
            </div>
          ) : groups.length === 0 ? (
            <div className="p-20 text-center text-slate-500 glass-card rounded-2xl">
              <Target className="w-10 h-10 mx-auto mb-2 text-slate-600" />
              <p className="font-bold text-slate-200">No opportunities detected yet</p>
              <p className="text-xs text-slate-500 mt-1">Run scans on websites from the dashboard to discover actionable tracking audit angles.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((grp) => (
                <div key={grp.opportunity_type} className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3.5">
                      <div className="p-2.5 rounded-xl bg-dark-950 border border-white/5 shadow-inner">
                        {getIcon(grp.opportunity_type)}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-100">{grp.title}</h3>
                        <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">{grp.description}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm">
                      {grp.total_count} Leads
                    </span>
                  </div>

                  {/* Leads list under this opportunity */}
                  {grp.leads.length === 0 ? (
                    <div className="p-4 bg-dark-950/60 rounded-xl text-xs text-slate-500 border border-white/5">
                      No leads currently exhibit this specific audit opportunity.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                      {grp.leads.map((l) => (
                        <Link
                          key={l.lead_id}
                          href={`/leads/${l.lead_id}`}
                          className="p-3.5 bg-dark-950/70 hover:bg-dark-950 rounded-xl border border-white/5 hover:border-blue-500/30 text-xs space-y-2 transition-all group block shadow-sm hover:-translate-y-0.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-200 group-hover:text-blue-300 transition-colors truncate">
                              {l.company_name}
                            </span>
                            <span className="font-mono text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                              {l.lead_score} pts
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate font-mono">
                            {l.domain}
                          </div>
                          {l.evidence && (
                            <div className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 pt-1.5 border-t border-white/5">
                              {l.evidence}
                            </div>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
