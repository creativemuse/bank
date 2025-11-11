import { NextResponse } from "next/server";
import { generateJWT } from "@/utils/coinbase-sdk";

export async function GET() {
  try {
    // Check environment variables
    const hasKeyId = !!process.env.COINBASE_API_KEY_ID;
    const hasKeySecret = !!process.env.COINBASE_API_KEY_SECRET;
    const nodeEnv = process.env.NODE_ENV;

    console.log("Test JWT endpoint - Environment check:", {
      hasKeyId,
      hasKeySecret,
      nodeEnv,
    });

    if (!process.env.COINBASE_API_KEY_ID || !process.env.COINBASE_API_KEY_SECRET) {
      return NextResponse.json(
        {
          error: "Missing API keys",
          hasKeyId,
          hasKeySecret,
          nodeEnv,
        },
        { status: 400 }
      );
    }

    // Test JWT generation (using default POST /onramp/v1/token parameters)
    console.log("Attempting to generate JWT...");
    const jwt = await generateJWT(
      process.env.COINBASE_API_KEY_ID,
      process.env.COINBASE_API_KEY_SECRET,
      "POST",
      "/onramp/v1/token"
    );

    console.log("JWT generated successfully in test endpoint");

    return NextResponse.json({
      success: true,
      hasJWT: !!jwt,
      jwtLength: jwt?.length,
      nodeEnv,
      hasKeyId,
      hasKeySecret,
    });
  } catch (error) {
    console.error("Test JWT endpoint error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        nodeEnv: process.env.NODE_ENV,
      },
      { status: 500 }
    );
  }
}
