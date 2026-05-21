import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublic = createRouteMatcher([
  "/",
  "/display",          // big-screen display — no login needed
  "/login(.*)",
  "/register(.*)",
  "/leaderboard(.*)",
  "/api/check-location",
  "/api/leaderboard/display",   // polled by the display screen — no login needed
  // Game server calls this with a shared secret — no Clerk session involved
  "/api/game/score",
]);

export default clerkMiddleware((auth, req) => {
  if (!isPublic(req)) auth().protect();
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
