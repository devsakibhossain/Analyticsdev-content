'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { 
  Download, 
  FileSpreadsheet, 
  Sparkles, 
  Filter, 
  CheckCircle2, 
  ShoppingCart, 
  Target,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export default function ExportsPage() {
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const downloadCsv = async (presetName: string, queryParams: string = '') => {
    setIsExporting(presetName);
    const token = localStorage.getItem('leadfinder_token');
    const exportUrl = `/api/export/csv${queryParams ? '?' + queryParams : ''}`;

    try {
      const response = await fetch(exportUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leadfinder_${presetName}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('CSV export downloaded successfully', 'success');
    } catch (err: any) {
      toast(err.message || 'Export error', 'error');
    } finally {
      setIsExporting(null);
    }
  };

  const presets = [
    {
      id: 'all_leads',
      title: 'Full Master Lead Database',
      description: 'Export every lead with all contacts, socials, CMS, pixels, score reasons, and opportunity audits.',
      icon: FileSpreadsheet,
      query: '',
      color: 'text-blue-400'
    },
    {
      id: 'high_opportunity',
      title: 'High Opportunity Leads (Score 80–100)',
      description: 'Pre-qualified leads with active ad spend (Meta/Google Ads), multiple technologies, and verified contacts.',
      icon: Target,
      query: 'qualification=High%20Opportunity',
      color: 'text-cyan-400'
    },
    {
      id: 'ecommerce_stores',
      title: 'E-Commerce Stores Only',
      description: 'All online stores (Shopify, WooCommerce, Magento) with detected products and cart systems.',
      icon: ShoppingCart,
      query: 'is_ecommerce=Detected',
      color: 'text-rose-400'
    },
    {
      id: 'ga4_no_gtm',
      title: 'Direct GA4 (Tag Management Audit Targets)',
      description: 'Websites running Google Analytics 4 directly without Google Tag Manager.',
      icon: Layers,
      query: 'has_ga4=true&has_gtm=false',
      color: 'text-amber-400'
    },
  ];

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col lg:flex-row">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title="Data Exports Center" />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 flex items-center space-x-2.5">
                <div className="p-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Download className="w-5 h-5" />
                </div>
                <span>Export Lead Data (CSV)</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 font-mono">
                One-click tailored export presets for immediate client outreach and cold outreach pipelines
              </p>
            </div>
          </div>

          {/* Export Preset Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {presets.map((p) => {
              const Icon = p.icon;
              const isLoading = isExporting === p.id;

              return (
                <div 
                  key={p.id}
                  className="glass-card glass-card-hover rounded-2xl p-6 flex flex-col justify-between space-y-5 transition-all shadow-xl"
                >
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3.5">
                      <div className="p-2.5 rounded-xl bg-dark-950 border border-white/5 shadow-inner">
                        <Icon className={`w-5 h-5 ${p.color}`} />
                      </div>
                      <h3 className="font-bold text-slate-100 text-sm sm:text-base">{p.title}</h3>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed pl-1">
                      {p.description}
                    </p>
                  </div>

                  <button
                    onClick={() => downloadCsv(p.id, p.query)}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-white/5 hover:bg-blue-600 hover:text-white text-slate-200 font-bold text-xs border border-white/10 hover:border-blue-500 transition-all cursor-pointer shadow-md group"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400 group-hover:text-white transition-colors" />
                    <span>{isLoading ? 'Generating CSV...' : 'Download CSV Dataset'}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Custom Selective Export Notice */}
          <div className="p-5 rounded-2xl glass-card border border-white/5 flex items-start space-x-3.5 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-200 block mb-0.5">Need customized filters or specific lead selection?</span>
              Visit the <Link href="/leads" className="text-blue-400 hover:underline font-semibold">Leads Database page</Link> to search, apply arbitrary filters, select checkboxes, and click "Export Selected".
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
