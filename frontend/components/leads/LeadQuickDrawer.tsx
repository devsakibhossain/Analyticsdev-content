'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  X, 
  ExternalLink, 
  Mail, 
  Phone, 
  MessageSquare, 
  Copy, 
  Check, 
  Sparkles, 
  RotateCw, 
  Trash2, 
  ArrowUpRight,
  ShieldAlert,
  Layers,
  Radio,
  Globe,
  Megaphone,
  FileText,
  Plus,
  KanbanSquare,
  Clock,
  Briefcase,
  CheckCircle2,
  XCircle,
  Send
} from 'lucide-react';
import { Lead, LeadNote, PipelineStage, LeadEmail } from '@/types';
import { useToast } from '@/components/ui/Toast';
import { fetchApi } from '@/lib/api';
import ScoreBreakdown from './ScoreBreakdown';
import EmailComposerModal from '@/components/emails/EmailComposerModal';

interface LeadQuickDrawerProps {
  lead: Lead | null;
  isOpen?: boolean;
  onClose: () => void;
  onDelete?: (id: number) => void;
  onRescan?: (id: number) => void;
  onLeadUpdated?: (lead: Lead) => void;
}

const STAGES: { id: PipelineStage; label: string; badge: string }[] = [
  { id: 'new', label: 'New Discovered', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  { id: 'contacted', label: 'Outreach Sent', badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  { id: 'meeting', label: 'Meeting Booked', badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  { id: 'proposal', label: 'Proposal Sent', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { id: 'won', label: 'Closed Won', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  { id: 'lost', label: 'Lost / Archive', badge: 'bg-slate-800 text-slate-400 border-slate-700' },
];

export default function LeadQuickDrawer({
  lead,
  isOpen = true,
  onClose,
  onDelete,
  onRescan,
  onLeadUpdated
}: LeadQuickDrawerProps) {
  const { toast } = useToast();
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [currentStage, setCurrentStage] = useState<PipelineStage>('new');
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerRecipient, setComposerRecipient] = useState('');

  useEffect(() => {
    if (lead) {
      setNotes(lead.notes || []);
      setCurrentStage(lead.pipeline_stage || 'new');
      setNewNote('');
    }
  }, [lead]);

  if (!isOpen || !lead) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(label);
    toast(`${label} copied to clipboard!`, 'success');
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const handleStageChange = async (newStage: PipelineStage) => {
    if (!lead || newStage === currentStage) return;
    setUpdatingStage(true);
    try {
      const updated = await fetchApi<Lead>(`/leads/${lead.id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: newStage })
      });
      setCurrentStage(newStage);
      const stageObj = STAGES.find(s => s.id === newStage);
      toast(`Pipeline stage updated: ${stageObj?.label || newStage}`, 'success');
      if (onLeadUpdated) {
        onLeadUpdated({ ...lead, pipeline_stage: newStage, notes });
      }
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
      const updatedNotes = [created, ...notes];
      setNotes(updatedNotes);
      setNewNote('');
      toast('Note added to lead timeline', 'success');
      if (onLeadUpdated) {
        onLeadUpdated({ ...lead, notes: updatedNotes, pipeline_stage: currentStage });
      }
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
      const updatedNotes = notes.filter(n => n.id !== noteId);
      setNotes(updatedNotes);
      toast('Note removed', 'info');
      if (onLeadUpdated) {
        onLeadUpdated({ ...lead, notes: updatedNotes, pipeline_stage: currentStage });
      }
    } catch (err: any) {
      toast(err.message || 'Failed to delete note', 'error');
    } finally {
      setDeletingNoteId(null);
    }
  };

  const emails = lead.contacts?.filter(c => c.contact_type === 'email') || [];
  const phones = lead.contacts?.filter(c => c.contact_type === 'phone') || [];
  const whatsapps = lead.contacts?.filter(c => c.contact_type === 'whatsapp') || [];
  const activeStage = STAGES.find(s => s.id === currentStage) || STAGES[0];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Slide-over Drawer */}
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-dark-900/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out animate-slide-up">
        {/* Drawer Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-start justify-between">
          <div className="space-y-1 pr-4">
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold text-slate-100 truncate">
                {lead.company_name || lead.domain}
              </span>
              <a
                href={lead.website_url}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-blue-400 transition-colors p-0.5"
                title="Open live website"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <div className="text-xs text-slate-400 flex items-center space-x-2">
              <span className="font-mono text-blue-400 font-semibold">{lead.domain}</span>
              <span>•</span>
              <span>{lead.industry || 'Unknown Industry'}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* CRM Pipeline Stage Quick Selector */}
          <div className="p-4 rounded-xl bg-dark-950/80 border border-white/5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <KanbanSquare className="w-3.5 h-3.5 text-blue-400" />
                <span>CRM Pipeline Stage</span>
              </span>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${activeStage.badge}`}>
                {activeStage.label}
              </span>
            </div>

            <div className="relative">
              <select
                value={currentStage}
                onChange={(e) => handleStageChange(e.target.value as PipelineStage)}
                disabled={updatingStage}
                className="w-full bg-dark-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50"
              >
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    Move to: {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Advertising Platforms */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Megaphone className="w-3.5 h-3.5 text-blue-400" />
                <span>Active Advertising Platforms</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-semibold">
                {lead.ad_platforms?.length || 0} Detected
              </span>
            </div>

            {(!lead.ad_platforms || lead.ad_platforms.length === 0) ? (
              <div className="p-3.5 text-center rounded-xl bg-dark-950/40 border border-white/5 text-xs text-slate-500">
                No active advertising pixels or ad tags detected.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {lead.ad_platforms.map((ad, idx) => (
                  <span
                    key={`ad-${idx}`}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-500/15 to-indigo-500/15 border border-blue-500/30 text-blue-200 shadow-sm"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    <span>{ad}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Score & Qualification Pill */}
          <div className="p-4 rounded-xl bg-dark-950/80 border border-white/5 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs text-slate-400 font-medium">Lead Rating</div>
              <div className="text-sm font-semibold text-slate-200">{lead.qualification}</div>
            </div>
            <ScoreBreakdown lead={lead} size="md" />
          </div>

          {/* Direct Contact Actions (1-Click Copy) */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Direct Contacts</span>
              <span className="text-[11px] text-slate-500 lowercase font-normal">Click to copy</span>
            </div>

            {emails.length === 0 && phones.length === 0 && whatsapps.length === 0 ? (
              <div className="p-4 text-center rounded-xl bg-dark-950/40 border border-white/5 text-xs text-slate-500">
                No direct contacts found on scanned pages.
              </div>
            ) : (
              <div className="space-y-2">
                {emails.map((e, idx) => (
                  <div
                    key={`email-${idx}`}
                    onClick={() => copyToClipboard(e.value, 'Email')}
                    className="group flex items-center justify-between p-2.5 rounded-xl bg-dark-950/60 hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/30 cursor-pointer transition-all"
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-mono text-xs text-slate-200 truncate">{e.value}</span>
                    </div>
                    <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setComposerRecipient(e.value);
                          setComposerOpen(true);
                        }}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-blue-300 hover:text-white text-[10px] font-semibold transition-all"
                        title="Compose email to this address"
                      >
                        <Send className="w-2.5 h-2.5" />
                        <span>Email</span>
                      </button>
                      <button 
                        onClick={() => copyToClipboard(e.value, 'Email')}
                        className="text-slate-500 group-hover:text-blue-400 p-1 transition-colors"
                      >
                        {copiedItem === 'Email' ? <Check className="w-3.5 h-3.5 text-blue-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}

                {phones.map((p, idx) => (
                  <div
                    key={`phone-${idx}`}
                    onClick={() => copyToClipboard(p.value, 'Phone')}
                    className="group flex items-center justify-between p-2.5 rounded-xl bg-dark-950/60 hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/30 cursor-pointer transition-all"
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400">
                        <Phone className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-mono text-xs text-slate-200">{p.value}</span>
                    </div>
                    <button className="text-slate-500 group-hover:text-blue-400 p-1 transition-colors">
                      {copiedItem === 'Phone' ? <Check className="w-3.5 h-3.5 text-blue-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}

                {whatsapps.map((w, idx) => (
                  <div
                    key={`wa-${idx}`}
                    onClick={() => copyToClipboard(w.value, 'WhatsApp')}
                    className="group flex items-center justify-between p-2.5 rounded-xl bg-dark-950/60 hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/30 cursor-pointer transition-all"
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-mono text-xs text-slate-200">{w.value}</span>
                    </div>
                    <button className="text-slate-500 group-hover:text-blue-400 p-1 transition-colors">
                      {copiedItem === 'WhatsApp' ? <Check className="w-3.5 h-3.5 text-blue-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CRM Notes & Follow-up Timeline */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Notes & CRM Activity ({notes.length})</span>
              </div>
            </div>

            {/* Note Input */}
            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write a client note, follow-up status, or proposal notes..."
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

            {/* Notes List */}
            {notes.length === 0 ? (
              <div className="p-3.5 text-center rounded-xl bg-dark-950/40 border border-white/5 text-xs text-slate-500">
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
                        <span className="text-[10px] text-slate-500">
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

          {/* Detected Martech Stack */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Technology Stack</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {lead.cms && lead.cms !== 'Unknown' && (
                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-xs font-medium">
                  CMS: {lead.cms}
                </span>
              )}
              {lead.is_ecommerce === 'Detected' && (
                <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                  E-Commerce Store
                </span>
              )}
              {lead.technologies?.map((t, idx) => (
                <span 
                  key={`tech-${idx}`}
                  className="px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-medium"
                >
                  {t.name}
                </span>
              ))}
            </div>
          </div>

          {/* Opportunities & Tracking Pitch Points */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Audit Opportunities ({lead.opportunities?.length || 0})</span>
            </div>

            {!lead.opportunities || lead.opportunities.length === 0 ? (
              <div className="p-4 text-center rounded-xl bg-dark-950/40 border border-white/5 text-xs text-slate-500">
                No tracking gaps detected. Full stack implemented.
              </div>
            ) : (
              <div className="space-y-2">
                {lead.opportunities.map((opp, idx) => (
                  <div
                    key={`opp-${idx}`}
                    className="p-3.5 rounded-xl bg-dark-950/60 border border-white/5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">{opp.title}</span>
                      <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 font-semibold">
                        {Math.round(opp.confidence * 100)}% Confidence
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{opp.reason}</p>
                    {opp.evidence && (
                      <div className="text-[10px] text-slate-400 font-mono bg-dark-900/80 p-2 rounded-lg border border-white/5 truncate">
                        <span className="text-blue-400 font-semibold">Evidence: </span>{opp.evidence}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-dark-950/80 flex items-center justify-between gap-3">
          <Link
            href={`/leads/${lead.id}`}
            className="flex-1 inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs transition-all shadow-lg shadow-blue-500/25"
          >
            <span>Open Full Dossier</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={() => {
              const primaryEmail = emails[0]?.value || '';
              setComposerRecipient(primaryEmail);
              setComposerOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-500/25 cursor-pointer"
            title="Compose Cold Outreach Email"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Email</span>
          </button>

          {onRescan && (
            <button
              onClick={() => onRescan(lead.id)}
              className="p-2.5 text-slate-300 hover:text-blue-400 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              title="Rescan Website"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          )}

          {onDelete && (
            <button
              onClick={() => onDelete(lead.id)}
              className="p-2.5 text-slate-400 hover:text-red-400 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/10 transition-colors"
              title="Delete Lead"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Cold Email Outreach Composer Modal */}
      <EmailComposerModal
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        initialLead={lead}
        initialRecipient={composerRecipient}
        onEmailSent={(sentEmail) => {
          setCurrentStage('contacted');
          const newNote: LeadNote = {
            id: Date.now(),
            lead_id: lead.id,
            content: `📧 Outreach Email Sent\nSubject: ${sentEmail.subject}\nRecipient: ${sentEmail.recipient_email}`,
            author: 'Sakib (Hostinger Mail)',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          const updatedNotes = [newNote, ...notes];
          setNotes(updatedNotes);
          if (onLeadUpdated) {
            onLeadUpdated({ ...lead, pipeline_stage: 'contacted', notes: updatedNotes });
          }
        }}
      />
    </>
  );
}
