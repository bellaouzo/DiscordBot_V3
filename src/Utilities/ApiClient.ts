import http from "http";
import https from "https";
import { URL } from "url";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";

export interface ApiRequestOptions {
  readonly method?: HttpMethod;
  readonly headers?: Record<string, string>;
  readonly query?: Record<string, string | number | boolean | undefined>;
  readonly body?: unknown;
  readonly timeoutMs?: number;
}

export interface ApiResponse<T> {
  readonly ok: boolean;
  readonly status: number;
  readonly data?: T;
  readonly error?: string;
  readonly raw?: string;
}

function BuildUrl(baseUrl: string, query?: ApiRequestOptions["query"]): string {
  if (!query) {
    return baseUrl;
  }

  const url = new URL(baseUrl);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    url.searchParams.append(key, String(value));
  });
  return url.toString();
}

function SerializeBody(body?: unknown): {
  readonly payload?: string;
  readonly headers: Record<string, string>;
} {
  if (body === undefined || body === null) {
    return { headers: {} };
  }

  const payload = JSON.stringify(body);
  return {
    payload,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload).toString(),
    },
  };
}

export async function RequestJson<T>(
  baseUrl: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const resolvedUrl = BuildUrl(baseUrl, options.query);
  const url = new URL(resolvedUrl);
  const isHttps = url.protocol === "https:";
  const client = isHttps ? https : http;

  const method = options.method ?? "GET";
  const { payload, headers: bodyHeaders } = SerializeBody(options.body);

  const headers = {
    Accept: "application/json",
    ...bodyHeaders,
    ...options.headers,
  };

  const timeoutMs = options.timeoutMs ?? 8000;

  return new Promise((resolve) => {
    const request = client.request(
      url,
      { method, headers, timeout: timeoutMs },
      (response) => {
        let raw = "";
        response.setEncoding("utf8");

        response.on("data", (chunk) => {
          raw += chunk;
        });

        response.on("end", () => {
          const status = response.statusCode ?? 0;
          const ok = status >= 200 && status < 300;

          if (!raw) {
            resolve({ ok, status });
            return;
          }

          try {
            const data = JSON.parse(raw) as T;
            resolve({ ok, status, data, raw });
          } catch (error) {
            resolve({
              ok: false,
              status,
              error: error instanceof Error ? error.message : "Parse error",
              raw,
            });
          }
        });
      }
    );

    request.on("error", (error) => {
      resolve({
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : "Request failed",
      });
    });

    request.on("timeout", () => {
      request.destroy(new Error("Request timed out"));
      resolve({ ok: false, status: 0, error: "Request timed out" });
    });

    if (payload && method !== "GET" && method !== "HEAD") {
      request.write(payload);
    }

    request.end();
  });
}
