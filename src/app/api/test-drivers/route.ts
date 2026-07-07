import { NextResponse } from "next/server";
import { getDrivers } from "@/lib/actions/order-defaults";

export async function GET() {
  const result = await getDrivers();
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    result,
  });
}
