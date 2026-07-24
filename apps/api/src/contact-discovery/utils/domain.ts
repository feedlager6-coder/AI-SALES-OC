/**
 * Utility: extract a clean domain from any website URL or raw domain string.
 * Strips protocol, www, trailing slashes and paths.
 */
export function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null
  try {
    const url = website.startsWith('http') ? website : `https://${website}`
    const hostname = new URL(url).hostname
    return hostname.replace(/^www\./, '') || null
  } catch {
    // Fallback: strip manually
    const cleaned = website
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      ?.trim()
    return cleaned?.length ? cleaned : null
  }
}
