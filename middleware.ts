import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublic = createRouteMatcher([
  "/",
  "/display",          // big-screen display — no login needed
  "/login(.*)",
  "/register(.*)",
  "/leaderboard(.*)",
  "/api/check-location",
  // Game server calls these with a shared secret — no Clerk session involved
  "/api/game/player-info",
  "/api/game/score",
]);

export default clerkMiddleware((auth, req) => {
  if (!isPublic(req)) auth().protect();
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
