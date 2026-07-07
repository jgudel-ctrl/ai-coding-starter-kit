import { NextResponse } from "next/server";
import { getDrivers } from "@/lib/actions/order-defaults";

export async function GET() {
  const result = await getDrivers();
  
  console.log("[API /debug/drivers] Result:", JSON.stringify(result, null, 2));
  
  return NextResponse.json(result);
}
