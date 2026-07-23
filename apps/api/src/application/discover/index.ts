/**
 * Discover Application Layer — публичный API модуля.
 *
 * Единственный импорт, который нужен route-хендлерам и тестам:
 *
 *   import {
 *     discoverApplicationService,
 *     HuntNotFoundError,
 *     SearchFailedError,
 *   } from '../application/discover/index.js'
 */

export {
  DiscoverApplicationService,
  HuntNotFoundError,
  SearchFailedError,
} from './discover.application-service.js'

export type {
  DiscoverExecuteInput,
  DiscoverResult,
} from './discover.application-service.js'

// ─── Default singleton ────────────────────────────────────────────────────────
//
// Зависимости (HuntService, SearchOrchestrator) внедряются через конструктор.
// Для тестирования — создавай DiscoverApplicationService напрямую с заглушками.
//
import { huntService } from '../../services/hunt.service.js'
import { searchOrchestrator } from '../../search/setup.js'
import { DiscoverApplicationService } from './discover.application-service.js'

export const discoverApplicationService = new DiscoverApplicationService(
  huntService,
  searchOrchestrator,
)
