import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { saveLocationAction } from "./actions";

export default function AdminPage() {
  const { userId } = auth();
  if (!userId) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-2xl mx-auto w-full px-4 py-10">
        <h1 className="font-marker text-3xl text-mm-orange mb-8">Admin Panel</h1>

        <section className="bg-mm-surface rounded-xl p-6 flex flex-col gap-4">
          <h2 className="font-marker text-xl text-mm-gold">Location Settings</h2>
          <p className="font-boogaloo text-gray-400 text-sm">
            Set the active venue coordinates and allowed radius. Players must be within
            range to access the hub.
          </p>
          <form action={saveLocationAction} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                name="lat"
                type="number"
                step="any"
                placeholder="Latitude"
                required
                className="bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-mm-cyan"
              />
              <input
                name="lon"
                type="number"
                step="any"
                placeholder="Longitude"
                required
                className="bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-mm-cyan"
              />
              <input
                name="radius"
                type="number"
                defaultValue={100}
                placeholder="Radius (meters)"
                required
                className="bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-mm-cyan col-span-2"
              />
            </div>
            <button
              type="submit"
              className="font-marker text-white bg-mm-pink rounded-lg px-6 py-2 hover:opacity-90 transition self-start"
            >
              Save Location
            </button>
          </form>
        </section>

        <section className="bg-mm-surface rounded-xl p-6 flex flex-col gap-4 mt-6">
          <h2 className="font-marker text-xl text-mm-gold">QR Code Generator</h2>
          <p className="font-boogaloo text-gray-400 text-sm">Coming in Stage 3.</p>
        </section>
      </main>
    </div>
  );
}
