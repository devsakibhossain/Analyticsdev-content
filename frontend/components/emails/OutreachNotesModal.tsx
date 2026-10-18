'use client';

import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Plus, 
  Send, 
  Clock, 
  User, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { OutreachCard, OutreachNoteItem } from '@/types';

interface OutreachNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: OutreachCard | null;
  onNotesUpdated: () => void;
}

export default function OutreachNotesModal({
  isOpen,
  onClose,
  card,
  onNotesUpdated
}: OutreachNotesModalProps) {
  const { toast } = useToast();
  const [newNote, setNewNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [localNotes, setLocalNotes] = useState<OutreachNoteItem[]>([]);

  React.useEffect(() => {
    if (card) {
      setLocalNotes(card.notes || []);
    }
  }, [card]);

  if (!isOpen || !card) return null;

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setAdding(true);
    try {
      const added = await fetchApi<OutreachNoteItem>('/emails/outreach-note', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: card.lead_id,
          recipient_email: card.recipient_email,
          content: newNote.trim(),
          author: 'Sakib'
        })
      });

      setLocalNotes(prev => [added, ...prev]);
      setNewNote('');
      toast('Note recorded successfully', 'success');
      onNotesUpdated();
    } catch (err: any) {
      toast(err.message || 'Failed to save note', 'error');
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div 
          className="relative w-full max-w-xl bg-dark-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 border-b border-white/10 flex items-center justify-between bg-dark-950/70">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  Outreach Activity & Notes
                </h3>
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <span className="font-semibold text-slate-200">{card.company_name || card.domain}</span>
                <span>•</span>
                <span className="font-mono text-blue-300">{card.recipient_email}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Quick Add Note Form */}
            <form onSubmit={handleAddNote} className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Log New Note / Outreach Update
              </label>
              <div className="space-y-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Record call notes, client feedback, loom video link, quotation details, or next follow-up action..."
                  rows={3}
                  className="w-full bg-dark-950 border border-white/10 focus:border-blue-500 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 outline-none resize-none leading-relaxed"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={adding || !newNote.trim()}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{adding ? 'Saving...' : 'Add Note'}</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Existing Notes Timeline */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Timeline ({localNotes.length})</span>
                <span className="text-[10px] text-slate-500 font-mono">Reverse chronological</span>
              </div>

              {localNotes.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-white/5 rounded-xl">
                  No notes recorded yet. Add your first note above to track outreach interactions!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {localNotes.map((note) => (
                    <div 
                      key={note.id}
                      className="p-3.5 rounded-xl bg-dark-950/70 border border-white/5 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-blue-400 flex items-center space-x-1">
                          <User className="w-3 h-3" />
                          <span>{note.author}</span>
                        </span>
                        <span className="font-mono text-slate-500">
                          {new Date(note.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {note.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 flex justify-end bg-dark-950/70">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
