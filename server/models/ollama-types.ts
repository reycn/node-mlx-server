import { z } from 'zod';

// --- Request Schemas ---

export const OllamaMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

export const OllamaChatRequestSchema = z.object({
  model: z.string(),
  messages: z.array(OllamaMessageSchema).min(1),
  stream: z.boolean().optional().default(true),
  options: z
    .object({
      temperature: z.number().optional(),
      top_p: z.number().optional(),
      top_k: z.number().optional(),
      num_predict: z.number().optional(),
      stop: z.array(z.string()).optional(),
    })
    .optional(),
});

// --- Response Types ---

export interface OllamaChatResponseMessage {
  role: 'assistant';
  content: string;
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: OllamaChatResponseMessage;
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

// --- Inferred Request Type ---

export type OllamaChatRequest = z.infer<typeof OllamaChatRequestSchema>;
export type OllamaMessage = z.infer<typeof OllamaMessageSchema>;
