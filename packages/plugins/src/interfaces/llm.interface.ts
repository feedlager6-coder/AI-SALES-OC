export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMCallParams {
  messages: LLMMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  responseFormat?: 'text' | 'json_object'
  stream?: boolean
}

export interface LLMCallResult {
  content: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  latencyMs: number
}

export interface ILLMPlugin {
  readonly name: string
  readonly displayName: string
  readonly category: 'llm'
  readonly defaultModel: string
  readonly models: string[]

  isConfigured(workspaceId: string): Promise<boolean>
  call(params: LLMCallParams): Promise<LLMCallResult>
  stream?(params: LLMCallParams): AsyncIterable<string>
  estimateCost(inputTokens: number, outputTokens: number, model: string): number
}
