/**
 * CORS middleware — standalone composable function.
 * Returns true if it fully handled the request (OPTIONS preflight),
 * false if the caller should continue processing.
 */

/** Configuration for CORS middleware */
export interface CorsOptions {
  /** Allowed origins. Default: "*" (any origin) */
  origin?: string | string[];
  /** Allowed HTTP methods. Default: common REST methods */
  methods?: string[];
  /** Allowed request headers. Default: ["Content-Type"] */
  headers?: string[];
  /** Max age for preflight cache in seconds. Default: 86400 (24h) */
  maxAge?: number;
}

/** Minimal request interface for CORS */
interface CorsRequest {
  readonly method?: string;
  readonly headers?: Record<string, string | string[] | undefined>;
}

/** Minimal response interface for CORS */
interface CorsResponse {
  setHeader(name: string, value: string): void;
  writeHead(statusCode: number): void;
  end(): void;
}

/**
 * Create a CORS middleware function.
 *
 * @returns A function that sets CORS headers and handles OPTIONS preflight.
 *          Returns `true` if the request was fully handled (preflight),
 *          `false` if the caller should continue processing.
 */
export function corsMiddleware(options?: CorsOptions): (req: CorsRequest, res: CorsResponse) => boolean {
  const origin = options?.origin ?? "*";
  const methods = options?.methods ?? ["GET", "POST", "DELETE", "OPTIONS"];
  const headers = options?.headers ?? ["Content-Type"];
  const maxAge = options?.maxAge ?? 86400;

  const methodsValue = methods.join(", ");
  const headersValue = headers.join(", ");

  return (req: CorsRequest, res: CorsResponse): boolean => {
    // Determine origin header value per spec
    let originValue: string;
    if (Array.isArray(origin)) {
      const reqOrigin = typeof req.headers?.origin === "string" ? req.headers.origin : "";
      originValue = origin.includes(reqOrigin) ? reqOrigin : origin[0];
      res.setHeader("Vary", "Origin");
    } else {
      originValue = origin;
    }
    res.setHeader("Access-Control-Allow-Origin", originValue);
    res.setHeader("Access-Control-Allow-Methods", methodsValue);
    res.setHeader("Access-Control-Allow-Headers", headersValue);

    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Max-Age", String(maxAge));
      res.writeHead(204);
      res.end();
      return true;
    }

    return false;
  };
}
