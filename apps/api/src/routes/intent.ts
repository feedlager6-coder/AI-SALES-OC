import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { intentService } from '../services/intent.service.js'

const ParseIntentBodySchema = z.object({
  query: z.string().min(1, 'Query must not be empty').max(500),
})

export const intentRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/v1/intent/parse
   *
   * Parses a natural-language search query into structured intent fields.
   * Currently uses RuleBasedIntentParser (no AI, no external calls).
   *
   * Request:  { query: string }
   * Response: { industry, region, companySize, clarifyingQuestion }
   */
  app.post('/parse', async (request, reply) => {
    const { query } = ParseIntentBodySchema.parse(request.body)
    const result = intentService.parse(query)
    return reply.status(200).send(result)
  })
}
