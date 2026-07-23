/**
 * CompletenessCalculator — data completeness score for a merged company.
 *
 * Points (total possible: 100):
 *   email verified    → 25 pts
 *   phone exists      → 20 pts
 *   website exists    → 15 pts
 *   INN exists        → 20 pts
 *   contact (name+role) → 20 pts
 *
 * Result: 0–100.
 */

import type { MergedCompany } from '../types.js'

const POINTS = {
  emailVerified: 25,
  phone:         20,
  website:       15,
  inn:           20,
  contact:       20,
} as const

export class CompletenessCalculator {
  calculate(company: MergedCompany): number {
    let score = 0

    // email verified — best contact candidate with emailVerified = true
    const hasVerifiedEmail = company.contacts.some((c) => c.emailVerified)
    if (hasVerifiedEmail) score += POINTS.emailVerified

    // phone — legacy field or any contact with phone
    const hasPhone =
      (typeof company.contact?.phone === 'string' && company.contact.phone.trim().length > 0) ||
      company.contacts.some((c) => c.phone && c.phone.trim().length > 0)
    if (hasPhone) score += POINTS.phone

    // website
    const hasWebsite = typeof company.website === 'string' && company.website.trim().length > 0
    if (hasWebsite) score += POINTS.website

    // INN — primary Russian identifier
    const hasInn = typeof company.inn === 'string' && company.inn.trim().length > 0
    if (hasInn) score += POINTS.inn

    // contact with both name and role known
    const hasNamedContact =
      company.contacts.some((c) => c.name !== null && c.role !== null) ||
      (typeof company.contact?.name === 'string' &&
        company.contact.name.trim().length > 0 &&
        typeof company.contact?.role === 'string' &&
        company.contact.role.trim().length > 0)
    if (hasNamedContact) score += POINTS.contact

    return Math.min(100, score)
  }
}
