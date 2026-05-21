import type { Metadata } from "next";
import { Permanent_Marker, Boogaloo } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const marker = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-marker",
});

const boogaloo = Boogaloo({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-boogaloo",
});

export const metadata: Metadata = {
  title: "Mix Master",
  description: "Daily mini-game hub with weekly competitions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${marker.variable} ${boogaloo.variable} bg-mm-bg text-white antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
