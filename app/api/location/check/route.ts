import { NextRequest, NextResponse } from "next/server";
import { getActiveLocation } from "@/lib/db";

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  try {
    const location = await getActiveLocation();
    console.log(`[location/check] user=(${lat},${lng}) activeLocation=`, JSON.stringify(location));

    if (!location) {
      console.log("[location/check] no active location → devMode");
      return NextResponse.json({ allowed: true, devMode: true });
    }

    const distance = Math.round(haversineMeters(lat, lng, location.lat, location.lon));
    const allowed  = distance <= location.radius_m;

    console.log(`[location/check] distance=${distance}m radius=${location.radius_m}m → ${allowed ? "ALLOWED" : "BLOCKED"}`);

    return NextResponse.json({
      allowed,
      devMode:      false,
      locationName: location.name,
      distance,
      radius:       location.radius_m,
      venueLat:     location.lat,
      venueLon:     location.lon,
    });
  } catch (err) {
    console.error("[location/check] error:", err);
    return NextResponse.json({ allowed: true, devMode: true });
  }
}
