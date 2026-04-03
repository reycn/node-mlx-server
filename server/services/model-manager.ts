import * as fs from 'fs';
import * as path from 'path';
import { findCachedModel, listCachedModels, CachedModel } from '../utils/hf-cache';

export interface ModelInfo {
  name: string;
  fullName: string;
  path: string;
  config: Record<string, unknown>;
  tokenizerConfig: Record<string, unknown> | null;
}

/**
 * Manages model discovery and loading from the HuggingFace cache.
 */
export class ModelManager {
  private loadedModels: Map<string, ModelInfo> = new Map();

  /**
   * List all available models in the HuggingFace cache.
   */
  listModels(): CachedModel[] {
    return listCachedModels();
  }

  /**
   * Resolve a model name to a model info object, loading config files.
   * Caches results for subsequent calls.
   */
  resolveModel(modelName: string): ModelInfo {
    // Check if already resolved
    const cached = this.loadedModels.get(modelName);
    if (cached) return cached;

    // Find in HF cache
    const cachedModel = findCachedModel(modelName);
    if (!cachedModel) {
      const available = listCachedModels();
      const modelNames = available.map((m) => m.fullName).join(', ');
      throw new ModelNotFoundError(
        `Model "${modelName}" not found in HuggingFace cache. ` +
          (modelNames
            ? `Available models: ${modelNames}`
            : `No models found in cache. Download models using: huggingface-cli download <model-name>`),
      );
    }

    // Load model config
    const configPath = path.join(cachedModel.snapshotPath, 'config.json');
    if (!fs.existsSync(configPath)) {
      throw new ModelNotFoundError(
        `Model config not found at ${configPath}. The model may be incomplete.`,
      );
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // Load tokenizer config (optional)
    let tokenizerConfig: Record<string, unknown> | null = null;
    const tokenizerConfigPath = path.join(
      cachedModel.snapshotPath,
      'tokenizer_config.json',
    );
    if (fs.existsSync(tokenizerConfigPath)) {
      tokenizerConfig = JSON.parse(
        fs.readFileSync(tokenizerConfigPath, 'utf-8'),
      );
    }

    const modelInfo: ModelInfo = {
      name: cachedModel.name,
      fullName: cachedModel.fullName,
      path: cachedModel.snapshotPath,
      config,
      tokenizerConfig,
    };

    // Cache the resolved model
    this.loadedModels.set(modelName, modelInfo);

    return modelInfo;
  }
}

export class ModelNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelNotFoundError';
  }
}
