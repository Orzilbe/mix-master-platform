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
        <head>
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#FF2D78" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="Mix Master" />
          <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
          <script dangerouslySetInnerHTML={{ __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/service-worker.js');
              });
            }
          `}} />
        </head>
        <body className={`${marker.variable} ${boogaloo.variable} bg-mm-bg text-white antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
