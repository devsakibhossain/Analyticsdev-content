'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  Mail, 
  Sparkles, 
  Eye, 
  Check, 
  Copy, 
  AlertCircle,
  FileText,
  User,
  Building,
  Globe,
  CornerDownLeft,
  ShieldCheck
} from 'lucide-react';
import { Lead, LeadEmail, EmailTemplate } from '@/types';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface EmailComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLead?: Lead | null;
  initialRecipient?: string;
  initialSubject?: string;
  initialBody?: string;
  initialLeadId?: number;
  inReplyTo?: string;
  inReplyToUid?: number;
  inReplyToFolder?: string;
  modalTitle?: string;
  onEmailSent?: (email: LeadEmail) => void;
}

export default function EmailComposerModal({
  isOpen,
  onClose,
  initialLead,
  initialRecipient,
  initialSubject,
  initialBody,
  initialLeadId,
  inReplyTo,
  inReplyToUid,
  inReplyToFolder,
  modalTitle,
  onEmailSent
}: EmailComposerModalProps) {
  const { toast } = useToast();
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [trackOpens, setTrackOpens] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();

      // Recipient
      if (initialRecipient) {
        setRecipient(initialRecipient);
      } else if (initialLead) {
        const primaryEmail = initialLead.contacts?.find(c => c.contact_type === 'email');
        setRecipient(primaryEmail ? primaryEmail.value : '');
      } else {
        setRecipient('');
      }

      // Subject
      if (initialSubject) {
        setSubject(initialSubject);
      } else if (!subject) {
        const company = initialLead?.company_name || initialLead?.domain || '';
        setSubject(company ? `Quick tracking question for ${company}` : '');
      }

      // Body
      if (initialBody) {
        setBody(initialBody);
      }
    }
  }, [isOpen, initialLead, initialRecipient, initialSubject, initialBody]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const data = await fetchApi<EmailTemplate[]>('/emails/templates');
      setTemplates(data || []);
    } catch {
      // Fallback
    } finally {
      setLoadingTemplates(false);
    }
  };

  if (!isOpen) return null;

  const replaceVariables = (text: string) => {
    const company = initialLead?.company_name || initialLead?.domain || 'there';
    const domain = initialLead?.domain || (initialLead?.website_url ? new URL(initialLead.website_url).hostname : 'your website');
    const websiteUrl = initialLead?.website_url || `https://${domain}`;
    
    return text
      .replaceAll('{company_name}', company)
      .replaceAll('{domain}', domain)
      .replaceAll('{website_url}', websiteUrl);
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      setSubject('');
      setBody('');
      return;
    }
    const tmpl = templates.find(t => t.id === templateId);
    if (tmpl) {
      setSubject(replaceVariables(tmpl.subject));
      setBody(replaceVariables(tmpl.body));
      toast(`Loaded "${tmpl.name}" pitch angle`, 'info');
    }
  };

  const insertVariable = (varName: string) => {
    setBody(prev => prev + ` {${varName}}`);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim()) {
      toast('Please enter a valid recipient email', 'error');
      return;
    }
    if (!subject.trim()) {
      toast('Please enter an email subject line', 'error');
      return;
    }
    if (!body.trim()) {
      toast('Please enter your email content', 'error');
      return;
    }

    setSending(true);
    try {
      const endpoint = inReplyTo ? '/emails/reply' : '/emails/send';
      const payload: any = {
        to_email: recipient.trim(),
        subject: subject.trim(),
        body_text: body.trim(),
        lead_id: initialLead?.id || initialLeadId || null,
        display_name: 'Sakib Hossain',
        track_opens: trackOpens
      };

      if (inReplyToUid) {
        payload.in_reply_to_uid = inReplyToUid;
        payload.in_reply_to_folder = inReplyToFolder || 'INBOX';
      }
      if (inReplyTo) {
        payload.in_reply_to = inReplyTo;
      }

      const response = await fetchApi<LeadEmail>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      toast(`Email sent successfully to ${recipient.trim()}!`, 'success');
      if (onEmailSent) {
        onEmailSent(response);
      }
      onClose();
    } catch (err: any) {
      toast(err.message || 'Failed to send email via Hostinger Mail API', 'error');
    } finally {
      setSending(false);
    }
  };

  const isReply = Boolean(inReplyTo);

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div 
          className="relative w-full max-w-2xl bg-dark-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 border-b border-white/10 flex items-center justify-between bg-dark-950/70">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400">
                  {isReply ? <CornerDownLeft className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  {modalTitle || (isReply ? 'Reply to Email Message' : 'Compose Email / Cold Outreach')}
                </h3>
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <span className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-emerald-400">hello@sakibhossain.io</span>
                </span>
                <span>•</span>
                <span>Hostinger Mail API</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSend} className="p-5 sm:p-6 space-y-4">
            {/* Lead Context Pill (if attached) */}
            {initialLead && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span className="font-bold text-slate-200">{initialLead.company_name || initialLead.domain}</span>
                  <span className="text-slate-400 font-mono">({initialLead.domain})</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] text-blue-300 font-semibold px-2 py-0.5 rounded-full bg-blue-500/20">
                    Lead Score: {initialLead.lead_score}
                  </span>
                </div>
              </div>
            )}

            {/* Template Selector (only for new emails, not replies) */}
            {!isReply && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Pitch Template Angle</span>
                  <span className="text-[11px] text-blue-400 font-normal">Optional • Auto-fills variables</span>
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="w-full bg-dark-950 border border-white/10 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none cursor-pointer"
                >
                  <option value="">✨ Blank Custom Email (Write from scratch)</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      [{t.category}] {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Recipient Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Recipient Email Address
              </label>
              <input
                type="email"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="name@company.com or any client email..."
                className="w-full bg-dark-950 border border-white/10 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 outline-none"
              />
            </div>

            {/* Subject Line */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Subject Line
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line of your outreach email..."
                className="w-full bg-dark-950 border border-white/10 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none"
              />
            </div>

            {/* Email Body & Live Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Email Message
                </label>
                <div className="flex items-center space-x-1 bg-dark-950 p-1 rounded-lg border border-white/10 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsPreview(false)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      !isPreview ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPreview(true)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      isPreview ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>

              {isPreview ? (
                <div className="p-4 rounded-xl bg-dark-950 border border-white/10 min-h-[160px] text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {body || <span className="text-slate-500">Your email preview will appear here...</span>}
                  <div className="mt-4 pt-3 border-t border-white/10 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Sent from <strong>hello@sakibhossain.io</strong></span>
                    {trackOpens && (
                      <span className="text-emerald-400 flex items-center space-x-1">
                        <Eye className="w-3 h-3" />
                        <span>Seen Tracking Active</span>
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <textarea
                  required
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Draft your personalized message or reply..."
                  className="w-full bg-dark-950 border border-white/10 focus:border-blue-500 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 outline-none resize-none leading-relaxed"
                />
              )}

              {/* Dynamic Variables helper tags */}
              {!isReply && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-400">
                  <span>Variables:</span>
                  <button
                    type="button"
                    onClick={() => insertVariable('company_name')}
                    className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-mono text-[10px]"
                  >
                    {'{company_name}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable('domain')}
                    className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-mono text-[10px]"
                  >
                    {'{domain}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable('website_url')}
                    className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-mono text-[10px]"
                  >
                    {'{website_url}'}
                  </button>
                </div>
              )}
            </div>

            {/* Tracking Checkbox */}
            <div className="p-3 rounded-xl bg-dark-950/60 border border-white/5 flex items-center justify-between">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackOpens}
                  onChange={(e) => setTrackOpens(e.target.checked)}
                  className="w-4 h-4 rounded bg-dark-900 border-white/20 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-xs text-slate-300 flex items-center space-x-1.5">
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  <span>Real-time Email Seen & Read Tracking (1x1 transparent pixel)</span>
                </span>
              </label>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Auto-detected
              </span>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {initialLead ? (
                  <>Auto-advances CRM to <strong className="text-cyan-400">Outreach Sent</strong></>
                ) : (
                  <>Direct dispatch via <strong className="text-slate-200">hello@sakibhossain.io</strong></>
                )}
              </span>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/25 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sending ? 'Sending via Hostinger...' : (isReply ? 'Send Reply' : 'Send Email Now')}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
