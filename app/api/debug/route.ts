import { NextResponse } from "next/server";

export async function GET() {
  try {
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      hasCoinbaseKeyId: !!process.env.COINBASE_API_KEY_ID,
      hasCoinbaseKeySecret: !!process.env.COINBASE_API_KEY_SECRET,
      timestamp: new Date().toISOString(),
    };

    console.log("Debug endpoint called:", envInfo);

    return NextResponse.json({
      success: true,
      data: envInfo,
    });
  } catch (error) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
