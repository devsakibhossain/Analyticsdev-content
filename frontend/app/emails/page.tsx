'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { 
  Mail, 
  Send, 
  CheckCircle2, 
  Clock, 
  Search, 
  ExternalLink, 
  RotateCw, 
  Layers, 
  Server, 
  Inbox, 
  HardDrive,
  Copy,
  Check,
  Eye,
  Flame,
  AlertCircle,
  CornerDownLeft,
  Filter,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { LeadEmail, MailboxStatus, IncomingEmailMessage, EmailMessageDetail, FunnelStats } from '@/types';
import { useToast } from '@/components/ui/Toast';
import EmailComposerModal from '@/components/emails/EmailComposerModal';
import EmailReaderModal from '@/components/emails/EmailReaderModal';
import OutreachPipelineBoard from '@/components/emails/OutreachPipelineBoard';

type ActiveTab = 'inbox' | 'sent' | 'funnel';

export default function EmailsPage() {
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('inbox');
  
  // Data State
  const [mailboxStatus, setMailboxStatus] = useState<MailboxStatus | null>(null);
  const [sentEmails, setSentEmails] = useState<LeadEmail[]>([]);
  const [inboxMessages, setInboxMessages] = useState<IncomingEmailMessage[]>([]);
  const [funnelStats, setFunnelStats] = useState<FunnelStats | null>(null);
  
  // Loading states
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Composer Modal State
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerRecipient, setComposerRecipient] = useState('');
  const [composerSubject, setComposerSubject] = useState('');
  const [composerBody, setComposerBody] = useState('');
  const [composerInReplyTo, setComposerInReplyTo] = useState<string | undefined>(undefined);
  const [composerInReplyToUid, setComposerInReplyToUid] = useState<number | undefined>(undefined);
  const [composerInReplyToFolder, setComposerInReplyToFolder] = useState<string | undefined>(undefined);
  const [composerLeadId, setComposerLeadId] = useState<number | undefined>(undefined);
  const [composerTitle, setComposerTitle] = useState('Compose Outreach Email');

  // Reader Modal State
  const [readerOpen, setReaderOpen] = useState(false);
  const [readingSentEmail, setReadingSentEmail] = useState<LeadEmail | null>(null);
  const [readingInboxDetail, setReadingInboxDetail] = useState<EmailMessageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Mailbox Status Card Toggle (Default Hidden)
  const [showMailStatus, setShowMailStatus] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowMailStatus(localStorage.getItem('leadfinder_show_mail_status') === 'true');
    }
    loadMailboxStatus();
  }, []);

  useEffect(() => {
    if (activeTab === 'inbox') {
      loadInbox();
    } else if (activeTab === 'sent') {
      loadSentEmails();
    } else if (activeTab === 'funnel') {
      loadFunnelStats();
    }
  }, [activeTab, search, statusFilter]);

  const loadMailboxStatus = async () => {
    setLoadingStatus(true);
    try {
      const data = await fetchApi<MailboxStatus>('/emails/mailbox-status');
      setMailboxStatus(data);
    } catch {
      setMailboxStatus({ connected: false, error: 'Could not connect to Hostinger API' });
    } finally {
      setLoadingStatus(false);
    }
  };

  const loadInbox = async () => {
    setLoadingData(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      params.append('limit', '50');

      const res = await fetchApi<{ messages: IncomingEmailMessage[] }>(`/emails/inbox?${params.toString()}`);
      setInboxMessages(res.messages || []);
    } catch (err) {
      console.error('Failed to load inbox messages', err);
      toast('Failed to fetch inbox messages', 'error');
    } finally {
      setLoadingData(false);
    }
  };

  const loadSentEmails = async () => {
    setLoadingData(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (statusFilter) params.append('status', statusFilter);
      params.append('limit', '100');

      const data = await fetchApi<LeadEmail[]>(`/emails/history?${params.toString()}`);
      setSentEmails(data || []);
    } catch (err) {
      console.error('Failed to load sent emails', err);
    } finally {
      setLoadingData(false);
    }
  };

  const loadFunnelStats = async () => {
    setLoadingData(true);
    try {
      const data = await fetchApi<FunnelStats>('/emails/funnel-stats');
      setFunnelStats(data);
    } catch (err) {
      console.error('Failed to load funnel stats', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleOpenInboxMessage = async (msg: IncomingEmailMessage) => {
    setLoadingDetail(true);
    try {
      const detail = await fetchApi<EmailMessageDetail>(`/emails/inbox/${msg.uid}`);
      setReadingInboxDetail(detail);
      setReadingSentEmail(null);
      setReaderOpen(true);
    } catch (err: any) {
      toast(err.message || 'Failed to load email message', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleOpenSentEmail = (email: LeadEmail) => {
    setReadingSentEmail(email);
    setReadingInboxDetail(null);
    setReaderOpen(true);
  };

  const handleReplyFromReader = (replyData: {
    recipient: string;
    subject: string;
    body_text: string;
    in_reply_to?: string;
    in_reply_to_uid?: number;
    in_reply_to_folder?: string;
    lead_id?: number;
  }) => {
    setComposerRecipient(replyData.recipient);
    setComposerSubject(replyData.subject);
    setComposerBody(replyData.body_text);
    setComposerInReplyTo(replyData.in_reply_to);
    setComposerInReplyToUid(replyData.in_reply_to_uid);
    setComposerInReplyToFolder(replyData.in_reply_to_folder || 'INBOX');
    setComposerLeadId(replyData.lead_id);
    setComposerTitle(
      replyData.in_reply_to_uid 
        ? `Reply to ${replyData.recipient}` 
        : (replyData.subject.toLowerCase().startsWith('follow-up') 
            ? `Send Follow-Up to ${replyData.recipient}` 
            : `Compose Email to ${replyData.recipient}`)
    );
    setComposerOpen(true);
  };

  const handleOpenBlankComposer = () => {
    setComposerRecipient('');
    setComposerSubject('');
    setComposerBody('');
    setComposerInReplyTo(undefined);
    setComposerInReplyToUid(undefined);
    setComposerInReplyToFolder(undefined);
    setComposerLeadId(undefined);
    setComposerTitle('Compose Email / Cold Outreach');
    setComposerOpen(true);
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col lg:flex-row">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title="Email Outreach & Communication Hub" />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 animate-fade-in">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-100 flex items-center space-x-2.5 tracking-tight">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Mail className="w-6 h-6" />
                </div>
                <span>Cold Outreach & Mail Hub</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                2-way inbox, real-time read/seen tracking, custom emailing, and smart cold outreach funnel
              </p>
            </div>

            <div className="flex items-center space-x-2.5">
              {/* Smart Server & Quota Diagnostics Toggle */}
              <button
                onClick={() => {
                  const next = !showMailStatus;
                  setShowMailStatus(next);
                  localStorage.setItem('leadfinder_show_mail_status', String(next));
                }}
                className={`inline-flex items-center space-x-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                  showMailStatus
                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 shadow-sm'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                }`}
                title="Toggle Hostinger Mail Server & Storage Diagnostics"
              >
                <Server className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Mail Server & Quota</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {showMailStatus ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => {
                  loadMailboxStatus();
                  if (activeTab === 'inbox') loadInbox();
                  if (activeTab === 'sent') loadSentEmails();
                  if (activeTab === 'funnel') loadFunnelStats();
                }}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer"
                title="Refresh mailbox data"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                onClick={handleOpenBlankComposer}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/25 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Compose Email</span>
              </button>
            </div>
          </div>

          {/* Mailbox Status & Storage KPI Bar (Smartly Collapsible) */}
          {showMailStatus && (
            <div className="glass-card rounded-2xl p-5 border border-white/10 bg-dark-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-slide-up relative">
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                  <Server className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-200">Hostinger Agentic Mail API</span>
                    {mailboxStatus?.connected ? (
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Connected & Active</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
                        Disconnected
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono flex flex-wrap items-center gap-2">
                    <span>Sender: <strong className="text-blue-300">{mailboxStatus?.address || 'hello@sakibhossain.io'}</strong></span>
                    <span>•</span>
                    <span>Mailbox ID: <strong className="text-slate-300">{mailboxStatus?.mailbox_resource_id || 'AC587f34...'}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-white/5">
                <div className="px-3.5 py-2 rounded-xl bg-dark-950/70 border border-white/5 text-center min-w-[90px]">
                  <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-center space-x-1">
                    <Inbox className="w-3 h-3 text-cyan-400" />
                    <span>Inbox</span>
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-100 mt-0.5">
                    {mailboxStatus?.inbox_messages ?? 6}
                  </div>
                </div>

                <div className="px-3.5 py-2 rounded-xl bg-dark-950/70 border border-white/5 text-center min-w-[90px]">
                  <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-center space-x-1">
                    <Send className="w-3 h-3 text-blue-400" />
                    <span>Sent</span>
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-100 mt-0.5">
                    {mailboxStatus?.sent_messages ?? 3}
                  </div>
                </div>

                <div className="px-3.5 py-2 rounded-xl bg-dark-950/70 border border-white/5 text-center min-w-[110px]">
                  <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-center space-x-1">
                    <HardDrive className="w-3 h-3 text-indigo-400" />
                    <span>Storage</span>
                  </div>
                  <div className="text-sm font-mono font-bold text-slate-100 mt-0.5">
                    {Math.round((mailboxStatus?.storage_usage_kb || 513) / 1024)}MB / 20GB
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowMailStatus(false);
                    localStorage.setItem('leadfinder_show_mail_status', 'false');
                  }}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Hide server info"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-2 border-b border-white/10 pb-2">
            <button
              onClick={() => { setActiveTab('inbox'); setSearch(''); setStatusFilter(''); }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'inbox'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span>Incoming Inbox</span>
              {mailboxStatus?.inbox_messages ? (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/20 text-white">
                  {mailboxStatus.inbox_messages}
                </span>
              ) : null}
            </button>

            <button
              onClick={() => { setActiveTab('sent'); setSearch(''); setStatusFilter(''); }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'sent'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Sent Outreach (Seen Tracking)</span>
              {sentEmails.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/20 text-white">
                  {sentEmails.length}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('funnel'); setSearch(''); setStatusFilter(''); }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'funnel'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Outreach Pipeline & Kanban</span>
              <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-500/20 px-1.5 py-0.5 rounded-full border border-cyan-500/30">
                Outreach Board
              </span>
            </button>
          </div>

          {/* TAB 1: INCOMING INBOX */}
          {activeTab === 'inbox' && (
            <div className="space-y-4 animate-fade-in">
              {/* Search Bar */}
              <div className="glass-card rounded-2xl p-3 flex items-center space-x-3">
                <Search className="w-4 h-4 text-slate-500 ml-2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search incoming messages by subject or sender email..."
                  className="bg-transparent text-xs sm:text-sm text-slate-200 placeholder-slate-500 outline-none w-full"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-xs text-slate-400 hover:text-slate-200 px-2">
                    Clear
                  </button>
                )}
              </div>

              {/* Messages List Table */}
              <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
                {loadingData ? (
                  <div className="p-16 text-center text-slate-400 text-xs">
                    Loading incoming messages from Hostinger Mail API...
                  </div>
                ) : inboxMessages.length === 0 ? (
                  <div className="p-16 text-center space-y-3">
                    <Inbox className="w-10 h-10 text-slate-600 mx-auto" />
                    <p className="text-sm font-bold text-slate-300">No incoming messages found</p>
                    <p className="text-xs text-slate-500">Emails sent to hello@sakibhossain.io will appear here instantly.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {inboxMessages.map((msg) => (
                      <div
                        key={msg.uid}
                        onClick={() => handleOpenInboxMessage(msg)}
                        className="p-4 sm:px-6 hover:bg-white/[0.03] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-200 text-xs sm:text-sm group-hover:text-blue-300 transition-colors truncate">
                              {msg.from_name || msg.from_address}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 truncate">
                              &lt;{msg.from_address}&gt;
                            </span>
                            {msg.unseen && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-slate-300 truncate">
                            {msg.subject || '(No Subject)'}
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 flex-shrink-0">
                          <span className="text-[11px] font-mono text-slate-400">
                            {msg.date ? new Date(msg.date).toLocaleDateString() : ''}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenInboxMessage(msg);
                            }}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-blue-600 hover:text-white text-slate-300 text-xs font-semibold border border-white/10 transition-colors"
                          >
                            <CornerDownLeft className="w-3 h-3" />
                            <span>Read & Reply</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SENT OUTREACH WITH OPEN/SEEN TRACKING */}
          {activeTab === 'sent' && (
            <div className="space-y-4 animate-fade-in">
              {/* Search & Status Filters */}
              <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search sent outreach by recipient or subject..."
                    className="w-full pl-10 pr-4 py-2 bg-dark-950/80 border border-white/10 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 outline-none"
                  />
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-dark-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none cursor-pointer w-full sm:w-auto"
                  >
                    <option value="">All Statuses</option>
                    <option value="opened">🔥 Seen / Opened</option>
                    <option value="sent">✉️ Sent (Unopened)</option>
                    <option value="failed">❌ Failed</option>
                  </select>
                </div>
              </div>

              {/* Sent Emails Table */}
              <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
                {loadingData ? (
                  <div className="p-16 text-center text-slate-400 text-xs">
                    Loading sent outreach history...
                  </div>
                ) : sentEmails.length === 0 ? (
                  <div className="p-16 text-center space-y-3">
                    <Mail className="w-10 h-10 text-slate-600 mx-auto" />
                    <p className="text-sm font-bold text-slate-300">No sent emails recorded yet</p>
                    <p className="text-xs text-slate-500">
                      Click &ldquo;Compose Email&rdquo; or use the 1-click email button on any lead to send your first pitch!
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-[10px] uppercase text-slate-400 font-mono bg-dark-950/40">
                          <th className="py-3 px-4">Recipient</th>
                          <th className="py-3 px-4">Subject</th>
                          <th className="py-3 px-4">Associated Lead</th>
                          <th className="py-3 px-4">Sent Date</th>
                          <th className="py-3 px-4">Seen / Read Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {sentEmails.map((em) => {
                          const hasOpened = (em.open_count || 0) > 0 || Boolean(em.opened_at);
                          const isHot = (em.open_count || 0) >= 2;

                          return (
                            <tr 
                              key={em.id} 
                              onClick={() => handleOpenSentEmail(em)}
                              className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                            >
                              <td className="py-3.5 px-4 font-mono font-medium text-slate-200">
                                {em.recipient_email}
                              </td>

                              <td className="py-3.5 px-4 max-w-xs truncate text-slate-300 font-semibold group-hover:text-blue-300 transition-colors">
                                {em.subject}
                              </td>

                              <td className="py-3.5 px-4">
                                {em.lead_domain ? (
                                  <Link
                                    href={`/leads/${em.lead_id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center space-x-1 text-blue-400 hover:text-blue-300 font-mono text-[11px]"
                                  >
                                    <span>{em.lead_domain}</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </Link>
                                ) : (
                                  <span className="text-slate-500 font-mono text-[11px]">Direct Custom</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                                {new Date(em.sent_at).toLocaleDateString()}
                              </td>

                              <td className="py-3.5 px-4">
                                {hasOpened ? (
                                  <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
                                    isHot 
                                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' 
                                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  }`}>
                                    {isHot ? <Flame className="w-3 h-3 text-amber-400" /> : <Eye className="w-3 h-3 text-emerald-400" />}
                                    <span>Opened {em.open_count}x</span>
                                  </span>
                                ) : em.status === 'failed' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/15 text-red-300 border border-red-500/30">
                                    Failed
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                    Unopened
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <div className="inline-flex items-center space-x-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenSentEmail(em);
                                    }}
                                    className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 font-semibold transition-colors"
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const cleanSub = (em.subject || '').replace(/^(Follow-up:\s*|Re:\s*)+/gi, '').trim();
                                      const quotedHistory = em.body_text 
                                        ? `\n\n--- On ${em.sent_at ? new Date(em.sent_at).toLocaleString() : 'earlier'}, you sent to ${em.recipient_email} ---\n> ${em.body_text.replaceAll('\n', '\n> ')}`
                                        : '';
                                      setComposerRecipient(em.recipient_email);
                                      setComposerSubject(`Follow-up: ${cleanSub || 'Quick touch base'}`);
                                      setComposerBody(`Hi,\n\nFollowing up on my previous message below. Would love to hear your thoughts when you have a moment.\n${quotedHistory}`);
                                      setComposerInReplyTo(undefined);
                                      setComposerInReplyToUid(undefined);
                                      setComposerInReplyToFolder(undefined);
                                      setComposerLeadId(em.lead_id);
                                      setComposerTitle(`Send Follow-Up to ${em.recipient_email}`);
                                      setComposerOpen(true);
                                    }}
                                    className="inline-flex items-center space-x-1 text-xs text-blue-300 hover:text-white px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-600 border border-blue-500/20 font-semibold transition-all shadow-sm"
                                    title="Send follow-up to this recipient"
                                  >
                                    <Send className="w-3 h-3" />
                                    <span>Follow-Up</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SMART OUTREACH PIPELINE & KANBAN BOARD */}
          {activeTab === 'funnel' && (
            <OutreachPipelineBoard
              onOpenComposerWithFollowUp={(data) => {
                setComposerRecipient(data.recipient);
                setComposerSubject(data.subject);
                setComposerBody(data.body_text);
                setComposerLeadId(data.lead_id);
                setComposerInReplyTo(undefined);
                setComposerInReplyToUid(undefined);
                setComposerInReplyToFolder(undefined);
                setComposerTitle(`Send Follow-Up to ${data.recipient}`);
                setComposerOpen(true);
              }}
              onOpenBlankComposer={handleOpenBlankComposer}
            />
          )}
        </main>
      </div>

      {/* Email Composer Modal (Custom, Outreach, or Reply) */}
      <EmailComposerModal
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        initialRecipient={composerRecipient}
        initialSubject={composerSubject}
        initialBody={composerBody}
        initialLeadId={composerLeadId}
        inReplyTo={composerInReplyTo}
        inReplyToUid={composerInReplyToUid}
        inReplyToFolder={composerInReplyToFolder}
        modalTitle={composerTitle}
        onEmailSent={(sentEmail) => {
          setSentEmails(prev => [sentEmail, ...prev]);
          if (activeTab === 'sent') loadSentEmails();
          if (activeTab === 'funnel') loadFunnelStats();
        }}
      />

      {/* Email Reader & Reply Modal */}
      <EmailReaderModal
        isOpen={readerOpen}
        onClose={() => {
          setReaderOpen(false);
          setReadingSentEmail(null);
          setReadingInboxDetail(null);
        }}
        incomingDetail={readingInboxDetail}
        sentEmail={readingSentEmail}
        onReplyClick={handleReplyFromReader}
      />
    </div>
  );
}
