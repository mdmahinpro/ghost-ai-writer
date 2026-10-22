/**
 * Deployed-build half of the author-portrait proxy: served by Nitro as global
 * h3 middleware (auto-registered because vite.config.ts sets
 * `serverDir: "./server"`). The dev server uses the identical handler through
 * the Vite plugin in vite.config.ts.
 *
 * Zero disk: the portrait stream is read into memory, cached per seed with an
 * ETag, and replaced by a deterministic inline-SVG portrait when the upstream
 * host is unreachable.
 */
interface AvatarEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

export default async function avatarProxyMiddleware(
  event: AvatarEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  if (event.url.pathname !== "/__grok/avatar") return next();
  const method = (event.req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  }
  const { handleAvatarRequest } = await import("../../src/lib/avatar-proxy.server.ts");
  return handleAvatarRequest(new Request(event.url.toString(), { method: "GET", headers: event.req.headers }));
}
