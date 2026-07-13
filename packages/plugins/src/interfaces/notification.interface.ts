export interface NotificationPayload {
  recipientId: string
  title: string
  message: string
  urgency: 'low' | 'normal' | 'high' | 'urgent'
  actions?: Array<{
    label: string
    action: string
    data?: string
  }>
  metadata?: Record<string, unknown>
}

export interface INotificationPlugin {
  readonly name: string
  readonly displayName: string
  readonly category: 'notification'

  isConfigured(workspaceId: string): Promise<boolean>
  send(workspaceId: string, payload: NotificationPayload): Promise<void>
  getRecipientId?(userId: string): Promise<string | null>
}
