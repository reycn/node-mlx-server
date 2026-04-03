import { Router, Request, Response } from 'express';
import { MessagesRequestSchema } from '../models/anthropic-types';
import type {
  MessagesResponse,
  AnthropicContentBlock,
  AnthropicUsage,
} from '../models/anthropic-types';
import { InferenceService, InferenceMessage } from '../services/inference';
import { ModelManager } from '../services/model-manager';
import {
  setSSEHeaders,
  writeSSEEvent,
  onClientDisconnect,
} from '../services/stream-utils';
import { generateMessageId } from '../utils/id-generator';

export function createAnthropicRouter(
  modelManager: ModelManager,
  inferenceService: InferenceService,
): Router {
  const router = Router();

  /**
   * POST /v1/messages
   * Anthropic-compatible messages endpoint.
   */
  router.post('/v1/messages', async (req: Request, res: Response) => {
    // Validate request
    const parseResult = MessagesRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: `Invalid request: ${parseResult.error.issues.map((i) => i.message).join(', ')}`,
        },
      });
      return;
    }

    const request = parseResult.data;
    const id = generateMessageId();

    try {
      // Resolve model
      const modelInfo = modelManager.resolveModel(request.model);

      // Convert messages, prepending system message if provided
      const messages: InferenceMessage[] = [];
      if (request.system) {
        messages.push({ role: 'system', content: request.system });
      }
      for (const msg of request.messages) {
        const content =
          typeof msg.content === 'string'
            ? msg.content
            : msg.content.map((b) => b.text).join('');
        messages.push({ role: msg.role, content });
      }

      const inferenceOptions = {
        temperature: request.temperature,
        topP: request.top_p,
        topK: request.top_k,
        maxTokens: request.max_tokens,
        stop: request.stop_sequences,
      };

      if (request.stream) {
        // --- Streaming response ---
        setSSEHeaders(res);

        let aborted = false;
        onClientDisconnect(res, () => {
          aborted = true;
        });

        // 1. message_start
        const inputTokens = inferenceService.estimateTokenCount(
          messages.map((m) => m.content).join(' '),
        );
        writeSSEEvent(res, 'message_start', {
          type: 'message_start',
          message: {
            id,
            type: 'message',
            role: 'assistant',
            model: request.model,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: inputTokens,
              output_tokens: 0,
            },
          },
        });

        // 2. content_block_start
        writeSSEEvent(res, 'content_block_start', {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        });

        // 3. ping
        writeSSEEvent(res, 'ping', { type: 'ping' });

        // 4. Stream content_block_delta events
        let outputTokens = 0;

        for await (const token of inferenceService.generateStream(
          modelInfo,
          messages,
          inferenceOptions,
        )) {
          if (aborted) break;

          writeSSEEvent(res, 'content_block_delta', {
            type: 'content_block_delta',
            index: 0,
            delta: {
              type: 'text_delta',
              text: token.text,
            },
          });
          outputTokens++;
        }

        if (!aborted) {
          // 5. content_block_stop
          writeSSEEvent(res, 'content_block_stop', {
            type: 'content_block_stop',
            index: 0,
          });

          // 6. message_delta
          writeSSEEvent(res, 'message_delta', {
            type: 'message_delta',
            delta: {
              stop_reason: 'end_turn',
              stop_sequence: null,
            },
            usage: {
              output_tokens: outputTokens,
            },
          });

          // 7. message_stop
          writeSSEEvent(res, 'message_stop', { type: 'message_stop' });

          res.end();
        }
      } else {
        // --- Non-streaming response ---
        const result = await inferenceService.generate(
          modelInfo,
          messages,
          inferenceOptions,
        );

        const response: MessagesResponse = {
          id,
          type: 'message',
          role: 'assistant',
          model: request.model,
          content: [{ type: 'text', text: result.content }],
          stop_reason: result.finishReason === 'stop' ? 'end_turn' : 'max_tokens',
          stop_sequence: null,
          usage: {
            input_tokens: result.promptTokens,
            output_tokens: result.completionTokens,
          },
        };

        res.json(response);
      }
    } catch (error) {
      if ((error as Error).name === 'ModelNotFoundError') {
        res.status(404).json({
          type: 'error',
          error: {
            type: 'not_found_error',
            message: (error as Error).message,
          },
        });
        return;
      }
      throw error;
    }
  });

  return router;
}
