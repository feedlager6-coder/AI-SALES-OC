/**
 * Search layer types — shared between SearchOrchestrator, SearchProviders,
 * RankingEngine, and the HTTP response body of POST /api/v1/hunts/:id/search.
 *
 * Frontend receives SearchResult as JSON and renders it without knowing anything
 * about providers, orchestration, or ranking internals.
 *
 * V4 additions are additive — all existing exports are preserved.
 */

// ---------------------------------------------------------------------------
// Signal domain model (V4)
// ---------------------------------------------------------------------------

/**
 * All signal types. Positive signals indicate buying intent; negative signals
 * reduce icpScore and surface warnings to the user.
 */
export type SignalType =
  // Positive — hiring
  | 'hiring'
  | 'hiring_role_match'
  // Positive — commercial activity
  | 'contract_won'
  | 'contract_active'
  // Positive — growth indicators
  | 'expanding'
  | 'growing'
  | 'funding'
  | 'new_business'
  // Positive — relationship signals
  | 'client_fit'
  | 'news_event'
  | 'leadership_change'
  // Negative — risk signals (reduce icpScore, shown as warnings)
  | 'financial_risk'
  | 'leadership_instability'
  | 'activity_decline'

export type SignalSource =
  | 'hhru'
  | '2gis'
  | 'gosreg'
  | 'dadata'
  | 'website'
  | 'news'
  | 'fssp'
  | 'kontur'

/**
 * Base weight for each signal type.
 * TimingScoreCalculator multiplies this by recencyMultiplier (0.2–1.0).
 */
export const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  hiring: 70,
  hiring_role_match: 85,
  contract_won: 80,
  contract_active: 60,
  expanding: 75,
  growing: 50,
  funding: 90,
  new_business: 45,
  client_fit: 70,
  news_event: 40,
  leadership_change: 65,
  financial_risk: 80,
  leadership_instability: 65,
  activity_decline: 55,
}

/**
 * Default confidence level for signals from each source.
 * Individual signals may override this if they have direct verification.
 */
export const SOURCE_CONFIDENCE: Record<SignalSource, number> = {
  dadata: 95,
  gosreg: 95,
  fssp: 95,
  kontur: 90,
  hhru: 85,
  '2gis': 70,
  website: 60,
  news: 50,
}

/**
 * Full V4 Signal — the canonical domain model.
 * Replaces the legacy CompanySignal (which had only label + type).
 */
export interface Signal {
  type: SignalType
  /** Human-readable description shown to the user, e.g. "Наняли 3 водителя на этой неделе" */
  label: string
  source: SignalSource
  /** When the underlying event happened (not when we detected it). Null if source has no date. */
  eventDate: Date | null
  /** When we detected this signal. Used for recency calculation. */
  detectedAt: Date
  /** Base weight from SIGNAL_WEIGHTS, may be adjusted by SignalEngine for context */
  weight: number
  /** How confident we are in this signal (0–100) */
  confidence: number
  /**
   * Source-specific details for AI Context Builder.
   * hiring:   { role: string, count: number, salaryFrom: number | null }
   * contract: { amount: number, customer: string, category: string }
   * news:     { headline: string, url: string }
   */
  metadata: Record<string, unknown> | null
}

// ---------------------------------------------------------------------------
// Legacy signal type — kept for backward compatibility
// ---------------------------------------------------------------------------

/** @deprecated Use Signal instead. Kept for existing code that reads CompanySignal. */
export interface CompanySignal {
  label: string
  type: SignalType
}

// ---------------------------------------------------------------------------
// Contact Discovery (V4)
// ---------------------------------------------------------------------------

export type ContactSource =
  | 'dadata'
  | 'website'
  | 'hhru'
  | 'hunter'
  | 'snov'
  | 'pattern'
  | 'generic'

/**
 * A contact candidate produced by the Contact Discovery waterfall.
 * Multiple candidates may exist per company; ContactRanker selects the best.
 *
 * Confidence table:
 *   CEO / Генеральный директор  → 90
 *   Коммерческий директор       → 85
 *   Директор профильного отдела → 80
 *   Менеджер по продажам        → 60
 *   HR / неизвестная роль       → 30
 *   info@ без роли              → 20
 */
export interface ContactCandidate {
  name: string | null
  role: string | null
  email: string
  emailVerified: boolean
  phone: string | null
  source: ContactSource
  /** 0–100. ContactRanker sorts by this DESC and returns max 3 candidates. */
  confidence: number
}

// ---------------------------------------------------------------------------
// Legacy contact type — kept for backward compatibility
// ---------------------------------------------------------------------------

/** @deprecated Use ContactCandidate instead. */
export interface CompanyContact {
  name: string
  role: string
  email: string
  phone: string
}

// ---------------------------------------------------------------------------
// Field provenance
// ---------------------------------------------------------------------------

/**
 * Records which provider supplied each field on a merged company.
 * Used for debugging dedup decisions and for AI Context Builder.
 */
export interface FieldProvenance {
  legalName?: SignalSource | string
  tradeName?: SignalSource | string
  inn?: SignalSource | string
  ogrn?: SignalSource | string
  phone?: SignalSource | string
  website?: SignalSource | string
  email?: SignalSource | string
  description?: SignalSource | string
  size?: SignalSource | string
  address?: SignalSource | string
}

// ---------------------------------------------------------------------------
// Company workspace status (V4)
// ---------------------------------------------------------------------------

/**
 * Simplified view of a company's lifecycle within a workspace.
 * Derived from the full companyStatusEnum in the DB schema.
 *
 * Mapping from DB status:
 *   'new' | 'enriching' | 'enriched' | 'qualified'   → 'new'
 *   'contacted' | 'replied'                           → 'contacted'
 *   'meeting' | 'proposal' | 'negotiation'            → 'in_pipeline'
 *   'won' | 'closed_lost' | 'paused_30d' | 'opted_out'→ 'closed'
 */
export type WorkspaceStatus = 'new' | 'contacted' | 'in_pipeline' | 'closed'

// ---------------------------------------------------------------------------
// Search company types
// ---------------------------------------------------------------------------

/**
 * Base company shape returned from search providers.
 * Preserved as-is for backward compatibility.
 */
export interface SearchCompany {
  id: string

  /**
   * Russian Tax ID (ИНН). Primary deduplication key across providers —
   * a company with a known INN will never appear twice even if two providers
   * return it independently.
   */
  inn?: string | null

  /**
   * Company website / domain (without protocol), e.g. "stroygrupp.ru".
   * Secondary deduplication key when INN is absent.
   */
  website?: string | null

  name: string
  industry: string
  region: string
  /** Human-readable size, e.g. "50–200 сотрудников" */
  size: string
  description: string
  /** @deprecated Use contacts (ContactCandidate[]) from RankedCompany instead. */
  contact: CompanyContact
  /** @deprecated Use signals (Signal[]) from RankedCompany instead. */
  signals: CompanySignal[]
  foundedYear?: number
}

/**
 * V4 ranked company — extends SearchCompany with scoring, full signals,
 * contacts, provenance, and workspace context.
 *
 * NOTE: icpScore, timingScore, finalScore are NOT sent to the frontend.
 * Only order and badge data (signal labels, workspaceStatus) are visible to users.
 */
export interface RankedCompany extends SearchCompany {
  /** ICP fit score (0–100). Not shown to user. */
  icpScore: number
  /** Timing score based on signal recency (0–100). Not shown to user. */
  timingScore: number
  /** finalScore = icpScore*0.6 + timingScore*0.3 + completeness*0.1. Not shown to user. */
  finalScore: number
  /** Full V4 signal objects with dates, weights, confidence. Shown as badges. */
  signalsV4: Signal[]
  /** Contact candidates from the waterfall, sorted by confidence DESC. Max 3. */
  contacts: ContactCandidate[]
  /** Which provider supplied each field. */
  sources: FieldProvenance
  /** AI Context Brief — only populated if explicitly requested before email generation. */
  brief?: CompanyBrief
  /** True if this company already exists in the workspace's company registry. */
  existsInWorkspace: boolean
  /** Simplified lifecycle status derived from DB company status. */
  workspaceStatus: WorkspaceStatus
  /** Alternative names collected during dedup (ребрендинг, trade vs legal name). */
  aliases: string[]
}

// ---------------------------------------------------------------------------
// Search plan (V4)
// ---------------------------------------------------------------------------

export interface ProviderPlanEntry {
  providerId: string
  tier: 1 | 2 | 3
  /** Provider-specific query parameters (varies by provider) */
  query: Record<string, unknown>
}

export interface SearchPlan {
  tier1: ProviderPlanEntry[] // Directory providers: 2GIS, HH.ru — run immediately
  tier2: ProviderPlanEntry[] // Registry providers: Госзакупки, Dadata, ФССП — run concurrently with tier1
  tier3: ProviderPlanEntry[] // Async providers: website scraping — run after response is sent
}

export interface SearchPlanSummary {
  providersQueried: string[]
  providersSucceeded: string[]
  providersFailed: string[]
  totalRaw: number
  afterDedup: number
  afterFilter: number
  processingMs: number
}

// ---------------------------------------------------------------------------
// Search params (V4 — extends existing SearchParams)
// ---------------------------------------------------------------------------

export interface SearchParams {
  rawQuery: string
  industry: string | null
  region: string | null
  companySize: string | null
  clarifyingAnswer: string | null
  /** Signal types the user explicitly wants to see (from LLM intent parse). */
  signals_wanted?: SignalType[]
  /** Signal types the user explicitly wants to exclude. */
  exclude_signals?: SignalType[]
}

// ---------------------------------------------------------------------------
// Parsed intent (V4)
// ---------------------------------------------------------------------------

export interface ParsedIntent {
  industry: string | null
  region: string | null
  companySize: string | null
  /** Signals the user cares about (e.g. "hiring", "contract_won") */
  signals_wanted: SignalType[]
  /** Signals to filter out (e.g. "financial_risk") */
  exclude_signals: SignalType[]
  /**
   * Returned when the query is ambiguous. If non-null, the route returns this
   * to the client without running search. Client re-submits with chosen option.
   */
  clarifyingQuestion: {
    text: string
    options: string[]
  } | null
  raw: string
}

// ---------------------------------------------------------------------------
// Rejection feedback (V4)
// ---------------------------------------------------------------------------

export type RejectionReason =
  | 'wrong_region'
  | 'wrong_size'
  | 'already_client'
  | 'liquidated'
  | 'other'

export interface RejectionFeedback {
  companyId: string
  reason: RejectionReason
  huntId: string
  createdAt: string // ISO date string
}

// ---------------------------------------------------------------------------
// AI Context Builder (V4)
// ---------------------------------------------------------------------------

/**
 * Structured brief passed to the LLM for email generation.
 * Built by AIContextBuilder from all available company data.
 *
 * If whyThisCompany is empty AND triggerEvent is null, the brief must NOT
 * be generated — return an INSUFFICIENT_DATA error to the user instead.
 */
export interface CompanyBrief {
  company: {
    name: string
    legalName: string | null
    industry: string
    region: string
    size: string | null
    description: string
    website: string | null
    foundedYear: number | null
  }
  contact: {
    name: string | null
    role: string | null
    email: string
    /** 0–100. Used by the LLM to decide how confidently to address the contact. */
    confidence: number
  }
  /** Concrete facts about the company. Not templates. Min 1 item required. */
  whyThisCompany: string[]
  /** The single strongest recent signal — the primary reason for reaching out. */
  triggerEvent: {
    type: SignalType
    label: string
    eventDate: Date | null
    weight: number
  } | null
  /** From Контур.Фокус. Null if not connected — does not block generation. */
  financialContext: {
    revenueGrowthPct: number | null
    riskScore: number | null
    lastReportYear: number | null
  } | null
  /** Industry knowledge base context. Null if not available. */
  industryContext: {
    currentTrends: string[]
    seasonality: string | null
  } | null
  /** From workspace sender profile. Always required. */
  senderContext: {
    productDescription: string
    targetRole: string
    usp: string
    previousWins: string[]
  }
  /** From DB: has this company been contacted before in this workspace? */
  previousContact: {
    contacted: boolean
    lastDate: string | null // ISO date string
    outcome: 'no_reply' | 'replied' | 'not_interested' | null
  }
}

// ---------------------------------------------------------------------------
// Search result
// ---------------------------------------------------------------------------

/**
 * HTTP response body for POST /api/v1/hunts/:id/search.
 *
 * Legacy shape — used by existing providers and the current orchestrator.
 * Pass 2 will transition the orchestrator to return SearchResultV4.
 */
export interface SearchResult {
  companies: SearchCompany[]
  totalFound: number
  query: SearchParams
  plan?: SearchPlanSummary
}

/**
 * V4 shape returned by V4RankingEngine and the updated orchestrator (Pass 2).
 * RankedCompany extends SearchCompany, so read-side code that only accesses
 * SearchCompany fields continues to work without changes.
 */
export interface SearchResultV4 {
  companies: RankedCompany[]
  totalFound: number
  query: SearchParams
  plan: SearchPlanSummary
}
