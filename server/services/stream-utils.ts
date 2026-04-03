import { Response } from 'express';

/**
 * Set SSE (Server-Sent Events) headers on the response.
 */
export function setSSEHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

/**
 * Write a single SSE event in OpenAI format.
 * Format: data: {json}\n\n
 */
export function writeSSEData(res: Response, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Write a single SSE event in Anthropic format.
 * Format: event: {type}\ndata: {json}\n\n
 */
export function writeSSEEvent(
  res: Response,
  eventType: string,
  data: unknown,
): void {
  res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Write the final SSE termination event for OpenAI format.
 */
export function writeSSEDone(res: Response): void {
  res.write('data: [DONE]\n\n');
  res.end();
}

/**
 * Write a newline-delimited JSON line (for Ollama format).
 */
export function writeNDJSON(res: Response, data: unknown): void {
  res.write(JSON.stringify(data) + '\n');
}

/**
 * Handle client disconnect by registering a cleanup callback.
 */
export function onClientDisconnect(
  res: Response,
  cleanup: () => void,
): void {
  res.on('close', () => {
    cleanup();
  });
}
