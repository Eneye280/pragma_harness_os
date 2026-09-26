import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";

export function createHarnessServer(): Hono {
  const app = new Hono();

  app.use("*", cors({ origin: ["http://localhost:*"], allowMethods: ["GET", "POST", "OPTIONS"] }));

  app.get("/health", (c) => c.json({ status: "harness:ready", version: "1.0.2", ts: Date.now() }));

  app.get("/doc", (c) =>
    c.json({
      openapi: "3.1.0",
      info: { title: "Pragma Harness OS", version: "1.0.2" },
      paths: {
        "/health": { get: { summary: "Health check" } },
        "/events": { get: { summary: "SSE event stream" } },
        "/doc": { get: { summary: "OpenAPI doc" } },
      },
    })
  );

  app.get("/events", (c) => {
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        const send = (data: unknown) => {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        };
        send({ type: "server.connected", ts: Date.now() });
        const interval = setInterval(() => send({ type: "heartbeat", ts: Date.now() }), 30000);
        c.req.raw.signal.addEventListener("abort", () => {
          clearInterval(interval);
          controller.close();
        });
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  });

  return app;
}

let server: ServerType | null = null;

export function startHarnessServer(port = 4096): ServerType {
  const app = createHarnessServer();
  server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[harness] Hono server listening on http://localhost:${info.port}`);
  });
  return server;
}

export function stopHarnessServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
