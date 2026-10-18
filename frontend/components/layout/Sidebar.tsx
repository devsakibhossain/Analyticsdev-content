'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Radar, 
  Target, 
  Download, 
  Settings, 
  Sparkles,
  X,
  Activity,
  KanbanSquare,
  Mail,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [showNodeInfo, setShowNodeInfo] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowNodeInfo(localStorage.getItem('leadfinder_show_node_info') === 'true');
    }
  }, []);

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/leads', label: 'Leads Database', icon: Users },
    { href: '/pipeline', label: 'CRM Pipeline', icon: KanbanSquare },
    { href: '/emails', label: 'Email Outreach', icon: Mail },
    { href: '/scans', label: 'Scanner Queue', icon: Radar },
    { href: '/opportunities', label: 'Tracking Audits', icon: Target },
    { href: '/exports', label: 'Export Data', icon: Download },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md lg:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-dark-900/95 backdrop-blur-2xl border-r border-white/5 transition-transform duration-300 ease-in-out flex flex-col shadow-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center space-x-3 group">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 border border-blue-500/30 p-[1px] bg-dark-950 flex-shrink-0 group-hover:scale-105 transition-all">
              <img src="/logo-icon.png" alt="CRM Ultra Logo" className="w-full h-full object-cover rounded-[10px]" />
            </div>
            <div>
              <span className="font-bold text-slate-100 text-sm tracking-tight text-gradient-brand">CRM Ultra</span>
              <span className="block text-[10px] font-mono text-blue-400/90 font-medium">Sales & Outreach Engine</span>
            </div>
          </Link>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg lg:hidden transition-colors"
            aria-label="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`relative flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600/20 via-blue-500/10 to-transparent text-blue-300 border border-blue-500/30 shadow-sm shadow-blue-500/10 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-500 rounded-r-full shadow-sm shadow-blue-500" />
                )}
                <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Footer info & System Node (Smartly Collapsible) */}
        <div className="p-3 border-t border-white/5">
          {showNodeInfo ? (
            <div className="p-3 rounded-xl bg-dark-950/80 border border-white/5 text-[11px] text-slate-400 space-y-1.5 animate-slide-up">
              <div className="flex justify-between items-center text-slate-300">
                <span className="flex items-center space-x-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400"></span>
                  </span>
                  <span className="text-slate-300 font-medium">Cluster Node</span>
                </span>
                <button
                  onClick={() => {
                    setShowNodeInfo(false);
                    localStorage.setItem('leadfinder_show_node_info', 'false');
                  }}
                  className="text-slate-500 hover:text-slate-300 p-0.5 rounded hover:bg-white/5 transition-colors"
                  title="Hide details"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">Hostinger KVM • 2.25.228.102</div>
            </div>
          ) : (
            <button
              onClick={() => {
                setShowNodeInfo(true);
                localStorage.setItem('leadfinder_show_node_info', 'true');
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors text-[10px] font-mono group cursor-pointer"
              title="Click to view Cluster Node details"
            >
              <span className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 group-hover:scale-125 transition-transform"></span>
                <span>Node 2.25.228.102</span>
              </span>
              <ChevronUp className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
