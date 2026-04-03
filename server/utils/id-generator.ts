import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

/**
 * Generate an OpenAI-style chat completion ID.
 * Format: chatcmpl-<uuid>
 */
export function generateChatCompletionId(): string {
  return `chatcmpl-${uuidv4().replace(/-/g, '').substring(0, 29)}`;
}

/**
 * Generate an Anthropic-style message ID.
 * Format: msg_<24-hex-chars>
 */
export function generateMessageId(): string {
  return `msg_${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Get the current Unix timestamp in seconds.
 */
export function unixTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}
