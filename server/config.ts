/**
 * Server configuration resolved from environment variables with defaults.
 */
export interface ServerConfig {
  /** Port to listen on */
  port: number;
  /** Host to bind to */
  host: string;
  /** HuggingFace cache directory override */
  hfCacheDir?: string;
}

export function loadConfig(): ServerConfig {
  return {
    port: parseInt(process.env.MLX_PORT ?? '11434', 10),
    host: process.env.MLX_HOST ?? '0.0.0.0',
    hfCacheDir: process.env.HUGGINGFACE_HUB_CACHE ?? process.env.HF_HOME,
  };
}
