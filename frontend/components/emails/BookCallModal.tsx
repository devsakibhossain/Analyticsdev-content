'use client';

import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Video, 
  Link as LinkIcon, 
  FileText, 
  CheckCircle2, 
  Sparkles,
  PhoneCall
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface BookCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId?: number;
  recipientEmail: string;
  domain?: string;
  companyName?: string;
  onCallBooked: () => void;
}

const CALL_TYPES = [
  { id: '15-Min Loom Audit Walkthrough', label: '🎥 15-Min Loom Audit Walkthrough', desc: 'Walk through tracking vulnerabilities & quick wins' },
  { id: '30-Min GA4 & GTM Strategy Call', label: '🎯 30-Min GA4 & GTM Strategy Call', desc: 'Technical scoping for server-side tagging & conversion setup' },
  { id: 'Meta Ads CAPI & Signal Fix Call', label: '⚡ Meta Ads CAPI & Signal Fix Call', desc: 'Event deduplication & iOS 14+ tracking recovery' },
  { id: 'Custom Scope & Pricing Discussion', label: '💼 Custom Scope & Pricing Discussion', desc: 'Review agency deliverables, timeline, and quote' },
  { id: 'Quick Phone Discovery Call', label: '📞 Quick Phone Discovery Call', desc: 'Direct 10-minute introductory phone call' }
];

export default function BookCallModal({
  isOpen,
  onClose,
  leadId,
  recipientEmail,
  domain,
  companyName,
  onCallBooked
}: BookCallModalProps) {
  const { toast } = useToast();
  const [meetingType, setMeetingType] = useState(CALL_TYPES[0].id);
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [notes, setNotes] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingDate) {
      toast('Please select a scheduled date and time', 'error');
      return;
    }

    setSaving(true);
    try {
      await fetchApi('/emails/book-call', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: leadId,
          recipient_email: recipientEmail,
          meeting_type: meetingType,
          meeting_date: meetingDate,
          meeting_link: meetingLink.trim() || undefined,
          notes: notes.trim() || undefined,
          send_email: sendEmail
        })
      });

      const successMsg = sendEmail
        ? `🎉 Call scheduled & confirmation email sent to ${recipientEmail}!`
        : `🎉 Call scheduled successfully with ${companyName || domain || recipientEmail}!`;
      toast(successMsg, 'success');
      onCallBooked();
      onClose();
    } catch (err: any) {
      toast(err.message || 'Failed to book call', 'error');
    } finally {
      setSaving(false);
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
          className="relative w-full max-w-lg bg-dark-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 border-b border-white/10 flex items-center justify-between bg-dark-950/70">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  Book Outreach Discovery Call
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Move prospect to <span className="text-indigo-400 font-semibold font-mono">Meeting Booked</span> stage
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
            {/* Prospect Context Box */}
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-100">{companyName || domain}</span>
                <div className="text-[11px] font-mono text-indigo-300">{recipientEmail}</div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Prospect
              </span>
            </div>

            {/* Meeting Type */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                Meeting / Call Agenda
              </label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value)}
                className="w-full bg-dark-950 border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none cursor-pointer"
              >
                {CALL_TYPES.map(ct => (
                  <option key={ct.id} value={ct.id}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Meeting Date & Time */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                Scheduled Date & Time *
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  required
                  className="w-full bg-dark-950 border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none"
                />
              </div>
            </div>

            {/* Meeting Link */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-300 uppercase tracking-wider text-[11px] flex items-center justify-between">
                <span>Meeting Link (Google Meet / Zoom / Phone)</span>
                <span className="text-[10px] text-slate-500 font-normal">Optional</span>
              </label>
              <div className="relative">
                <LinkIcon className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://meet.google.com/abc-defg-hij or phone number"
                  className="w-full pl-9 pr-3 py-2.5 bg-dark-950 border border-white/10 focus:border-indigo-500 rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none font-mono"
                />
              </div>
            </div>

            {/* Notes / Agenda Details */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-300 uppercase tracking-wider text-[11px] flex items-center justify-between">
                <span>Call Notes & Preparation</span>
                <span className="text-[10px] text-slate-500 font-normal">Optional</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Key questions, issues discovered on their website, client timezone, or specific tracking tags to discuss..."
                className="w-full bg-dark-950 border border-white/10 focus:border-indigo-500 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Send Invitation Checkbox */}
            <label className="flex items-start space-x-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 cursor-pointer hover:bg-indigo-500/15 transition-colors">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-dark-950 border-white/20 accent-indigo-600 cursor-pointer"
              />
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-200">
                  Send meeting invitation email to prospect
                </div>
                <div className="text-[11px] text-slate-400">
                  Dispatches branded confirmation with Google Meet link & agenda from <span className="text-indigo-300 font-mono">hello@sakibhossain.io</span>
                </div>
              </div>
            </label>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/25 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{saving ? 'Scheduling & Sending...' : (sendEmail ? 'Confirm & Send Invitation' : 'Confirm Call Booking')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
