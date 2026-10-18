'use client';

import React, { useState } from 'react';
import { Target, Layers, Radio, Sparkles, Phone } from 'lucide-react';
import { Lead } from '@/types';

interface ScoreBreakdownProps {
  lead: Lead;
  size?: 'sm' | 'md' | 'lg';
}

export default function ScoreBreakdown({ lead, size = 'sm' }: ScoreBreakdownProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Compute estimated breakdown points based on backend deterministic scoring rules
  // Tech stack (max 25)
  let techPoints = 0;
  if (lead.cms && lead.cms !== 'Unknown') techPoints += 10;
  if (lead.is_ecommerce === 'Detected') techPoints += 15;
  else if (techPoints < 25) techPoints += 5;
  techPoints = Math.min(25, techPoints);

  // Tracking maturity (max 25)
  let trackingPoints = 0;
  const hasGtm = lead.technologies?.some(t => t.name === 'Google Tag Manager');
  const hasGa4 = lead.technologies?.some(t => t.name === 'Google Analytics 4');
  const hasMeta = lead.technologies?.some(t => t.name === 'Meta Pixel');
  if (hasGtm) trackingPoints += 10;
  if (hasGa4) trackingPoints += 8;
  if (hasMeta) trackingPoints += 7;
  trackingPoints = Math.min(25, trackingPoints);

  // Gaps & Opportunities (max 30)
  const oppCount = lead.opportunities?.length || 0;
  const oppPoints = Math.min(30, oppCount * 10);

  // Contacts (max 20)
  const hasEmail = lead.contacts?.some(c => c.contact_type === 'email');
  const hasPhone = lead.contacts?.some(c => c.contact_type === 'phone');
  const hasSocial = lead.socials?.length || 0;
  let contactPoints = 0;
  if (hasEmail) contactPoints += 10;
  if (hasPhone) contactPoints += 7;
  if (hasSocial > 0) contactPoints += 3;
  contactPoints = Math.min(20, contactPoints);

  const score = lead.lead_score ?? 0;
  const isHigh = score >= 80;
  const isMed = score >= 60 && score < 80;

  return (
    <div 
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div 
        className={`inline-flex items-center space-x-1.5 rounded-full font-mono font-bold transition-all cursor-pointer ${
          size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
        } ${
          isHigh
            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/35 hover:border-blue-500/60 shadow-sm shadow-blue-500/25'
            : isMed
            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:border-amber-500/60 shadow-sm shadow-amber-500/20'
            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
        }`}
      >
        <span className="relative flex h-2 w-2">
          {isHigh && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${
            isHigh ? 'bg-blue-400' : isMed ? 'bg-amber-400' : 'bg-slate-500'
          }`}></span>
        </span>
        <span>{score}</span>
      </div>

      {/* Interactive Tooltip Popover */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-700 shadow-2xl z-50 text-[11px] text-slate-300 animate-scale-in pointer-events-none">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="font-semibold text-slate-200">Score Breakdown</span>
            <span className="font-mono text-blue-400 font-bold">{score}/100</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1 text-slate-400">
                <Layers className="w-3 h-3 text-cyan-400" />
                <span>Tech Stack</span>
              </span>
              <span className="font-mono">{techPoints}/25</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1 text-slate-400">
                <Radio className="w-3 h-3 text-blue-400" />
                <span>Tracking Maturity</span>
              </span>
              <span className="font-mono">{trackingPoints}/25</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1 text-slate-400">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Gaps & Opportunities</span>
              </span>
              <span className="font-mono">{oppPoints}/30</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1 text-slate-400">
                <Phone className="w-3 h-3 text-purple-400" />
                <span>Contact Richness</span>
              </span>
              <span className="font-mono">{contactPoints}/20</span>
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 italic">
            Deterministic formula • 0 AI estimation
          </div>
        </div>
      )}
    </div>
  );
}
