import { NextResponse } from "next/server";
import { getActiveLocation } from "@/lib/db";

export async function GET() {
  try {
    const location = await getActiveLocation();
    return NextResponse.json({ location: location ?? null });
  } catch {
    return NextResponse.json({ location: null });
  }
}
