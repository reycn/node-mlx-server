import { ModelInfo } from './model-manager';

export interface InferenceMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface InferenceOptions {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  stop?: string[];
}

export interface InferenceResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  finishReason: 'stop' | 'length';
}

/**
 * Core inference service.
 *
 * This provides a placeholder inference implementation that formats chat messages
 * and returns responses. In production, this would integrate with the MLX native
 * bindings for actual model inference with token-by-token generation.
 *
 * The architecture supports both streaming and non-streaming modes via an
 * async generator pattern.
 */
export class InferenceService {
  /**
   * Run non-streaming inference: returns the complete response.
   */
  async generate(
    model: ModelInfo,
    messages: InferenceMessage[],
    options: InferenceOptions = {},
  ): Promise<InferenceResult> {
    const tokens: string[] = [];
    for await (const token of this.generateStream(model, messages, options)) {
      tokens.push(token.text);
    }

    const content = tokens.join('');
    const promptTokens = this.estimateTokenCount(
      messages.map((m) => m.content).join(' '),
    );
    const completionTokens = this.estimateTokenCount(content);

    return {
      content,
      promptTokens,
      completionTokens,
      finishReason: 'stop',
    };
  }

  /**
   * Run streaming inference: yields tokens one at a time.
   *
   * This is an async generator that yields token objects as they are produced.
   * In a full implementation, this would:
   *   1. Tokenize the input using the model's tokenizer
   *   2. Run forward passes through the MLX model
   *   3. Sample from the output distribution
   *   4. Yield each decoded token
   *
   * Currently provides a placeholder that echoes the model/message info.
   */
  async *generateStream(
    model: ModelInfo,
    messages: InferenceMessage[],
    options: InferenceOptions = {},
  ): AsyncGenerator<TokenOutput> {
    // Format the prompt from messages
    const prompt = this.formatChatPrompt(messages);

    // Placeholder: generate a response acknowledging the request
    const response = this.generatePlaceholderResponse(model, messages, options);

    // Simulate token-by-token generation
    const words = response.split(' ');
    for (let i = 0; i < words.length; i++) {
      const text = i === 0 ? words[i] : ' ' + words[i];
      yield {
        text,
        tokenId: i,
        isLast: i === words.length - 1,
      };
    }
  }

  /**
   * Format chat messages into a prompt string.
   * Uses a simple format; in production this would use the model's chat template.
   */
  private formatChatPrompt(messages: InferenceMessage[]): string {
    return messages
      .map((msg) => {
        switch (msg.role) {
          case 'system':
            return `<|system|>\n${msg.content}\n`;
          case 'user':
            return `<|user|>\n${msg.content}\n`;
          case 'assistant':
            return `<|assistant|>\n${msg.content}\n`;
          default:
            return msg.content;
        }
      })
      .join('');
  }

  /**
   * Generate a placeholder response for testing the server infrastructure.
   */
  private generatePlaceholderResponse(
    model: ModelInfo,
    messages: InferenceMessage[],
    options: InferenceOptions,
  ): string {
    const lastMessage = messages[messages.length - 1];
    return (
      `[Model: ${model.fullName}] This is a placeholder response from the MLX inference server. ` +
      `Your message was: "${lastMessage?.content ?? ''}". ` +
      `To enable actual inference, load the model weights using the MLX bindings and implement ` +
      `token generation with the configured parameters ` +
      `(temperature: ${options.temperature ?? 'default'}, ` +
      `max_tokens: ${options.maxTokens ?? 'default'}).`
    );
  }

  /**
   * Rough token count estimation.
   * Uses ~0.75 words-per-token ratio, a common approximation for English text
   * in transformer models. In production, use the actual tokenizer.
   */
  estimateTokenCount(text: string): number {
    const WORDS_PER_TOKEN_RATIO = 0.75;
    return Math.ceil(text.split(/\s+/).length / WORDS_PER_TOKEN_RATIO);
  }
}

export interface TokenOutput {
  text: string;
  tokenId: number;
  isLast: boolean;
}
