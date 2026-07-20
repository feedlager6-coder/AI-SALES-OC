export interface SendEmailParams {
  from: { email: string; name: string }
  to: { email: string; name?: string }
  subject: string
  htmlBody: string
  textBody?: string
  headers?: Record<string, string>
  tags?: string[]
  trackingEnabled?: boolean
  trackingDomain?: string
}

export interface SendEmailResult {
  messageId: string
  status: 'queued' | 'sent' | 'rejected'
  rejectReason?: string
}

export interface EmailWebhookEvent {
  messageId: string
  /** Sprint 1.6: 'replied' is included for inbound reply detection */
  event: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed' | 'replied'
  timestamp: Date
  metadata?: {
    bounceType?: 'hard' | 'soft'
    clickUrl?: string
    userAgent?: string
    ip?: string
    // Sprint 1.6: reply-specific fields (populated by providers that support inbound parsing)
    from?: string
    replyText?: string
    body?: string
    stripped?: { text?: string; html?: string }
  }
}

export interface IEmailSendingPlugin {
  readonly name: string
  readonly displayName: string
  readonly category: 'email_sending'

  isConfigured(workspaceId: string): Promise<boolean>
  send(params: SendEmailParams): Promise<SendEmailResult>
  validateWebhook(headers: Record<string, string>, body: string): boolean
  parseWebhookEvent(body: unknown): EmailWebhookEvent
  getDomainReputation?(domain: string): Promise<{ score: number; issues: string[] }>
}
