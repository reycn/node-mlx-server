import { Router, Request, Response } from 'express';
import { OllamaChatRequestSchema } from '../models/ollama-types';
import type { OllamaChatResponse } from '../models/ollama-types';
import { InferenceService, InferenceMessage } from '../services/inference';
import { ModelManager } from '../services/model-manager';
import { writeNDJSON, onClientDisconnect } from '../services/stream-utils';

export function createOllamaRouter(
  modelManager: ModelManager,
  inferenceService: InferenceService,
): Router {
  const router = Router();

  /**
   * POST /api/chat
   * Ollama-compatible chat endpoint.
   */
  router.post('/api/chat', async (req: Request, res: Response) => {
    // Validate request
    const parseResult = OllamaChatRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: `Invalid request: ${parseResult.error.issues.map((i) => i.message).join(', ')}`,
      });
      return;
    }

    const request = parseResult.data;

    try {
      // Resolve model
      const modelInfo = modelManager.resolveModel(request.model);

      // Convert messages
      const messages: InferenceMessage[] = request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const inferenceOptions = {
        temperature: request.options?.temperature,
        topP: request.options?.top_p,
        topK: request.options?.top_k,
        maxTokens: request.options?.num_predict,
        stop: request.options?.stop,
      };

      if (request.stream) {
        // --- Streaming response (newline-delimited JSON) ---
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let aborted = false;
        onClientDisconnect(res, () => {
          aborted = true;
        });

        const startTime = Date.now();

        for await (const token of inferenceService.generateStream(
          modelInfo,
          messages,
          inferenceOptions,
        )) {
          if (aborted) break;

          const chunk: OllamaChatResponse = {
            model: request.model,
            created_at: new Date().toISOString(),
            message: {
              role: 'assistant',
              content: token.text,
            },
            done: false,
          };

          writeNDJSON(res, chunk);
        }

        if (!aborted) {
          // Send final done message
          const totalDuration = (Date.now() - startTime) * 1_000_000; // Convert to nanoseconds
          const doneResponse: OllamaChatResponse = {
            model: request.model,
            created_at: new Date().toISOString(),
            message: {
              role: 'assistant',
              content: '',
            },
            done: true,
            done_reason: 'stop',
            total_duration: totalDuration,
          };

          writeNDJSON(res, doneResponse);
          res.end();
        }
      } else {
        // --- Non-streaming response ---
        const startTime = Date.now();
        const result = await inferenceService.generate(
          modelInfo,
          messages,
          inferenceOptions,
        );
        const totalDuration = (Date.now() - startTime) * 1_000_000;

        const response: OllamaChatResponse = {
          model: request.model,
          created_at: new Date().toISOString(),
          message: {
            role: 'assistant',
            content: result.content,
          },
          done: true,
          done_reason: result.finishReason,
          total_duration: totalDuration,
          prompt_eval_count: result.promptTokens,
          eval_count: result.completionTokens,
        };

        res.json(response);
      }
    } catch (error) {
      if ((error as Error).name === 'ModelNotFoundError') {
        res.status(404).json({
          error: (error as Error).message,
        });
        return;
      }
      throw error;
    }
  });

  return router;
}
