import { NextRequest, NextResponse } from "next/server";

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

export async function POST(req: NextRequest) {
  const { lat, lon } = await req.json();

  const venueLat = parseFloat(process.env.VENUE_LAT ?? "0");
  const venueLon = parseFloat(process.env.VENUE_LON ?? "0");
  const venueRadius = parseFloat(process.env.VENUE_RADIUS_M ?? "100");

  if (!venueLat || !venueLon) {
    return NextResponse.json({ allowed: true, reason: "no_venue_configured" });
  }

  const dist = haversineMeters(lat, lon, venueLat, venueLon);
  const allowed = dist <= venueRadius;

  return NextResponse.json({ allowed, distanceMeters: Math.round(dist) });
}
