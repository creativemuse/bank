import { NextResponse } from "next/server";

const AAVE_GRAPHQL_URL = "https://api.v3.aave.com/graphql";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function fetchWithRetry(body: string): Promise<{ data: string; status: number; contentType: string }> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
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

      // Retry on 5xx server errors (not 4xx client errors)
      if (upstream.status >= 500 && attempt < MAX_RETRIES) {
        console.warn(`Aave API returned ${upstream.status} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying...`);
        const jitter = Math.random() * 200;
        await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt + jitter));
        continue;
      }

      return {
        data,
        status: upstream.status,
        contentType: upstream.headers.get("content-type") ?? "application/json",
      };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        console.warn(`Aave API fetch failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, error);
        const jitter = Math.random() * 200;
        await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt + jitter));
        continue;
      }
    }
  }

  throw lastError ?? new Error("All retries exhausted");
}

/**
 * The @aave/react SDK (v0.x) sends `deployer` in VaultDeployRequest, but
 * Aave's current API schema requires `user`. This adds `user` as an alias
 * so the mutation is accepted without requiring a full SDK upgrade.
 */
function patchVaultDeployRequest(rawBody: string): string {
  if (!rawBody.includes("VaultDeploy")) {
    return rawBody;
  }

  try {
    const parsed = JSON.parse(rawBody);
    if (
      parsed?.operationName === "VaultDeploy" &&
      parsed?.variables?.request &&
      parsed.variables.request.deployer &&
      !parsed.variables.request.user
    ) {
      parsed.variables.request.user = parsed.variables.request.deployer;
      return JSON.stringify(parsed);
    }
  } catch {
    // Not JSON or unexpected shape — pass through unchanged
  }
  return rawBody;
}

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

    const patchedBody = patchVaultDeployRequest(body);
    const { data, status, contentType: upstreamContentType } = await fetchWithRetry(patchedBody);

    if (status >= 500) {
      console.error(`Aave API returned ${status} after all retries:`, data.slice(0, 500));
      return NextResponse.json(
        {
          errors: [
            {
              message: data.includes("panic")
                ? "Service panicked"
                : `Aave API error (${status})`,
              extensions: { upstream: data.slice(0, 500) },
            },
          ],
        },
        { status: 200, headers: { "cache-control": "no-store" } },
      );
    }

    return new NextResponse(data, {
      status,
      headers: {
        "content-type": upstreamContentType,
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
