import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function AdminPage() {
  const { userId } = auth();
  if (!userId) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-2xl mx-auto w-full px-4 py-10">
        <h1 className="font-marker text-3xl text-mm-orange mb-8">Admin Panel</h1>

        <section className="bg-mm-surface rounded-xl p-6 flex flex-col gap-4">
          <h2 className="font-marker text-xl text-mm-gold">QR Code Generator</h2>
          <p className="font-boogaloo text-gray-400 text-sm">Coming in Stage 3.</p>
        </section>
      </main>
    </div>
  );
}
