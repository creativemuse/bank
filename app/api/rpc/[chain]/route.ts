import { NextResponse } from "next/server";

type AllowedChain = "mainnet" | "base" | "base-sepolia";

const ALLOWED_CHAINS: ReadonlySet<AllowedChain> = new Set([
  "mainnet",
  "base",
  "base-sepolia",
]);

const getUpstreamRpcUrl = (chain: AllowedChain): string | null => {
  const alchemyKey = process.env.ALCHEMY_API_KEY?.trim();

  if (chain === "mainnet") {
    if (alchemyKey) return `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    return process.env.MAINNET_RPC_URL?.trim() ?? null;
  }

  if (chain === "base") {
    if (alchemyKey) return `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`;
    return process.env.BASE_RPC_URL?.trim() ?? null;
  }

  if (chain === "base-sepolia") {
    if (alchemyKey) return `https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`;
    return process.env.BASE_SEPOLIA_RPC_URL?.trim() ?? null;
  }

  return null;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ chain: string }> }
) {
  const { chain } = await context.params;

  if (!ALLOWED_CHAINS.has(chain as AllowedChain)) {
    return NextResponse.json(
      { error: "Unsupported chain" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const upstreamUrl = getUpstreamRpcUrl(chain as AllowedChain);
  if (!upstreamUrl) {
    return NextResponse.json(
      { error: "RPC upstream is not configured" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json(
      { error: "Invalid content-type; expected application/json" },
      { status: 415, headers: { "Cache-Control": "no-store" } }
    );
  }

  const requestBodyText = await request.text();
  if (!requestBodyText) {
    return NextResponse.json(
      { error: "Missing request body" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(requestBodyText);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Basic JSON-RPC shape check (don’t fully validate; forward most payloads as-is)
  const isObject = typeof parsed === "object" && parsed !== null;
  const isBatch = Array.isArray(parsed);
  if (!isObject && !isBatch) {
    return NextResponse.json(
      { error: "Invalid JSON-RPC payload" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: requestBodyText,
    // Avoid caching JSON-RPC responses at the edge
    cache: "no-store",
  });

  const upstreamText = await upstreamResponse.text();

  return new NextResponse(upstreamText, {
    status: upstreamResponse.status,
    headers: {
      "content-type":
        upstreamResponse.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } }
  );
}

