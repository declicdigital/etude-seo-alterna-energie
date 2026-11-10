import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { legacyRedirect } from "./lib/app-url";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} - try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/** Outil interne : aucune page ni réponse ne doit être indexée par les moteurs de recherche. */
const ROBOTS = "noindex, nofollow, noarchive";
function noIndex(response: Response): Response {
  try {
    response.headers.set("X-Robots-Tag", ROBOTS);
    return response;
  } catch {
    // En-têtes figés (réponse immuable) : on recopie la réponse.
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", ROBOTS);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Former address: send every page to the same page on the new address (the browser keeps the #anchor).
    const moved = legacyRedirect(request.url);
    if (moved) {
      // 308 hors GET/HEAD : un envoi (POST…) garde sa méthode et son contenu.
      const keepsMethod = request.method !== "GET" && request.method !== "HEAD";
      return new Response(null, {
        status: keepsMethod ? 308 : 301,
        headers: {
          Location: moved,
          "Cache-Control": "public, max-age=3600",
          "X-Robots-Tag": ROBOTS,
        },
      });
    }
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return noIndex(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8", "X-Robots-Tag": ROBOTS },
      });
    }
  },
};
