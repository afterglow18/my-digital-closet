/**
 * RevenueCat authenticated client via Replit Connectors SDK.
 * Returns a client object compatible with @replit/revenuecat-sdk functions.
 */
import { ReplitConnectors } from "@replit/connectors-sdk";

const BASE_PATH = "/v2";

function resolveUrl(template: string, params?: Record<string, string>): string {
  let url = template;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`{${key}}`, encodeURIComponent(String(value)));
    }
  }
  return BASE_PATH + url;
}

async function makeRequest(
  connectors: ReplitConnectors,
  method: string,
  opts: { url: string; path?: Record<string, string>; query?: Record<string, unknown>; body?: unknown },
): Promise<{ data: unknown; error: unknown; response: Response }> {
  let url = resolveUrl(opts.url, opts.path);

  if (opts.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) qs.append(k, String(v));
    }
    const str = qs.toString();
    if (str) url += "?" + str;
  }

  const fetchOpts: RequestInit = { method };
  if (opts.body !== undefined) {
    fetchOpts.body = JSON.stringify(opts.body);
    fetchOpts.headers = { "Content-Type": "application/json" };
  }

  const response = (await connectors.proxy("revenuecat", url, fetchOpts)) as Response;
  const text = await response.text();

  let data: unknown = null;
  let error: unknown = null;

  try {
    const parsed = JSON.parse(text);
    if (response.ok) {
      data = parsed;
    } else {
      error = parsed;
    }
  } catch {
    if (response.ok) {
      data = text;
    } else {
      error = { message: text, status: response.status };
    }
  }

  return { data, error, response };
}

// Type that matches what @replit/revenuecat-sdk functions expect
type SdkClient = {
  get:    (opts: any) => Promise<{ data: any; error: any; response: Response }>;
  post:   (opts: any) => Promise<{ data: any; error: any; response: Response }>;
  put:    (opts: any) => Promise<{ data: any; error: any; response: Response }>;
  patch:  (opts: any) => Promise<{ data: any; error: any; response: Response }>;
  delete: (opts: any) => Promise<{ data: any; error: any; response: Response }>;
};

export async function getUncachableRevenueCatClient(): Promise<SdkClient> {
  const connectors = new ReplitConnectors();
  return {
    get:    (opts) => makeRequest(connectors, "GET",    opts),
    post:   (opts) => makeRequest(connectors, "POST",   opts),
    put:    (opts) => makeRequest(connectors, "PUT",    opts),
    patch:  (opts) => makeRequest(connectors, "PATCH",  opts),
    delete: (opts) => makeRequest(connectors, "DELETE", opts),
  };
}
