import express from 'express';
import { createOpenAIRouter } from './routes/openai';
import { createAnthropicRouter } from './routes/anthropic';
import { createOllamaRouter } from './routes/ollama';
import { errorHandler } from './middleware/error-handler';
import { ModelManager } from './services/model-manager';
import { InferenceService } from './services/inference';

/**
 * Create and configure the Express application with all routes.
 */
export function createApp(): express.Application {
  const app = express();

  // Shared services
  const modelManager = new ModelManager();
  const inferenceService = new InferenceService();

  // Middleware
  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // List available models (compatible with multiple API styles)
  app.get('/v1/models', (_req, res) => {
    const models = modelManager.listModels();
    res.json({
      object: 'list',
      data: models.map((m) => ({
        id: m.fullName,
        object: 'model',
        owned_by: m.org,
      })),
    });
  });

  // API routes
  app.use(createOpenAIRouter(modelManager, inferenceService));
  app.use(createAnthropicRouter(modelManager, inferenceService));
  app.use(createOllamaRouter(modelManager, inferenceService));

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}
