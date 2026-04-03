import { createApp } from './app';
import { loadConfig } from './config';
import { getHfCacheDir, listCachedModels } from './utils/hf-cache';

function main(): void {
  const config = loadConfig();
  const app = createApp();

  // Log startup info
  const cacheDir = getHfCacheDir();
  const models = listCachedModels();

  console.log('=== MLX Inference Server ===');
  console.log(`HuggingFace cache: ${cacheDir}`);
  console.log(`Cached models found: ${models.length}`);
  for (const model of models) {
    console.log(`  - ${model.fullName}`);
  }
  console.log('');
  console.log('Endpoints:');
  console.log(`  OpenAI:    POST http://${config.host}:${config.port}/v1/chat/completions`);
  console.log(`  Anthropic: POST http://${config.host}:${config.port}/v1/messages`);
  console.log(`  Ollama:    POST http://${config.host}:${config.port}/api/chat`);
  console.log(`  Models:    GET  http://${config.host}:${config.port}/v1/models`);
  console.log(`  Health:    GET  http://${config.host}:${config.port}/health`);
  console.log('');

  app.listen(config.port, config.host, () => {
    console.log(`Server listening on http://${config.host}:${config.port}`);
  });
}

main();
