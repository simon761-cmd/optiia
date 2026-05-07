import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

import { PrismaService } from '../common/prisma/prisma.service';
import { QuotaService } from './quota.service';

export interface LlmCompletionParams {
  tenantId: string;
  userId?: string;
  feature: string;
  promptVersion?: string;
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  toolChoice?: 'auto' | 'required' | 'none';
  model?: 'default' | 'advanced' | 'vision';
  responseFormat?: { type: 'json_object' } | { type: 'json_schema'; json_schema: any } | { type: 'text' };
  temperature?: number;
  maxTokens?: number;
}

export interface LlmCompletionResult {
  content: string | null;
  toolCalls: any[];
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  model: string;
  raw: any;
}

// Tarifs au 1000 tokens (à mettre à jour selon les prix OpenAI courants)
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o':      { input: 0.0025,  output: 0.01 },
};

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private client: OpenAI;
  private modelDefault: string;
  private modelAdvanced: string;
  private modelVision: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private quota: QuotaService,
  ) {
    this.client = new OpenAI({
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
    });
    this.modelDefault = config.get<string>('OPENAI_MODEL_DEFAULT') ?? 'gpt-4o-mini';
    this.modelAdvanced = config.get<string>('OPENAI_MODEL_ADVANCED') ?? 'gpt-4o';
    this.modelVision = config.get<string>('OPENAI_MODEL_VISION') ?? 'gpt-4o';
  }

  /**
   * Appel non-stream avec quota + logging.
   */
  async complete(params: LlmCompletionParams): Promise<LlmCompletionResult> {
    await this.quota.assertCanCall(params.tenantId);

    const model = this.resolveModel(params.model);
    const start = Date.now();

   let result: LlmCompletionResult | undefined;
    let success = true;
    let errorCode: string | undefined;

    try {
      const completion = await this.callWithRetry(() =>
        this.client.chat.completions.create({
          model,
          messages: params.messages,
          tools: params.tools,
          tool_choice: params.toolChoice,
          response_format: params.responseFormat as any,
          temperature: params.temperature ?? 0.4,
          max_tokens: params.maxTokens,
        }),
      );

      const choice = completion.choices[0];
      const usage = completion.usage!;
      const costUsd = this.computeCost(model, usage.prompt_tokens, usage.completion_tokens);

      result = {
        content: choice.message.content,
        toolCalls: choice.message.tool_calls ?? [],
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        costUsd,
        model,
        raw: completion,
      };
    } catch (err: any) {
      success = false;
      errorCode = err.code ?? err.name ?? 'UNKNOWN';
      this.logger.error(`LLM call failed for tenant=${params.tenantId}: ${err.message}`);
      throw new ServiceUnavailableException('AI service temporarily unavailable');
    } finally {
      const latencyMs = Date.now() - start;
      // Log + decompte quota (en best-effort, ne bloque pas)
      void this.logCall({
        tenantId: params.tenantId,
        userId: params.userId,
        feature: params.feature,
        model,
        promptTokens: result?.promptTokens ?? 0,
        completionTokens: result?.completionTokens ?? 0,
        costUsd: result?.costUsd ?? 0,
        latencyMs,
        success,
        errorCode,
        promptVersion: params.promptVersion,
      });

      if (success && result!) {
        void this.quota.recordUsage(params.tenantId, result!.costUsd);
      }
    }

    return result!;
  }

  /**
   * Stream pour le chat. Retourne un AsyncIterable de deltas + un finalizer pour totaux.
   */
  async *stream(params: LlmCompletionParams): AsyncGenerator<
    | { type: 'delta'; content: string }
    | { type: 'tool_call'; toolCall: any }
    | { type: 'done'; usage: { promptTokens: number; completionTokens: number; costUsd: number; model: string } }
  > {
    await this.quota.assertCanCall(params.tenantId);
    const model = this.resolveModel(params.model);
    const start = Date.now();

    const stream = await this.client.chat.completions.create({
      model,
      messages: params.messages,
      tools: params.tools,
      tool_choice: params.toolChoice,
      stream: true,
      stream_options: { include_usage: true },
      temperature: params.temperature ?? 0.4,
      max_tokens: params.maxTokens,
    });

    const accumulatedToolCalls = new Map<number, any>();
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          yield { type: 'delta', content: delta.content };
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = accumulatedToolCalls.get(tc.index) ?? {
              id: '',
              type: 'function',
              function: { name: '', arguments: '' },
            };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.function.name = tc.function.name;
            if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
            accumulatedToolCalls.set(tc.index, existing);
          }
        }
        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens;
          completionTokens = chunk.usage.completion_tokens;
        }
      }

      // Émettre les tool_calls accumulés à la fin si présents
      for (const tc of accumulatedToolCalls.values()) {
        yield { type: 'tool_call', toolCall: tc };
      }

      const costUsd = this.computeCost(model, promptTokens, completionTokens);
      yield { type: 'done', usage: { promptTokens, completionTokens, costUsd, model } };

      void this.logCall({
        tenantId: params.tenantId,
        userId: params.userId,
        feature: params.feature,
        model,
        promptTokens,
        completionTokens,
        costUsd,
        latencyMs: Date.now() - start,
        success: true,
        promptVersion: params.promptVersion,
      });
      void this.quota.recordUsage(params.tenantId, costUsd);
    } catch (err: any) {
      this.logger.error(`Stream failed: ${err.message}`);
      void this.logCall({
        tenantId: params.tenantId,
        userId: params.userId,
        feature: params.feature,
        model,
        promptTokens,
        completionTokens,
        costUsd: 0,
        latencyMs: Date.now() - start,
        success: false,
        errorCode: err.code ?? 'STREAM_FAIL',
        promptVersion: params.promptVersion,
      });
      throw err;
    }
  }

  /**
   * Vision (OCR ordonnance). Schema strict via response_format.
   */
  async vision<T = any>(params: {
    tenantId: string;
    userId?: string;
    feature: string;
    promptVersion?: string;
    systemPrompt: string;
    imageUrl: string; // peut être data URL ou URL S3 signée
    schema: any;
  }): Promise<T> {
    const result = await this.complete({
      tenantId: params.tenantId,
      userId: params.userId,
      feature: params.feature,
      promptVersion: params.promptVersion,
      model: 'vision',
      responseFormat: {
        type: 'json_schema',
        json_schema: { name: 'ocr_result', strict: true, schema: params.schema },
      },
      temperature: 0,
      messages: [
        { role: 'system', content: params.systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyse cette ordonnance et extrais les données structurées.' },
            { type: 'image_url', image_url: { url: params.imageUrl, detail: 'high' } },
          ],
        },
      ],
    });

    if (!result.content) throw new Error('Empty vision response');
    return JSON.parse(result.content) as T;
  }

  // ---------- helpers ----------

  private resolveModel(kind?: 'default' | 'advanced' | 'vision'): string {
    switch (kind) {
      case 'advanced': return this.modelAdvanced;
      case 'vision':   return this.modelVision;
      default:         return this.modelDefault;
    }
  }

  private computeCost(model: string, promptTokens: number, completionTokens: number): number {
    const p = PRICING[model] ?? PRICING['gpt-4o-mini'];
    return (promptTokens / 1000) * p.input + (completionTokens / 1000) * p.output;
  }

  private async callWithRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err: any) {
        lastErr = err;
        const status = err?.status ?? err?.response?.status;
        if (status === 429 || (status >= 500 && status < 600)) {
          const delay = 500 * 2 ** i + Math.random() * 200;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  private async logCall(data: {
    tenantId: string;
    userId?: string;
    feature: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    costUsd: number;
    latencyMs: number;
    success: boolean;
    errorCode?: string;
    promptVersion?: string;
  }) {
    try {
      await this.prisma.aiCallLog.create({ data });
    } catch (err) {
      this.logger.warn(`Failed to write AI log: ${(err as Error).message}`);
    }
  }
}
