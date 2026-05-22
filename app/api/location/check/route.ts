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

function isTabletUA(ua: string): boolean {
  // iPad, Android tablets (no "Mobile" keyword), generic "Tablet"
  return /iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || /Tablet/i.test(ua);
}

// In-memory cache: userId → expiry timestamp.
// Lives in the serverless function instance — works within a session; doesn't
// survive cold starts, which is fine for a soft 30-minute grace window.
const verifiedUntil = new Map<string, number>();
const CACHE_TTL_MS  = 30 * 60 * 1_000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat      = parseFloat(searchParams.get("lat")      ?? "");
  const lng      = parseFloat(searchParams.get("lng")      ?? "");
  const accuracy = parseFloat(searchParams.get("accuracy") ?? "");
  const userId   = searchParams.get("userId") ?? null;

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  // Serve from cache if user was recently verified
  if (userId) {
    const exp = verifiedUntil.get(userId);
    if (exp && exp > Date.now()) {
      return NextResponse.json({ allowed: true, cached: true, devMode: false });
    }
  }

  try {
    const location = await getActiveLocation();

    if (!location) {
      return NextResponse.json({ allowed: true, devMode: true });
    }

    const distance = Math.round(haversineMeters(lat, lng, location.lat, location.lon));

    // Tablets (iPad etc.) get 2× the configured radius — indoor GPS is far less
    // accurate on these devices and they often rely on WiFi/cell triangulation.
    const ua              = req.headers.get("user-agent") ?? "";
    const tablet          = isTabletUA(ua);
    const effectiveRadius = tablet ? location.radius_m * 2 : location.radius_m;

    // Low GPS accuracy fallback: if the browser reports > 100 m accuracy,
    // allow entry but tell the client to show a warning banner.
    if (!isNaN(accuracy) && accuracy > 100) {
      if (userId) verifiedUntil.set(userId, Date.now() + CACHE_TTL_MS);
      return NextResponse.json({
        allowed:      true,
        lowAccuracy:  true,
        accuracy:     Math.round(accuracy),
        devMode:      false,
        locationName: location.name,
        distance,
        radius:       effectiveRadius,
        tablet,
      });
    }

    const allowed = distance <= effectiveRadius;
    if (allowed && userId) verifiedUntil.set(userId, Date.now() + CACHE_TTL_MS);

    return NextResponse.json({
      allowed,
      devMode:      false,
      locationName: location.name,
      distance,
      radius:       effectiveRadius,
      tablet,
    });
  } catch (err) {
    console.error("[location/check] error:", err);
    return NextResponse.json({ allowed: true, devMode: true });
  }
}
