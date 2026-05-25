import {NextRequest, NextResponse} from "next/server";
import {supabaseAdmin} from "@/lib/supabase";

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
    // ── Kill switch: set DISABLE_LOCATION_GATE=true in .env.local to bypass
    // all location checks instantly — no DB changes needed.
    // if (process.env.DISABLE_LOCATION_GATE === "true") {
    return NextResponse.json({allowed: true, reason: "gate_disabled"});
    // }

    const {lat, lon} = await req.json();

    // ── Check env vars first (legacy / simple config) ─────────────────────────
    const venueLat = parseFloat(process.env.VENUE_LAT ?? "0");
    const venueLon = parseFloat(process.env.VENUE_LON ?? "0");
    const venueRadius = parseFloat(process.env.VENUE_RADIUS_M ?? "100");

    if (venueLat && venueLon) {
        const dist = haversineMeters(lat, lon, venueLat, venueLon);
        const allowed = dist <= venueRadius;
        return NextResponse.json({allowed, distanceMeters: Math.round(dist), source: "env"});
    }

    // ── Fall back to Supabase locations table (set via /admin panel) ──────────
    const {data: location} = await supabaseAdmin()
        .from("locations")
        .select("lat, lon, radius_m, is_active")
        .eq("is_active", true)
        .order("updated_at", {ascending: false})
        .limit(1)
        .maybeSingle();

    // No active venue row in DB → open to everyone
    if (!location) {
        return NextResponse.json({allowed: true, reason: "no_venue_configured"});
    }

    const dist = haversineMeters(lat, lon, location.lat, location.lon);
    const allowed = dist <= location.radius_m;
    return NextResponse.json({allowed, distanceMeters: Math.round(dist), source: "db"});
}