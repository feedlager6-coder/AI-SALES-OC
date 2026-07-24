/**
 * ContactRanker — sorts ContactCandidate[] by confidence DESC and returns max 3.
 *
 * Confidence table (hard-coded as per spec):
 *   CEO / Генеральный директор         → 90
 *   Коммерческий директор              → 85
 *   Директор профильного отдела        → 80
 *   Менеджер по продажам               → 60
 *   HR / неизвестная роль              → 30
 *   info@ без роли                     → 20
 *
 * These values are applied as confidence overrides when a candidate's role
 * maps exactly to one of the known role categories. Step-level confidence is
 * used when no role override applies (e.g. email found without role context).
 */
import type { ContactCandidate } from '../search/types.js'

const MAX_CANDIDATES = 3

// Role-based confidence overrides — applied if candidate has a role matching these keywords
const ROLE_CONFIDENCE_MAP: Array<{ patterns: RegExp[]; confidence: number }> = [
  {
    patterns: [/генеральный директор/i, /ceo/i, /chief executive/i],
    confidence: 90,
  },
  {
    patterns: [/коммерческий директор/i, /commercial director/i],
    confidence: 85,
  },
  {
    patterns: [/директор/i, /director/i, /руководитель/i, /head of/i],
    confidence: 80,
  },
  {
    patterns: [/менеджер по продажам/i, /sales manager/i, /менеджер/i],
    confidence: 60,
  },
  {
    patterns: [/hr/i, /рекрутер/i, /recruiter/i],
    confidence: 30,
  },
]

function roleConfidence(role: string | null): number | null {
  if (!role) return null
  for (const entry of ROLE_CONFIDENCE_MAP) {
    if (entry.patterns.some((p) => p.test(role))) {
      return entry.confidence
    }
  }
  return null
}

function adjustedConfidence(candidate: ContactCandidate): number {
  // Generic addresses (info@, sales@, hello@) always use step confidence
  if (/^(info|sales|hello|support|noreply|no-reply)@/i.test(candidate.email)) {
    return candidate.confidence // typically 20
  }

  // Role-based override if available
  const roleCf = roleConfidence(candidate.role)
  if (roleCf !== null) {
    // If email is verified, cap at min(role_confidence + 15, 100)
    return candidate.emailVerified ? Math.min(100, roleCf + 15) : roleCf
  }

  // No role → use step confidence, with a bonus for verified emails
  return candidate.emailVerified
    ? Math.min(100, candidate.confidence + 10)
    : candidate.confidence
}

function deduplicateByEmail(candidates: ContactCandidate[]): ContactCandidate[] {
  const seen = new Map<string, ContactCandidate>()
  for (const candidate of candidates) {
    const key = candidate.email.toLowerCase().trim()
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, candidate)
    } else {
      // Keep the one with higher confidence
      if (adjustedConfidence(candidate) > adjustedConfidence(existing)) {
        seen.set(key, candidate)
      }
    }
  }
  return [...seen.values()]
}

export class ContactRanker {
  /**
   * Sort candidates by effective confidence DESC, deduplicate by email,
   * and return the top MAX_CANDIDATES (3).
   */
  rank(candidates: ContactCandidate[]): ContactCandidate[] {
    if (candidates.length === 0) return []

    const deduplicated = deduplicateByEmail(candidates)

    return deduplicated
      .map((c) => ({
        candidate: c,
        effectiveConfidence: adjustedConfidence(c),
      }))
      .sort((a, b) => b.effectiveConfidence - a.effectiveConfidence)
      .slice(0, MAX_CANDIDATES)
      .map(({ candidate, effectiveConfidence }) => ({
        ...candidate,
        confidence: effectiveConfidence,
      }))
  }
}
