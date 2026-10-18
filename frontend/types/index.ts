export interface User {
  id: number;
  email: string;
  is_active: boolean;
}

export interface HealthStatus {
  status: string;
  database: string;
  worker: string;
  timestamp: string;
}

export interface ScoreReason {
  points: number;
  reason: string;
}

export interface LeadContact {
  id: number;
  contact_type: 'email' | 'phone' | 'whatsapp';
  value: string;
  category: 'general' | 'sales' | 'support' | 'contact' | 'unknown';
  source_url?: string;
  created_at: string;
}

export interface LeadSocial {
  id: number;
  platform: 'linkedin' | 'facebook' | 'instagram' | 'youtube' | 'twitter' | 'tiktok' | 'pinterest';
  url: string;
  source_url?: string;
  created_at: string;
}

export interface LeadTechnology {
  id: number;
  category: string;
  name: string;
  status: string;
  identifier?: string;
  confidence: number;
  evidence?: string;
  source_url?: string;
  created_at: string;
}

export interface LeadOpportunity {
  id: number;
  opportunity_type: string;
  title: string;
  reason: string;
  evidence?: string;
  source_url?: string;
  confidence: number;
  created_at: string;
}

export interface CrawlPage {
  id: number;
  url: string;
  status_code?: number;
  title?: string;
  page_type: string;
  load_time_ms?: number;
  created_at: string;
}

export type PipelineStage = 'new' | 'contacted' | 'meeting' | 'proposal' | 'won' | 'lost';

export interface LeadNote {
  id: number;
  lead_id: number;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: number;
  domain: string;
  website_url: string;
  company_name?: string;
  website_title?: string;
  description?: string;
  industry?: string;
  industry_confidence?: number;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  postal_code?: string;
  cms?: string;
  ecommerce_platform?: string;
  is_ecommerce: string;
  lead_score: number;
  qualification: 'High Opportunity' | 'Medium Opportunity' | 'Low Opportunity' | 'Unqualified';
  score_reasons?: ScoreReason[];
  pipeline_stage?: PipelineStage;
  ad_platforms?: string[];
  pages_crawled: number;
  created_at: string;
  updated_at: string;
  contacts?: LeadContact[];
  socials?: LeadSocial[];
  technologies?: LeadTechnology[];
  opportunities?: LeadOpportunity[];
  crawl_pages?: CrawlPage[];
  notes?: LeadNote[];
  emails?: LeadEmail[];
}

export interface LeadEmail {
  id: number;
  lead_id?: number;
  recipient_email: string;
  sender_email: string;
  subject: string;
  body_text: string;
  body_html?: string;
  status: 'sent' | 'failed' | 'draft' | 'opened' | 'replied';
  direction?: 'outgoing' | 'incoming';
  provider_message_id?: string;
  in_reply_to?: string;
  thread_id?: string;
  error_message?: string;
  tracking_token?: string;
  opened_at?: string;
  last_opened_at?: string;
  open_count?: number;
  sent_at: string;
  created_at: string;
  lead_domain?: string;
  lead_company_name?: string;
}

export interface IncomingEmailMessage {
  uid: number;
  path: string;
  date: string;
  subject: string;
  from_name: string;
  from_address: string;
  to_address: string;
  unseen: boolean;
  flags: string[];
  size: number;
  message_id?: string;
  in_reply_to?: string;
}

export interface EmailMessageDetail {
  uid: number;
  folder: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  message_id?: string;
  in_reply_to?: string;
  body_text: string;
  body_html?: string;
}

export interface HotLeadFunnel {
  lead_id?: number;
  domain?: string;
  company_name?: string;
  recipient_email: string;
  subject: string;
  open_count: number;
  last_opened_at?: string;
  suggested_action: string;
}

export interface FunnelStats {
  total_leads: number;
  total_sent: number;
  contacted_leads: number;
  opened_count: number;
  open_rate_percent: number;
  replied_count: number;
  reply_rate_percent: number;
  meeting_leads: number;
  proposal_leads: number;
  won_leads: number;
  hot_leads: HotLeadFunnel[];
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  description: string;
}

export interface MailboxStatus {
  connected: boolean;
  address?: string;
  display_name?: string;
  mailbox_resource_id?: string;
  order_resource_id?: string;
  inbox_messages?: number;
  sent_messages?: number;
  storage_usage_kb?: number;
  storage_limit_kb?: number;
  storage_percentage?: number;
  error?: string;
}

export interface ScanJob {
  id: number;
  domain: string;
  target_url: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  current_step: string;
  pages_crawled: number;
  pages_failed: number;
  error_message?: string;
  max_pages: number;
  use_sitemap: boolean;
  scan_js: boolean;
  scan_tracking: boolean;
  lead_id?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface StatsOverview {
  total_leads: number;
  high_opportunity: number;
  medium_opportunity: number;
  low_opportunity: number;
  unqualified: number;
  emails_found: number;
  phones_found: number;
  ecommerce_count: number;
  ga4_count: number;
  gtm_count: number;
  meta_pixel_count: number;
  google_ads_count: number;
  opportunities: {
    ga4_audit: number;
    gtm_audit: number;
    meta_audit: number;
    gads_audit: number;
    ecommerce_audit: number;
    lead_audit: number;
  };
}

export type OutreachStage = 'pitch_sent' | 'seen' | 'followup_1' | 'followup_2' | 'replied' | 'meeting' | 'won' | 'lost';

export interface OutreachEmailSummary {
  id: number;
  subject: string;
  sent_at: string;
  open_count: number;
  opened_at?: string;
  last_opened_at?: string;
}

export interface OutreachNoteItem {
  id: number;
  content: string;
  author: string;
  created_at: string;
}

export interface OutreachCard {
  id: string;
  lead_id?: number;
  recipient_email: string;
  domain: string;
  company_name: string;
  stage: OutreachStage;
  open_count: number;
  opened_at?: string;
  last_opened_at?: string;
  is_hot: boolean;
  total_emails_sent: number;
  followup_count: number;
  last_sent_at: string;
  last_subject: string;
  notes_count: number;
  latest_note?: string;
  notes: OutreachNoteItem[];
  meeting_info?: {
    date?: string;
    type?: string;
    link?: string;
    notes?: string;
  };
  suggested_action: string;
  emails_history: OutreachEmailSummary[];
}

export interface OutreachBoardResponse {
  total_leads_pitched: number;
  total_emails_sent: number;
  total_followups_sent: number;
  opened_leads_count: number;
  open_rate_percent: number;
  calls_booked_count: number;
  won_deals_count: number;
  cards: OutreachCard[];
}
