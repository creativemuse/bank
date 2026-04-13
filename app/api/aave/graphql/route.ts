import { NextResponse } from "next/server";

const AAVE_GRAPHQL_URL = "https://api.v3.aave.com/graphql";

/**
 * Proxies GraphQL requests to the Aave v3 API to avoid browser CORS restrictions.
 * The Aave API does not set Access-Control-Allow-Origin headers, so direct
 * browser requests from our domain are blocked. Server-to-server requests
 * are not subject to CORS.
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json(
      { error: "Invalid content-type; expected application/json" },
      { status: 415 },
    );
  }

  try {
    const body = await request.text();
    if (!body) {
      return NextResponse.json(
        { error: "Missing request body" },
        { status: 400 },
      );
    }

    const upstream = await fetch(AAVE_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body,
      cache: "no-store",
    });

    const data = await upstream.text();

    return new NextResponse(data, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("Aave proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch from Aave API" },
      { status: 502 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
