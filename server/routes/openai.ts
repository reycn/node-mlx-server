import { Router, Request, Response } from 'express';
import { ChatCompletionRequestSchema } from '../models/openai-types';
import type {
  ChatCompletionResponse,
  ChatCompletionChunk,
  ChatCompletionUsage,
} from '../models/openai-types';
import { InferenceService, InferenceMessage } from '../services/inference';
import { ModelManager } from '../services/model-manager';
import {
  setSSEHeaders,
  writeSSEData,
  writeSSEDone,
  onClientDisconnect,
} from '../services/stream-utils';
import {
  generateChatCompletionId,
  unixTimestamp,
} from '../utils/id-generator';

export function createOpenAIRouter(
  modelManager: ModelManager,
  inferenceService: InferenceService,
): Router {
  const router = Router();

  /**
   * POST /v1/chat/completions
   * OpenAI-compatible chat completions endpoint.
   */
  router.post('/v1/chat/completions', async (req: Request, res: Response) => {
    // Validate request
    const parseResult = ChatCompletionRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          message: `Invalid request: ${parseResult.error.issues.map((i) => i.message).join(', ')}`,
          type: 'invalid_request_error',
          code: 'invalid_request',
        },
      });
      return;
    }

    const request = parseResult.data;
    const id = generateChatCompletionId();
    const created = unixTimestamp();

    try {
      // Resolve model
      const modelInfo = modelManager.resolveModel(request.model);

      // Convert messages
      const messages: InferenceMessage[] = request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const inferenceOptions = {
        temperature: request.temperature,
        topP: request.top_p,
        maxTokens: request.max_tokens,
        stop: typeof request.stop === 'string'
          ? [request.stop]
          : request.stop,
      };

      if (request.stream) {
        // --- Streaming response ---
        setSSEHeaders(res);

        let aborted = false;
        onClientDisconnect(res, () => {
          aborted = true;
        });

        let completionTokens = 0;
        let isFirstChunk = true;

        for await (const token of inferenceService.generateStream(
          modelInfo,
          messages,
          inferenceOptions,
        )) {
          if (aborted) break;

          const chunk: ChatCompletionChunk = {
            id,
            object: 'chat.completion.chunk',
            created,
            model: request.model,
            choices: [
              {
                index: 0,
                delta: isFirstChunk
                  ? { role: 'assistant', content: token.text }
                  : { content: token.text },
                finish_reason: null,
              },
            ],
          };

          writeSSEData(res, chunk);
          isFirstChunk = false;
          completionTokens++;
        }

        if (!aborted) {
          // Send final chunk with finish_reason
          const finalChunk: ChatCompletionChunk = {
            id,
            object: 'chat.completion.chunk',
            created,
            model: request.model,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: 'stop',
              },
            ],
          };

          // Include usage if requested
          if (request.stream_options?.include_usage) {
            const promptTokens = inferenceService.estimateTokenCount(
              messages.map((m) => m.content).join(' '),
            );
            finalChunk.usage = {
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
              total_tokens: promptTokens + completionTokens,
            };
          }

          writeSSEData(res, finalChunk);
          writeSSEDone(res);
        }
      } else {
        // --- Non-streaming response ---
        const result = await inferenceService.generate(
          modelInfo,
          messages,
          inferenceOptions,
        );

        const response: ChatCompletionResponse = {
          id,
          object: 'chat.completion',
          created,
          model: request.model,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: result.content,
              },
              finish_reason: result.finishReason,
            },
          ],
          usage: {
            prompt_tokens: result.promptTokens,
            completion_tokens: result.completionTokens,
            total_tokens: result.promptTokens + result.completionTokens,
          },
        };

        res.json(response);
      }
    } catch (error) {
      if ((error as Error).name === 'ModelNotFoundError') {
        res.status(404).json({
          error: {
            message: (error as Error).message,
            type: 'invalid_request_error',
            code: 'model_not_found',
          },
        });
        return;
      }
      throw error;
    }
  });

  return router;
}
