import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublic = createRouteMatcher([
  "/",
  "/display",          // big-screen display — no login needed
  "/login(.*)",
  "/register(.*)",
  "/leaderboard(.*)",
  "/api/check-location",
  "/api/location/check",   // called from /join with GPS coords
  "/api/location/status",  // current location info for admin panel
  "/api/location/set",     // admin routes check userId in handler
  "/api/location/activate",
  "/api/leaderboard/display",   // polled by the display screen — no login needed
  // Game server calls this with a shared secret — no Clerk session involved
  "/api/game/score",
  "/api/game/daily",          // polled by display + join — no login needed
]);

export default clerkMiddleware((auth, req) => {
  if (!isPublic(req)) auth().protect();
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
