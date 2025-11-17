import { NextResponse } from "next/server";
import { initTransactionsTable } from "@/server-actions/initTableland";

export async function POST() {
  try {
    const tableName = await initTransactionsTable();
    return NextResponse.json({ 
      tableName, 
      success: true,
      message: `Table created: ${tableName}. Add TABLELAND_TABLE_NAME=${tableName} to your .env.local`
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false
      },
      { status: 500 }
    );
  }
}

