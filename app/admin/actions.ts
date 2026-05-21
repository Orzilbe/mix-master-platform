"use server";

import { auth } from "@clerk/nextjs/server";
import { upsertLocation } from "@/lib/db";

export async function saveLocationAction(formData: FormData) {
  const { userId } = auth();
  if (!userId) throw new Error("Unauthorized");

  const lat = parseFloat(formData.get("lat") as string);
  const lon = parseFloat(formData.get("lon") as string);
  const radius = parseInt(formData.get("radius") as string, 10);

  if (isNaN(lat) || isNaN(lon) || isNaN(radius)) throw new Error("Invalid coordinates");

  await upsertLocation(lat, lon, radius);
}
