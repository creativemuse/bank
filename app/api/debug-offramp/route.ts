import { NextResponse } from "next/server";
import { generateJWT } from "@/utils/coinbase-sdk";

export async function GET() {
  try {
    const hasKeyId = !!process.env.COINBASE_API_KEY_ID;
    const hasKeySecret = !!process.env.COINBASE_API_KEY_SECRET;

    console.log("Debug Offramp - Environment check:", {
      hasKeyId,
      hasKeySecret,
      keyIdPrefix: process.env.COINBASE_API_KEY_ID?.substring(0, 20) + "...",
      nodeEnv: process.env.NODE_ENV,
    });

    if (!hasKeyId || !hasKeySecret) {
      return NextResponse.json(
        {
          error: "Missing API keys",
          hasKeyId,
          hasKeySecret,
        },
        { status: 400 }
      );
    }

    // Test 1: Generate JWT for session token endpoint (POST)
    console.log("\n=== TEST 1: Session Token JWT ===");
    const sessionJWT = await generateJWT(
      process.env.COINBASE_API_KEY_ID!,
      process.env.COINBASE_API_KEY_SECRET!,
      "POST",
      "/onramp/v1/token"
    );

    // Test 2: Generate JWT for transaction fetch endpoint (GET)
    console.log("\n=== TEST 2: Transaction Fetch JWT ===");
    const testUserId = "test-user-123";
    const transactionPath = `/onramp/v1/sell/user/${testUserId}/transactions`;
    const transactionJWT = await generateJWT(
      process.env.COINBASE_API_KEY_ID!,
      process.env.COINBASE_API_KEY_SECRET!,
      "GET",
      transactionPath
    );

    // Test 3: Try to fetch transactions for a test user
    console.log("\n=== TEST 3: Fetch Transactions ===");
    const response = await fetch(
      `https://api.developer.coinbase.com${transactionPath}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${transactionJWT}`,
          "Content-Type": "application/json",
        },
      }
    );

    const responseText = await response.text();
    
    console.log("Offramp API Response:", {
      status: response.status,
      statusText: response.statusText,
      responsePreview: responseText.substring(0, 200),
    });

    // Parse response if it's JSON
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      parsedResponse = responseText;
    }

    return NextResponse.json({
      success: true,
      tests: {
        apiKeysConfigured: true,
        sessionJWTGenerated: !!sessionJWT,
        transactionJWTGenerated: !!transactionJWT,
        offrampApiResponse: {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText,
        },
      },
      apiResponse: parsedResponse,
      diagnostics: {
        jwtLengths: {
          sessionJWT: sessionJWT.length,
          transactionJWT: transactionJWT.length,
        },
        keyIdPrefix: process.env.COINBASE_API_KEY_ID?.substring(0, 30) + "...",
        requestPath: transactionPath,
      },
    });
  } catch (error) {
    console.error("Debug endpoint error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

