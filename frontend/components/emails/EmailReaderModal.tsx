'use client';

import React from 'react';
import { 
  X, 
  CornerDownLeft, 
  Mail, 
  Calendar, 
  User, 
  Copy, 
  Check, 
  Eye, 
  Flame, 
  ExternalLink,
  ShieldCheck,
  Send
} from 'lucide-react';
import { LeadEmail, IncomingEmailMessage, EmailMessageDetail } from '@/types';
import { useToast } from '@/components/ui/Toast';

interface EmailReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Either an incoming message or a sent LeadEmail
  incomingDetail?: EmailMessageDetail | null;
  sentEmail?: LeadEmail | null;
  onReplyClick?: (replyTo: {
    recipient: string;
    subject: string;
    body_text: string;
    in_reply_to?: string;
    in_reply_to_uid?: number;
    in_reply_to_folder?: string;
    lead_id?: number;
  }) => void;
}

export default function EmailReaderModal({
  isOpen,
  onClose,
  incomingDetail,
  sentEmail,
  onReplyClick
}: EmailReaderModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || (!incomingDetail && !sentEmail)) return null;

  const isIncoming = Boolean(incomingDetail);
  const subject = isIncoming ? incomingDetail?.subject : sentEmail?.subject;
  const from = isIncoming ? incomingDetail?.from : (sentEmail?.sender_email || 'hello@sakibhossain.io');
  const to = isIncoming ? incomingDetail?.to : sentEmail?.recipient_email;
  const date = isIncoming ? incomingDetail?.date : sentEmail?.sent_at;
  const bodyText = isIncoming ? incomingDetail?.body_text : sentEmail?.body_text;
  const bodyHtml = isIncoming ? incomingDetail?.body_html : sentEmail?.body_html;
  const messageId = isIncoming ? incomingDetail?.message_id : sentEmail?.provider_message_id;

  const handleCopy = () => {
    if (bodyText) {
      navigator.clipboard.writeText(bodyText);
      setCopied(true);
      toast('Email text copied to clipboard', 'info');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReply = () => {
    if (!onReplyClick) return;
    
    // Extract clean email address if in "Name <email@domain>" format
    let replyToEmail = from || '';
    const match = replyToEmail.match(/<([^>]+)>/);
    if (match) {
      replyToEmail = match[1];
    }

    const replySubject = subject?.toLowerCase().startsWith('re:') ? subject : `Re: ${subject || ''}`;
    const quotedBody = `\n\n--- On ${date || 'previous message'}, ${from} wrote ---\n> ${bodyText?.replaceAll('\n', '\n> ') || ''}`;

    onReplyClick({
      recipient: replyToEmail,
      subject: replySubject,
      body_text: quotedBody,
      in_reply_to: messageId || undefined,
      in_reply_to_uid: incomingDetail?.uid,
      in_reply_to_folder: incomingDetail?.folder || 'INBOX',
      lead_id: sentEmail?.lead_id
    });
    onClose();
  };

  const handleSendFollowUp = () => {
    if (!onReplyClick || !sentEmail) return;

    const cleanSubject = (sentEmail.subject || '')
      .replace(/^(Follow-up:\s*|Re:\s*)+/gi, '')
      .trim();
    const followUpSubject = `Follow-up: ${cleanSubject || 'Quick touch base'}`;

    const quotedHistory = bodyText 
      ? `\n\n--- On ${date ? new Date(date).toLocaleString() : 'earlier'}, you sent to ${to} ---\n> ${bodyText.replaceAll('\n', '\n> ')}`
      : '';

    const initialBody = `Hi,\n\nFollowing up on my previous message below. Would love to hear your thoughts when you have a moment.\n${quotedHistory}`;

    onReplyClick({
      recipient: sentEmail.recipient_email,
      subject: followUpSubject,
      body_text: initialBody,
      lead_id: sentEmail.lead_id
    });
    onClose();
  };

  const handleSendNewMessage = () => {
    if (!onReplyClick || !sentEmail) return;

    onReplyClick({
      recipient: sentEmail.recipient_email,
      subject: '',
      body_text: '',
      lead_id: sentEmail.lead_id
    });
    onClose();
  };

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
          className="relative w-full max-w-3xl bg-dark-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 border-b border-white/10 flex items-start justify-between bg-dark-950/70 gap-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                  isIncoming ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                }`}>
                  {isIncoming ? '📥 Incoming Message' : '📤 Sent Outreach'}
                </span>
                {sentEmail && (sentEmail.open_count || 0) > 0 && (
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                    {(sentEmail.open_count || 0) >= 2 ? <Flame className="w-3 h-3 text-amber-400" /> : <Eye className="w-3 h-3" />}
                    <span>Opened {sentEmail.open_count}x</span>
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-100 truncate">
                {subject || '(No Subject)'}
              </h2>
            </div>

            <div className="flex items-center space-x-2">
              {isIncoming ? (
                <button
                  onClick={handleReply}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20"
                >
                  <CornerDownLeft className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </button>
              ) : sentEmail ? (
                <button
                  onClick={handleSendFollowUp}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Follow-Up</span>
                </button>
              ) : null}
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Meta Info Bar */}
          <div className="p-4 sm:px-6 bg-dark-950/40 border-b border-white/5 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-slate-400 font-semibold">From:</span>
                <span className="text-slate-200 font-medium truncate">{from}</span>
              </div>
              <div className="flex items-center space-x-1.5 text-slate-400 font-mono text-[11px]">
                <Calendar className="w-3 h-3 text-slate-500" />
                <span>{date ? new Date(date).toLocaleString() : '—'}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-slate-400 font-semibold">To:</span>
              <span className="text-blue-300 font-mono text-[11px]">{to}</span>
            </div>

            {sentEmail && sentEmail.opened_at && (
              <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-4 text-[11px] text-slate-300">
                <span className="text-emerald-400 flex items-center space-x-1 font-semibold">
                  <Eye className="w-3.5 h-3.5" />
                  <span>First Seen: {new Date(sentEmail.opened_at).toLocaleString()}</span>
                </span>
                {sentEmail.last_opened_at && sentEmail.open_count && sentEmail.open_count > 1 && (
                  <span className="text-cyan-400 font-semibold">
                    Last Seen: {new Date(sentEmail.last_opened_at).toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Email Content Body */}
          <div className="p-5 sm:p-6 overflow-y-auto max-h-[60vh] space-y-4">
            {bodyHtml ? (
              <div 
                className="prose prose-invert max-w-none text-xs sm:text-sm text-slate-200 leading-relaxed font-sans"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            ) : (
              <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                {bodyText || <span className="text-slate-500 italic">No message body available.</span>}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/10 flex items-center justify-between bg-dark-950/70">
            <button
              onClick={handleCopy}
              className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Content'}</span>
            </button>

            <div className="flex items-center space-x-2">
              {isIncoming ? (
                <>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleReply}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25"
                  >
                    <CornerDownLeft className="w-3.5 h-3.5" />
                    <span>Reply to this Message</span>
                  </button>
                </>
              ) : sentEmail ? (
                <>
                  <button
                    onClick={onClose}
                    className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleSendNewMessage}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-blue-300 hover:text-white text-xs font-semibold border border-blue-500/20 transition-all"
                    title="Send a brand new email to this recipient"
                  >
                    <Mail className="w-3.5 h-3.5 text-blue-400" />
                    <span>New Email</span>
                  </button>
                  <button
                    onClick={handleSendFollowUp}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Follow-Up / Message Again</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
