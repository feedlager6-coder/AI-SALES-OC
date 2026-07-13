export interface EmailFinderParams {
  workspaceId: string
  domain?: string
  companyName?: string
  firstName?: string
  lastName?: string
  title?: string
}

export interface EmailFinderResult {
  email?: string
  confidence: number // 0.0 – 1.0
  source: string
  verificationStatus?: 'valid' | 'invalid' | 'catch_all' | 'unknown'
  allEmails?: Array<{
    email: string
    confidence: number
    firstName?: string
    lastName?: string
    title?: string
  }>
}

export interface IEmailFinderPlugin {
  readonly name: string
  readonly displayName: string
  readonly category: 'email_finder'
  readonly costPerLookup?: number // USD

  isConfigured(workspaceId: string): Promise<boolean>
  findEmail(params: EmailFinderParams): Promise<EmailFinderResult>
  verifyEmail?(email: string): Promise<{ status: string; score: number }>
  getRemainingCredits?(): Promise<number>
}
