'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { 
  ArrowLeft, 
  Globe, 
  ExternalLink, 
  RotateCw, 
  Trash2, 
  Mail, 
  Phone, 
  MessageCircle, 
  Building2, 
  MapPin, 
  Target, 
  Layers, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileCode,
  Share2,
  Copy,
  Check,
  Megaphone,
  FileText,
  Plus,
  KanbanSquare,
  Send
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { Lead, LeadNote, PipelineStage, LeadEmail } from '@/types';
import { useToast } from '@/components/ui/Toast';
import ScoreBreakdown from '@/components/leads/ScoreBreakdown';
import EmailComposerModal from '@/components/emails/EmailComposerModal';

const STAGES: { id: PipelineStage; label: string; badge: string }[] = [
  { id: 'new', label: 'New Discovered', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  { id: 'contacted', label: 'Outreach Sent', badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  { id: 'meeting', label: 'Meeting Booked', badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  { id: 'proposal', label: 'Proposal Sent', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { id: 'won', label: 'Closed Won', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  { id: 'lost', label: 'Lost / Archive', badge: 'bg-slate-800 text-slate-400 border-slate-700' },
];

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params?.id;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // CRM Pipeline & Notes State
  const [currentStage, setCurrentStage] = useState<PipelineStage>('new');
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);

  // Outreach Email State
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerRecipient, setComposerRecipient] = useState('');
  const [leadEmails, setLeadEmails] = useState<LeadEmail[]>([]);

  useEffect(() => {
    if (!id) return;
    loadLead();
  }, [id]);

  const loadLead = async () => {
    setLoading(true);
    try {
      const data = await fetchApi<Lead>(`/leads/${id}`);
      setLead(data);
      if (data) {
        setCurrentStage(data.pipeline_stage || 'new');
        setNotes(data.notes || []);
      }
      // Load outreach emails for this lead
      fetchApi<LeadEmail[]>(`/emails/lead/${id}`)
        .then(setLeadEmails)
        .catch(() => setLeadEmails([]));
    } catch (err: any) {
      setError(err.message || 'Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast(`${label} copied to clipboard!`, 'success');
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleStageChange = async (newStage: PipelineStage) => {
    if (!lead || newStage === currentStage) return;
    setUpdatingStage(true);
    try {
      await fetchApi<Lead>(`/leads/${lead.id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: newStage })
      });
      setCurrentStage(newStage);
      const stageObj = STAGES.find(s => s.id === newStage);
      toast(`Pipeline stage updated: ${stageObj?.label || newStage}`, 'success');
      setLead(prev => prev ? { ...prev, pipeline_stage: newStage } : prev);
    } catch (err: any) {
      toast(err.message || 'Failed to update stage', 'error');
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !newNote.trim()) return;
    setAddingNote(true);
    try {
      const created = await fetchApi<LeadNote>(`/leads/${lead.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: newNote.trim(), author: 'Sakib' })
      });
      setNotes(prev => [created, ...prev]);
      setNewNote('');
      toast('Note added to client timeline', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to add note', 'error');
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!lead) return;
    setDeletingNoteId(noteId);
    try {
      await fetchApi(`/leads/${lead.id}/notes/${noteId}`, {
        method: 'DELETE'
      });
      setNotes(prev => prev.filter(n => n.id !== noteId));
      toast('Note removed', 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to delete note', 'error');
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleRescan = async () => {
    if (!lead) return;
    try {
      const res = await fetchApi<{ scan_id: number }>(`/leads/${lead.id}/rescan`, { method: 'POST' });
      if (res && res.scan_id) {
        toast('Deep rescan queued successfully', 'success');
        router.push(`/scans?active=${res.scan_id}`);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to start rescan', 'error');
    }
  };

  const handleDelete = async () => {
    if (!lead || !confirm('Are you sure you want to delete this lead?')) return;
    try {
      await fetchApi(`/leads/${lead.id}`, { method: 'DELETE' });
      toast('Lead deleted', 'info');
      router.push('/leads');
    } catch (err: any) {
      toast(err.message || 'Failed to delete lead', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col lg:flex-row">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
          <Navbar onMenuClick={() => setSidebarOpen(true)} title="Lead Details" />
          <main className="p-16 text-center text-slate-500">
            <div className="flex items-center justify-center space-x-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-400"></span>
              </span>
              <span>Loading lead profile...</span>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col lg:flex-row">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
          <Navbar onMenuClick={() => setSidebarOpen(true)} title="Lead Details" />
          <main className="p-8 max-w-xl mx-auto text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <h3 className="text-lg font-bold text-slate-200">Lead Not Found</h3>
            <p className="text-xs text-slate-400">{error || 'This lead may have been deleted.'}</p>
            <Link href="/leads" className="inline-block px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-200 rounded-xl text-xs transition-colors">
              Return to Leads Database
            </Link>
          </main>
        </div>
      </div>
    );
  }

  const activeStage = STAGES.find(s => s.id === currentStage) || STAGES[0];

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col lg:flex-row">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title={lead.company_name || lead.domain} />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 animate-fade-in">
          {/* Back & Top Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <Link 
              href="/leads"
              className="inline-flex items-center space-x-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Leads Database</span>
            </Link>

            <div className="flex items-center space-x-2">
              <Link
                href="/pipeline"
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10 transition-all"
              >
                <KanbanSquare className="w-3.5 h-3.5 text-blue-400" />
                <span>Open CRM Pipeline</span>
              </Link>
              <button
                onClick={() => {
                  const primaryEmail = lead.contacts?.find(c => c.contact_type === 'email')?.value || '';
                  setComposerRecipient(primaryEmail);
                  setComposerOpen(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25 cursor-pointer"
                title="Send Cold Outreach Email"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Email</span>
              </button>
              <button
                onClick={handleRescan}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10 transition-all"
              >
                <RotateCw className="w-3.5 h-3.5 text-blue-400" />
                <span>Rescan Website</span>
              </button>
              <button
                onClick={handleDelete}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Lead</span>
              </button>
            </div>
          </div>

          {/* Lead Header Overview Card */}
          <div className="glass-card rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-3 relative z-10 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
                  {lead.company_name || lead.domain}
                </h1>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  lead.lead_score >= 80 
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : lead.lead_score >= 60
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-white/5 text-slate-400 border border-white/10'
                }`}>
                  {lead.qualification}
                </span>

                {/* Pipeline Stage Badge & Fast Selector */}
                <div className="inline-flex items-center space-x-2 bg-dark-950/80 px-3 py-1 rounded-xl border border-white/10">
                  <span className="text-[11px] text-slate-400 font-medium">Stage:</span>
                  <select
                    value={currentStage}
                    onChange={(e) => handleStageChange(e.target.value as PipelineStage)}
                    disabled={updatingStage}
                    className={`bg-transparent text-xs font-bold outline-none cursor-pointer ${activeStage.badge.split(' ')[1]}`}
                  >
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id} className="bg-dark-900 text-slate-200">
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <a 
                  href={lead.website_url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-blue-400 hover:text-blue-300 flex items-center space-x-1 font-mono transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{lead.website_url}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span>•</span>
                <span>{lead.industry || 'Unknown Industry'}</span>
                <span>•</span>
                <span>{lead.country || 'Unknown Location'}</span>
              </div>

              {lead.description && (
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed pt-1">
                  {lead.description}
                </p>
              )}
            </div>

            {/* Score Ring Display */}
            <div className="flex items-center space-x-5 bg-dark-950/80 p-5 rounded-2xl border border-white/5 self-start md:self-center relative z-10 shadow-inner">
              <div className="text-center">
                <div className="text-4xl font-extrabold text-gradient-brand font-mono">
                  {lead.lead_score}
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">Lead Score</div>
              </div>
              <div className="h-12 w-px bg-white/10" />
              <div className="text-xs text-slate-400 space-y-1">
                <div>Pages Scanned: <span className="font-mono text-slate-200 font-semibold">{lead.pages_crawled}</span></div>
                <div>Audit Gaps: <span className="font-mono text-blue-400 font-bold">{lead.opportunities?.length || 0}</span></div>
                <div className="pt-0.5"><ScoreBreakdown lead={lead} size="sm" /></div>
              </div>
            </div>
          </div>

          {/* Ad Platforms & CRM Notes Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Advertising Platforms Card */}
            <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <Megaphone className="w-4 h-4 text-blue-400" />
                  <span>Active Advertising Platforms ({lead.ad_platforms?.length || 0})</span>
                </h3>
                <span className="text-[11px] font-mono text-blue-300 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20 font-semibold">
                  Ads Intelligence
                </span>
              </div>

              {(!lead.ad_platforms || lead.ad_platforms.length === 0) ? (
                <div className="p-4 text-xs text-slate-500 bg-dark-950/60 rounded-xl border border-white/5 space-y-1">
                  <p className="font-medium text-slate-400">No active ad network pixels detected.</p>
                  <p className="text-[11px] text-slate-500">
                    This domain does not appear to be running paid campaigns on Google, Meta, TikTok, or LinkedIn.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {lead.ad_platforms.map((ad, idx) => (
                      <span
                        key={`ad-${idx}`}
                        className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-500/15 via-indigo-500/15 to-cyan-500/15 border border-blue-500/30 text-blue-200 shadow-sm"
                      >
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        <span>{ad}</span>
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed pt-1">
                    This business actively runs paid advertising campaigns. You can pitch them tracking audits, conversion API setups, or remarketing tag optimizations!
                  </p>
                </div>
              )}
            </div>

            {/* CRM Notes & Follow-up Timeline */}
            <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>CRM Notes & Activity Timeline ({notes.length})</span>
                </h3>
              </div>

              {/* Note Submission Form */}
              <form onSubmit={handleAddNote} className="space-y-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Record an outreach note, client call summary, or quote details..."
                  rows={2}
                  className="w-full bg-dark-950/90 border border-white/10 focus:border-blue-500/50 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 outline-none resize-none transition-colors"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={addingNote || !newNote.trim()}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-semibold transition-all shadow-md shadow-blue-500/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{addingNote ? 'Saving...' : 'Add Note'}</span>
                  </button>
                </div>
              </form>

              {/* Notes Timeline List */}
              {notes.length === 0 ? (
                <div className="p-3 text-xs text-slate-500 bg-dark-950/60 rounded-xl border border-white/5 text-center">
                  No notes recorded yet. Add your first note above.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3 rounded-xl bg-dark-950/70 border border-white/5 space-y-1.5 group relative"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-blue-400">{note.author || 'Sakib'}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(note.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            disabled={deletingNoteId === note.id}
                            className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                            title="Delete note"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Opportunities Section */}
          <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <Target className="w-4 h-4 text-blue-400" />
              <span>Tracking Opportunities & Audit Angles ({lead.opportunities?.length || 0})</span>
            </h3>

            {(!lead.opportunities || lead.opportunities.length === 0) ? (
              <div className="p-4 text-xs text-slate-500 bg-dark-950/60 rounded-xl border border-white/5">
                No immediate tracking anomalies detected on public pages.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lead.opportunities.map((opp) => (
                  <div key={opp.id} className="p-4 rounded-xl bg-dark-950/70 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100 text-xs sm:text-sm">
                        {opp.title}
                      </span>
                      <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 font-semibold">
                        {Math.round(opp.confidence * 100)}% Confidence
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {opp.reason}
                    </p>
                    {opp.evidence && (
                      <div className="text-[11px] font-mono text-slate-400 bg-dark-900 p-2.5 rounded-lg border border-white/5 truncate">
                        <span className="text-blue-400 font-semibold">Evidence: </span>{opp.evidence}
                      </div>
                    )}
                    {opp.source_url && (
                      <div className="text-[10px] text-slate-500 truncate font-mono">
                        Source: {opp.source_url}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Three-Column Grid: Contacts, Socials, Location */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Contacts Card */}
            <div className="glass-card rounded-2xl p-5 space-y-3.5">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Mail className="w-4 h-4 text-blue-400" />
                <span>Contact Channels</span>
              </h3>

              {(!lead.contacts || lead.contacts.length === 0) ? (
                <div className="text-xs text-slate-500">No public contacts found.</div>
              ) : (
                <div className="space-y-2">
                  {lead.contacts.map((c) => (
                    <div 
                      key={c.id} 
                      onClick={() => handleCopy(c.value, c.contact_type)}
                      className="group flex items-center justify-between p-2.5 rounded-xl bg-dark-950/70 hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/30 text-xs transition-all cursor-pointer"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        {c.contact_type === 'email' && <Mail className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                        {c.contact_type === 'phone' && <Phone className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                        {c.contact_type === 'whatsapp' && <MessageCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                        <span className="font-mono text-slate-200 truncate">{c.value}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 ml-2" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                          {c.category}
                        </span>
                        {c.contact_type === 'email' && (
                          <button
                            onClick={() => {
                              setComposerRecipient(c.value);
                              setComposerOpen(true);
                            }}
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-blue-300 hover:text-white text-[10px] font-semibold transition-all"
                            title="Compose email to this contact"
                          >
                            <Send className="w-2.5 h-2.5" />
                            <span>Email</span>
                          </button>
                        )}
                        <button 
                          onClick={() => handleCopy(c.value, c.contact_type)}
                          className="p-1 text-slate-500 hover:text-blue-400"
                        >
                          {copiedText === c.value ? (
                            <Check className="w-3.5 h-3.5 text-blue-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Socials Card */}
            <div className="glass-card rounded-2xl p-5 space-y-3.5">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Share2 className="w-4 h-4 text-purple-400" />
                <span>Social Presence</span>
              </h3>

              {(!lead.socials || lead.socials.length === 0) ? (
                <div className="text-xs text-slate-500">No social links detected on pages.</div>
              ) : (
                <div className="space-y-2">
                  {lead.socials.map((s) => (
                    <a
                      key={s.id}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-2.5 bg-dark-950/70 hover:bg-white/5 rounded-xl border border-white/5 text-xs transition-colors"
                    >
                      <span className="capitalize font-semibold text-slate-200">{s.platform}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Location Card */}
            <div className="glass-card rounded-2xl p-5 space-y-3.5">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-rose-400" />
                <span>Location Intelligence</span>
              </h3>

              <div className="p-3.5 bg-dark-950/70 rounded-xl border border-white/5 text-xs space-y-2.5">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Country</span>
                  <span className="font-semibold text-slate-200">{lead.country || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">City / Region</span>
                  <span className="font-semibold text-slate-200">
                    {lead.city !== 'Unknown' ? lead.city : ''} {lead.state !== 'Unknown' ? `(${lead.state})` : ''} {!lead.city && !lead.state ? 'Unknown' : ''}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono">Full Address</span>
                  <span className="text-slate-300 leading-relaxed">{lead.address || 'Unknown'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Technology & Tracking Stack Grid */}
          <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Detected Technology Stack & Tracking Evidence</span>
            </h3>

            {(!lead.technologies || lead.technologies.length === 0) ? (
              <div className="text-xs text-slate-500">No marketing or CMS technologies detected.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {lead.technologies.map((t) => (
                  <div key={t.id} className="p-3.5 bg-dark-950/70 rounded-xl border border-white/5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100">{t.name}</span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
                        {t.category}
                      </span>
                    </div>

                    {t.identifier && (
                      <div className="font-mono text-blue-400 text-[11px] font-semibold">
                        ID: {t.identifier}
                      </div>
                    )}

                    {t.evidence && (
                      <div className="text-[11px] text-slate-400 leading-snug">
                        {t.evidence}
                      </div>
                    )}

                    {t.source_url && (
                      <div className="text-[10px] text-slate-500 truncate font-mono pt-1 border-t border-white/5">
                        Source: {t.source_url}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Crawled Source Pages Audit */}
          {lead.crawl_pages && lead.crawl_pages.length > 0 && (
            <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-slate-400" />
                <span>Crawled Pages Audit Trail ({lead.crawl_pages.length})</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] uppercase text-slate-400 font-mono">
                      <th className="py-2.5">URL</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5">Load Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px] text-slate-400">
                    {lead.crawl_pages.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 text-slate-300 truncate max-w-xs">{p.url}</td>
                        <td className="py-2.5">
                          <span className="text-blue-400 font-semibold">{p.status_code || 200}</span>
                        </td>
                        <td className="py-2.5 capitalize">{p.page_type}</td>
                        <td className="py-2.5">{p.load_time_ms ? `${p.load_time_ms}ms` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sent Outreach Emails History */}
          {leadEmails.length > 0 && (
            <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  <span>Outreach Emails History ({leadEmails.length})</span>
                </h3>
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-semibold">
                  Hostinger Mail
                </span>
              </div>

              <div className="space-y-2">
                {leadEmails.map((em) => (
                  <div key={em.id} className="p-3.5 rounded-xl bg-dark-950/70 border border-white/5 space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-slate-200">
                        {em.subject}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(em.sent_at).toLocaleString()}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          Sent
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      To: <span className="text-blue-300">{em.recipient_email}</span>
                    </div>
                    <p className="text-slate-300 whitespace-pre-wrap leading-relaxed pt-1 border-t border-white/5 font-sans">
                      {em.body_text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Email Composer Modal */}
      <EmailComposerModal
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        initialLead={lead}
        initialRecipient={composerRecipient}
        onEmailSent={(sentEmail) => {
          setCurrentStage('contacted');
          setLeadEmails(prev => [sentEmail, ...prev]);
          const newNote: LeadNote = {
            id: Date.now(),
            lead_id: lead.id,
            content: `📧 Outreach Email Sent\nSubject: ${sentEmail.subject}\nRecipient: ${sentEmail.recipient_email}`,
            author: 'Sakib (Hostinger Mail)',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          setNotes(prev => [newNote, ...prev]);
        }}
      />
    </div>
  );
}
