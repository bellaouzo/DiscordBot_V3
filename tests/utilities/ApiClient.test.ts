import { EventEmitter } from "events";
import { afterEach, describe, expect, it, vi } from "vitest";
import http from "http";

vi.unmock("@utilities/ApiClient");

import { RequestJson } from "@utilities/ApiClient";

type MockResponse = EventEmitter & {
  statusCode?: number;
  setEncoding: ReturnType<typeof vi.fn>;
};

function createMockResponse(statusCode: number): MockResponse {
  const res = new EventEmitter() as MockResponse;
  res.statusCode = statusCode;
  res.setEncoding = vi.fn();
  return res;
}

function createMockHttpRequest(
  onEnd: (callback: (response: MockResponse) => void) => void,
) {
  const req = new EventEmitter() as EventEmitter & {
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  req.write = vi.fn();
  req.destroy = vi.fn();
  req.end = vi.fn(() => {
    onEnd((response) => {
      process.nextTick(() => {
        response.emit("end");
      });
    });
  });
  return req;
}

describe("RequestJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed JSON for successful responses", async () => {
    vi.spyOn(http, "request").mockImplementation((_url, _opts, callback) => {
      return createMockHttpRequest((emitEnd) => {
        const response = createMockResponse(200);
        callback?.(response as never);
        process.nextTick(() => {
          response.emit("data", '{"ok":true}');
          emitEnd(response);
        });
      }) as never;
    });

    const result = await RequestJson<{ ok: boolean }>("http://example.com/api");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ ok: true });
  });

  it("skips undefined query params when building the URL", async () => {
    let requestedHref = "";
    vi.spyOn(http, "request").mockImplementation((url, _opts, callback) => {
      requestedHref = typeof url === "string" ? url : url.href;
      return createMockHttpRequest((emitEnd) => {
        const response = createMockResponse(204);
        callback?.(response as never);
        emitEnd(response);
      }) as never;
    });

    await RequestJson("http://example.com/api", {
      query: { keep: "yes", skip: undefined },
    });

    expect(requestedHref).toContain("keep=yes");
    expect(requestedHref).not.toContain("skip");
  });

  it("returns empty-body success without data", async () => {
    vi.spyOn(http, "request").mockImplementation((_url, _opts, callback) => {
      return createMockHttpRequest((emitEnd) => {
        const response = createMockResponse(204);
        callback?.(response as never);
        emitEnd(response);
      }) as never;
    });

    const result = await RequestJson("http://example.com/api");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(204);
    expect(result.data).toBeUndefined();
  });

  it("returns parse errors for non-JSON bodies", async () => {
    vi.spyOn(http, "request").mockImplementation((_url, _opts, callback) => {
      return createMockHttpRequest((emitEnd) => {
        const response = createMockResponse(200);
        callback?.(response as never);
        process.nextTick(() => {
          response.emit("data", "not-json");
          emitEnd(response);
        });
      }) as never;
    });

    const result = await RequestJson("http://example.com/api");

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.raw).toBe("not-json");
  });

  it("resolves request errors", async () => {
    vi.spyOn(http, "request").mockImplementation(() => {
      const req = new EventEmitter() as EventEmitter & {
        write: ReturnType<typeof vi.fn>;
        end: ReturnType<typeof vi.fn>;
        destroy: ReturnType<typeof vi.fn>;
      };
      req.write = vi.fn();
      req.destroy = vi.fn();
      req.end = vi.fn(() => {
        process.nextTick(() => req.emit("error", new Error("network down")));
      });
      return req as never;
    });

    const result = await RequestJson("http://example.com/api");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.error).toBe("network down");
  });

  it("resolves timeouts", async () => {
    vi.spyOn(http, "request").mockImplementation(() => {
      const req = new EventEmitter() as EventEmitter & {
        write: ReturnType<typeof vi.fn>;
        end: ReturnType<typeof vi.fn>;
        destroy: ReturnType<typeof vi.fn>;
      };
      req.write = vi.fn();
      req.destroy = vi.fn();
      req.end = vi.fn(() => {
        process.nextTick(() => req.emit("timeout"));
      });
      return req as never;
    });

    const result = await RequestJson("http://example.com/api", {
      timeoutMs: 10,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Request timed out");
  });

  it("writes JSON bodies for POST requests", async () => {
    vi.spyOn(http, "request").mockImplementation((_url, options, callback) => {
      expect(options).toEqual(
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );

      return createMockHttpRequest((emitEnd) => {
        const response = createMockResponse(200);
        callback?.(response as never);
        process.nextTick(() => {
          response.emit("data", '{"created":true}');
          emitEnd(response);
        });
      }) as never;
    });

    const result = await RequestJson("http://example.com/api", {
      method: "POST",
      body: { created: true },
    });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ created: true });
  });
});
