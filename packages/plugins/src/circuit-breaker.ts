import { createLogger } from '@ai-sales-os/logger'

const logger = createLogger({ name: 'circuit-breaker' })

interface CircuitState {
  failures: number
  lastFailureAt: Date | null
  openUntil: Date | null
}

const states = new Map<string, CircuitState>()

const FAILURE_THRESHOLD = 5
const OPEN_DURATION_MS = 30 * 60 * 1000 // 30 minutes

function getState(pluginName: string): CircuitState {
  if (!states.has(pluginName)) {
    states.set(pluginName, { failures: 0, lastFailureAt: null, openUntil: null })
  }
  return states.get(pluginName)!
}

/** Returns true if the circuit is open (plugin should be skipped) */
export function isCircuitOpen(pluginName: string): boolean {
  const state = getState(pluginName)
  if (!state.openUntil) return false

  if (new Date() > state.openUntil) {
    // Half-open: allow one probe through
    state.openUntil = null
    return false
  }
  return true
}

export function recordSuccess(pluginName: string): void {
  states.set(pluginName, { failures: 0, lastFailureAt: null, openUntil: null })
}

export function recordFailure(pluginName: string): void {
  const state = getState(pluginName)
  state.failures += 1
  state.lastFailureAt = new Date()

  if (state.failures >= FAILURE_THRESHOLD) {
    state.openUntil = new Date(Date.now() + OPEN_DURATION_MS)
    logger.warn({ event: 'circuit_breaker.opened', plugin: pluginName, failures: state.failures })
  }
}

export function getCircuitStatus(pluginName: string): {
  isOpen: boolean
  failures: number
  openUntil: Date | null
} {
  const state = getState(pluginName)
  return {
    isOpen: isCircuitOpen(pluginName),
    failures: state.failures,
    openUntil: state.openUntil,
  }
}
