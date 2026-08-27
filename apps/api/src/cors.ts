export function corsHeaders(options?: { credentials?: boolean }): HeadersInit {
  const webOrigin = process.env.WEB_ORIGIN;
  if (!webOrigin) {
    return {};
  }
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": webOrigin,
  };
  if (options?.credentials) {
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Vary"] = "Origin";
  }
  return headers;
}

export function isJsonContentType(header: string | null): boolean {
  if (header === null) {
    return false;
  }
  return header.split(";")[0]?.trim().toLowerCase() === "application/json";
}

export function preflightResponse(methods = "POST, OPTIONS"): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders({ credentials: true }),
      "Access-Control-Allow-Methods": methods,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
