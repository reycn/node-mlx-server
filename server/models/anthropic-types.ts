import { z } from 'zod';

// --- Request Schemas ---

const AnthropicContentBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

export const AnthropicMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(AnthropicContentBlockSchema)]),
});

export const MessagesRequestSchema = z.object({
  model: z.string(),
  max_tokens: z.number().int().positive(),
  messages: z.array(AnthropicMessageSchema).min(1),
  system: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  top_p: z.number().min(0).max(1).optional(),
  top_k: z.number().int().positive().optional(),
  stream: z.boolean().optional().default(false),
  stop_sequences: z.array(z.string()).optional(),
});

// --- Response Types ---

export interface AnthropicContentBlock {
  type: 'text';
  text: string;
}

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface MessagesResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: AnthropicContentBlock[];
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
  stop_sequence: string | null;
  usage: AnthropicUsage;
}

// --- Streaming Event Types ---

export interface MessageStartEvent {
  type: 'message_start';
  message: Omit<MessagesResponse, 'content'> & {
    content: AnthropicContentBlock[];
  };
}

export interface ContentBlockStartEvent {
  type: 'content_block_start';
  index: number;
  content_block: AnthropicContentBlock;
}

export interface ContentBlockDeltaEvent {
  type: 'content_block_delta';
  index: number;
  delta: {
    type: 'text_delta';
    text: string;
  };
}

export interface ContentBlockStopEvent {
  type: 'content_block_stop';
  index: number;
}

export interface MessageDeltaEvent {
  type: 'message_delta';
  delta: {
    stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
    stop_sequence: string | null;
  };
  usage: {
    output_tokens: number;
  };
}

export interface MessageStopEvent {
  type: 'message_stop';
}

export interface PingEvent {
  type: 'ping';
}

export type StreamEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | PingEvent;

// --- Inferred Request Type ---

export type MessagesRequest = z.infer<typeof MessagesRequestSchema>;
export type AnthropicMessage = z.infer<typeof AnthropicMessageSchema>;
