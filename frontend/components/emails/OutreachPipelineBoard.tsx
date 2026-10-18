'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  KanbanSquare, 
  Search, 
  Filter, 
  Send, 
  Eye, 
  Flame, 
  Clock, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  CornerDownLeft, 
  TrendingUp, 
  ExternalLink, 
  Plus, 
  RotateCw,
  PhoneCall,
  Sparkles,
  ArrowRight,
  ChevronDown,
  Layers,
  LayoutGrid,
  List
} from 'lucide-react';
import { OutreachCard, OutreachBoardResponse, OutreachStage } from '@/types';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import BookCallModal from '@/components/emails/BookCallModal';
import OutreachNotesModal from '@/components/emails/OutreachNotesModal';

interface OutreachPipelineBoardProps {
  onOpenComposerWithFollowUp: (data: {
    recipient: string;
    subject: string;
    body_text: string;
    lead_id?: number;
  }) => void;
  onOpenBlankComposer: () => void;
}

interface ColumnConfig {
  id: OutreachStage;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  headerBg: string;
  borderCol: string;
}

const OUTREACH_COLUMNS: ColumnConfig[] = [
  {
    id: 'pitch_sent',
    title: 'Pitch Sent',
    subtitle: 'Initial pitch sent',
    icon: Send,
    color: 'text-blue-400',
    headerBg: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    borderCol: 'border-blue-500/20'
  },
  {
    id: 'seen',
    title: 'Seen & Engaged',
    subtitle: 'Email opened by prospect',
    icon: Eye,
    color: 'text-emerald-400',
    headerBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    borderCol: 'border-emerald-500/20'
  },
  {
    id: 'followup_1',
    title: 'Follow-Up #1',
    subtitle: '1st follow-up delivered',
    icon: RotateCw,
    color: 'text-amber-400',
    headerBg: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    borderCol: 'border-amber-500/20'
  },
  {
    id: 'followup_2',
    title: 'Follow-Up #2+',
    subtitle: '2nd/3rd follow-up sent',
    icon: RotateCw,
    color: 'text-orange-400',
    headerBg: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
    borderCol: 'border-orange-500/20'
  },
  {
    id: 'replied',
    title: 'In Discussion',
    subtitle: 'Prospect replied / negotiating',
    icon: CornerDownLeft,
    color: 'text-cyan-400',
    headerBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    borderCol: 'border-cyan-500/20'
  },
  {
    id: 'meeting',
    title: 'Call Booked',
    subtitle: 'Discovery / audit call scheduled',
    icon: Calendar,
    color: 'text-indigo-400',
    headerBg: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
    borderCol: 'border-indigo-500/20'
  },
  {
    id: 'won',
    title: 'Closed Won',
    subtitle: 'Client converted & paid',
    icon: CheckCircle2,
    color: 'text-green-400',
    headerBg: 'bg-green-500/10 text-green-300 border-green-500/20',
    borderCol: 'border-green-500/20'
  }
];

export default function OutreachPipelineBoard({
  onOpenComposerWithFollowUp,
  onOpenBlankComposer
}: OutreachPipelineBoardProps) {
  const { toast } = useToast();
  const [boardData, setBoardData] = useState<OutreachBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Views
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'hot' | 'needs_followup' | 'booked' | 'won'>('all');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  // Modals state
  const [bookCallCard, setBookCallCard] = useState<OutreachCard | null>(null);
  const [notesCard, setNotesCard] = useState<OutreachCard | null>(null);

  useEffect(() => {
    loadBoard();
  }, []);

  const loadBoard = async () => {
    setLoading(true);
    try {
      const data = await fetchApi<OutreachBoardResponse>('/emails/outreach-board');
      setBoardData(data);
    } catch (err: any) {
      toast(err.message || 'Failed to load outreach pipeline board', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = async (card: OutreachCard, newStage: OutreachStage) => {
    try {
      await fetchApi('/emails/outreach-stage', {
        method: 'PATCH',
        body: JSON.stringify({
          lead_id: card.lead_id,
          recipient_email: card.recipient_email,
          stage: newStage
        })
      });
      toast(`Stage updated to ${newStage.replace('_', ' ')}`, 'info');
      // Update local state immediately
      setBoardData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: prev.cards.map(c => c.id === card.id ? { ...c, stage: newStage } : c)
        };
      });
    } catch (err: any) {
      toast(err.message || 'Failed to update stage', 'error');
    }
  };

  const handleTriggerFollowUp = (card: OutreachCard) => {
    const nextFollowUpNum = (card.followup_count || 0) + 1;
    const cleanSub = (card.last_subject || '')
      .replace(/^(Follow-up(\s*#\d+)?:?\s*|Re:\s*)+/gi, '')
      .trim();

    const followUpSubject = `Follow-up #${nextFollowUpNum}: ${cleanSub || 'Quick touch base'}`;

    const promptText = card.is_hot 
      ? `Hi,\n\nI noticed you were reviewing our previous note regarding your analytics setup on ${card.domain}.\n\nWould you be open to a quick 5-minute video walkthrough where I demonstrate the exact tracking fixes?\n\nBest,\nSakib`
      : `Hi,\n\nFollowing up on my previous note regarding tracking and attribution improvements on ${card.domain}.\n\nDid you get a chance to review this?\n\nBest,\nSakib`;

    const quotedHistory = card.emails_history?.length > 0
      ? `\n\n--- Previous Message (${new Date(card.last_sent_at).toLocaleDateString()}) ---\n> Subject: ${card.last_subject}`
      : '';

    onOpenComposerWithFollowUp({
      recipient: card.recipient_email,
      subject: followUpSubject,
      body_text: `${promptText}${quotedHistory}`,
      lead_id: card.lead_id
    });
  };

  // Filter Cards
  const filteredCards = (boardData?.cards || []).filter(c => {
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchEmail = c.recipient_email.toLowerCase().includes(q);
      const matchDomain = c.domain.toLowerCase().includes(q);
      const matchCompany = c.company_name.toLowerCase().includes(q);
      if (!matchEmail && !matchDomain && !matchCompany) return false;
    }

    // Filter Chips
    if (activeFilter === 'hot') {
      return c.open_count >= 2;
    }
    if (activeFilter === 'needs_followup') {
      return (c.open_count > 0 && c.followup_count === 0) || (c.stage === 'pitch_sent' && c.followup_count === 0);
    }
    if (activeFilter === 'booked') {
      return c.stage === 'meeting';
    }
    if (activeFilter === 'won') {
      return c.stage === 'won';
    }

    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Outreach KPI Command Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="glass-card rounded-2xl p-4 border border-blue-500/20 bg-dark-900/60">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Pitched Accounts</span>
            <Send className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 font-mono mt-1">
            {boardData?.total_leads_pitched ?? 0}
          </div>
          <div className="text-[10px] text-blue-400 mt-0.5">Audited Contacts</div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-emerald-500/20 bg-dark-900/60">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Seen / Opened</span>
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
            {boardData?.opened_leads_count ?? 0}
          </div>
          <div className="text-[10px] text-emerald-300 font-mono mt-0.5">
            {boardData?.open_rate_percent ?? 0}% Open Rate
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-amber-500/20 bg-dark-900/60">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Follow-Ups Sent</span>
            <RotateCw className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">
            {boardData?.total_followups_sent ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Across Outreach</div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-indigo-500/20 bg-dark-900/60">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Calls Booked</span>
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-300 font-mono mt-1">
            {boardData?.calls_booked_count ?? 0}
          </div>
          <div className="text-[10px] text-indigo-400 mt-0.5">Meetings Scheduled</div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-cyan-500/20 bg-dark-900/60">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Total Emails</span>
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 font-mono mt-1">
            {boardData?.total_emails_sent ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Pitches + Follow-ups</div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-green-500/20 bg-dark-900/60">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Closed Won</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
          </div>
          <div className="text-2xl font-black text-green-400 font-mono mt-1">
            {boardData?.won_deals_count ?? 0}
          </div>
          <div className="text-[10px] text-green-300 mt-0.5">Converted Deals</div>
        </div>
      </div>

      {/* Control Bar: Search, Filters, View Modes */}
      <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search outreach contacts by domain, email or company..."
            className="w-full pl-10 pr-4 py-2 bg-dark-950/80 border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500"
          />
        </div>

        {/* Quick Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              activeFilter === 'all'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white/5 hover:bg-white/10 text-slate-400'
            }`}
          >
            All ({boardData?.cards?.length || 0})
          </button>
          <button
            onClick={() => setActiveFilter('hot')}
            className={`px-3 py-1.5 rounded-xl font-semibold flex items-center space-x-1 transition-all ${
              activeFilter === 'hot'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                : 'bg-white/5 hover:bg-white/10 text-amber-300'
            }`}
          >
            <Flame className="w-3 h-3" />
            <span>Hot / Seen 2x+</span>
          </button>
          <button
            onClick={() => setActiveFilter('needs_followup')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              activeFilter === 'needs_followup'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-white/5 hover:bg-white/10 text-indigo-300'
            }`}
          >
            ⚡ Needs Follow-Up
          </button>
          <button
            onClick={() => setActiveFilter('booked')}
            className={`px-3 py-1.5 rounded-xl font-semibold flex items-center space-x-1 transition-all ${
              activeFilter === 'booked'
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                : 'bg-white/5 hover:bg-white/10 text-indigo-300'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>Calls Booked</span>
          </button>
          <button
            onClick={() => setActiveFilter('won')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
              activeFilter === 'won'
                ? 'bg-green-600 text-white shadow-md shadow-green-500/20'
                : 'bg-white/5 hover:bg-white/10 text-green-400'
            }`}
          >
            🏆 Won
          </button>
        </div>

        {/* View Switcher & Refresh */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center p-1 rounded-xl bg-dark-950 border border-white/10">
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'board' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Kanban Board View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Compact Table List"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={loadBoard}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
            title="Refresh Board"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenBlankComposer}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Pitch</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-20 text-center text-slate-400 text-xs">
          Loading cold outreach pipeline board...
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center space-y-3">
          <Send className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-slate-200">No outreach cards match this filter</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Click &ldquo;New Pitch&rdquo; or dispatch cold emails to prospects to populate your outreach pipeline.
          </p>
          <button
            onClick={onOpenBlankComposer}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send First Pitch</span>
          </button>
        </div>
      ) : viewMode === 'board' ? (
        /* KANBAN BOARD VIEW */
        <div className="overflow-x-auto pb-6">
          <div className="flex gap-4 min-w-[1300px]">
            {OUTREACH_COLUMNS.map((col) => {
              const colCards = filteredCards.filter(c => c.stage === col.id);
              const ColIcon = col.icon;

              return (
                <div 
                  key={col.id}
                  className="w-80 flex-shrink-0 flex flex-col rounded-2xl bg-dark-900/60 border border-white/5 overflow-hidden"
                >
                  {/* Column Header */}
                  <div className={`p-3.5 border-b border-white/5 flex items-center justify-between ${col.headerBg}`}>
                    <div className="flex items-center space-x-2">
                      <ColIcon className={`w-4 h-4 ${col.color}`} />
                      <div>
                        <h4 className="font-bold text-xs text-slate-100">{col.title}</h4>
                        <p className="text-[10px] text-slate-400">{col.subtitle}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-dark-950/70 border border-white/10 text-slate-200">
                      {colCards.length}
                    </span>
                  </div>

                  {/* Cards Area */}
                  <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[75vh]">
                    {colCards.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-white/5 rounded-xl text-[11px] text-slate-500">
                        No cards in this stage
                      </div>
                    ) : (
                      colCards.map((card) => (
                        <div
                          key={card.id}
                          className="group relative p-4 rounded-xl bg-dark-950/90 border border-white/10 hover:border-blue-500/50 transition-all shadow-lg shadow-black/20 space-y-3"
                        >
                          {/* Card Top: Domain/Company & Open Badge */}
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-xs text-slate-100 truncate group-hover:text-blue-300 transition-colors flex items-center space-x-1.5">
                                  <span>{card.company_name || card.domain}</span>
                                  {card.lead_id && (
                                    <Link 
                                      href={`/leads/${card.lead_id}`}
                                      className="text-slate-500 hover:text-blue-400"
                                      title="Open Lead Profile"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </Link>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-slate-400 truncate">
                                  {card.recipient_email}
                                </div>
                              </div>

                              {/* Open Tracking Indicator */}
                              {card.open_count > 0 ? (
                                <span className={`flex-shrink-0 inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                                  card.is_hot 
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' 
                                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                }`}>
                                  {card.is_hot ? <Flame className="w-3 h-3 text-amber-400" /> : <Eye className="w-3 h-3 text-emerald-400" />}
                                  <span>{card.open_count}x</span>
                                </span>
                              ) : (
                                <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-500 bg-white/5 border border-white/5">
                                  Sent
                                </span>
                              )}
                            </div>

                            {/* Follow-Up Tracker Pill */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/20">
                                {card.followup_count === 0 ? 'Pitch Sent' : `Follow-up #${card.followup_count}`}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                {card.total_emails_sent} sent
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono ml-auto">
                                {new Date(card.last_sent_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {/* Subject Snippet */}
                          <div className="text-[11px] text-slate-300 font-medium truncate bg-dark-900/60 px-2.5 py-1.5 rounded-lg border border-white/5">
                            &ldquo;{card.last_subject}&rdquo;
                          </div>

                          {/* Meeting Scheduled Banner (if applicable) */}
                          {card.meeting_info && (
                            <div className="p-2.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-[11px] text-indigo-200 space-y-1">
                              <div className="flex items-center space-x-1.5 font-bold text-indigo-300">
                                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                                <span>{card.meeting_info.type || 'Discovery Call'}</span>
                              </div>
                              {card.meeting_info.date && (
                                <div className="font-mono text-[10px] text-indigo-200">
                                  📅 {card.meeting_info.date}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Latest Note Snippet */}
                          {card.latest_note && (
                            <div className="text-[10px] text-slate-400 bg-white/[0.02] p-2 rounded-lg border border-white/5 line-clamp-2">
                              <span className="text-slate-500 font-semibold">Note: </span>
                              {card.latest_note}
                            </div>
                          )}

                          {/* Card Footer: Fast Actions */}
                          <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-1.5">
                              {/* 1-Click Send Follow-Up */}
                              <button
                                onClick={() => handleTriggerFollowUp(card)}
                                className="flex-1 inline-flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[11px] font-bold transition-all shadow-sm"
                                title="Send next follow-up email"
                              >
                                <Send className="w-3 h-3" />
                                <span>Follow-Up</span>
                              </button>

                              {/* Book Call */}
                              <button
                                onClick={() => setBookCallCard(card)}
                                className="inline-flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 hover:text-white border border-indigo-500/30 text-[11px] font-semibold transition-all"
                                title="Schedule discovery / audit call"
                              >
                                <Calendar className="w-3 h-3" />
                                <span>Book Call</span>
                              </button>

                              {/* Notes */}
                              <button
                                onClick={() => setNotesCard(card)}
                                className="inline-flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] font-semibold transition-all"
                                title="View & add notes"
                              >
                                <FileText className="w-3 h-3 text-slate-400" />
                                <span>{card.notes_count || 0}</span>
                              </button>
                            </div>

                            {/* Stage Switcher Dropdown */}
                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                              <span>Move stage:</span>
                              <select
                                value={card.stage}
                                onChange={(e) => handleStageChange(card, e.target.value as OutreachStage)}
                                className="bg-dark-950 border border-white/10 rounded-lg px-2 py-0.5 text-[10px] text-slate-300 outline-none cursor-pointer"
                              >
                                {OUTREACH_COLUMNS.map(c => (
                                  <option key={c.id} value={c.id}>{c.title}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* COMPACT LIST VIEW */
        <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase text-slate-400 font-mono bg-dark-950/40">
                  <th className="py-3 px-4">Prospect Account</th>
                  <th className="py-3 px-4">Outreach Stage</th>
                  <th className="py-3 px-4">Seen Tracking</th>
                  <th className="py-3 px-4">Follow-Up Count</th>
                  <th className="py-3 px-4">Last Pitch / Subject</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredCards.map((card) => (
                  <tr key={card.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-100 flex items-center space-x-1.5">
                          <span>{card.company_name || card.domain}</span>
                          {card.lead_id && (
                            <Link href={`/leads/${card.lead_id}`} className="text-slate-500 hover:text-blue-400">
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">{card.recipient_email}</div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <select
                        value={card.stage}
                        onChange={(e) => handleStageChange(card, e.target.value as OutreachStage)}
                        className="bg-dark-950 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-slate-200 outline-none cursor-pointer"
                      >
                        {OUTREACH_COLUMNS.map(c => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3.5 px-4">
                      {card.open_count > 0 ? (
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
                          card.is_hot 
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' 
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {card.is_hot ? <Flame className="w-3 h-3 text-amber-400" /> : <Eye className="w-3 h-3 text-emerald-400" />}
                          <span>{card.open_count} Opens</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-500 bg-white/5 border border-white/5">
                          Unopened
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/20 font-bold">
                        {card.followup_count === 0 ? '0 (Initial Pitch)' : `Follow-up #${card.followup_count}`}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs truncate text-slate-300">
                      {card.last_subject}
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => setNotesCard(card)}
                        className="inline-flex items-center space-x-1 text-slate-400 hover:text-blue-400 text-xs font-semibold"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{card.notes_count} Notes</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center space-x-1.5">
                        <button
                          onClick={() => handleTriggerFollowUp(card)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-sm"
                        >
                          <Send className="w-3 h-3" />
                          <span>Follow-Up</span>
                        </button>
                        <button
                          onClick={() => setBookCallCard(card)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold"
                        >
                          <Calendar className="w-3 h-3" />
                          <span>Call</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Book Call Modal */}
      {bookCallCard && (
        <BookCallModal
          isOpen={Boolean(bookCallCard)}
          onClose={() => setBookCallCard(null)}
          leadId={bookCallCard.lead_id}
          recipientEmail={bookCallCard.recipient_email}
          domain={bookCallCard.domain}
          companyName={bookCallCard.company_name}
          onCallBooked={() => {
            loadBoard();
          }}
        />
      )}

      {/* Notes Modal */}
      {notesCard && (
        <OutreachNotesModal
          isOpen={Boolean(notesCard)}
          onClose={() => setNotesCard(null)}
          card={notesCard}
          onNotesUpdated={() => {
            loadBoard();
          }}
        />
      )}
    </div>
  );
}
