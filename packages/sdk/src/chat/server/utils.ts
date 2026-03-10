/**
 * Shared server utilities — readBody and JSON response helpers.
 */

import type { ReadableRequest, WritableResponse } from "./handler.js";

/** Error thrown by readBody with an HTTP status code */
export class BodyParseError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "BodyParseError";
    this.statusCode = statusCode;
  }
}

/**
 * Read and parse JSON request body with size limit.
 * Throws BodyParseError on oversized, malformed, or errored requests.
 */
export function readBody(req: ReadableRequest, maxSize = 1_048_576): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    let exceeded = false;
    req.on("data", (chunk: Buffer | string) => {
      if (exceeded) return;
      const str = chunk.toString();
      size += Buffer.byteLength(str);
      if (size > maxSize) {
        exceeded = true;
        reject(new BodyParseError("Request body too large", 413));
        return;
      }
      body += str;
    });
    req.on("end", () => {
      if (exceeded) return;
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new BodyParseError("Invalid JSON in request body", 400));
      }
    });
    if ("once" in req && typeof (req as { once: unknown }).once === "function") {
      (req as { once(event: string, listener: () => void): void }).once("error", () =>
        reject(new BodyParseError("Request error", 500)),
      );
    }
  });
}

/** Send a JSON response with given status code. */
export function json(res: WritableResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
