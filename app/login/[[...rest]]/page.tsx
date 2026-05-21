import { SignIn } from "@clerk/nextjs";

const appearance = {
  variables: {
    colorPrimary:         "#FF2D78",
    colorBackground:      "#1a1a1a",
    colorText:            "#ffffff",
    colorInputBackground: "#111111",
    colorInputText:       "#ffffff",
    borderRadius:         "12px",
  },
  elements: {
    card:              "shadow-[0_0_40px_rgba(255,45,120,.15)]",
    formButtonPrimary: "font-marker",
    headerTitle:       "font-marker",
  },
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6">
      <SignIn
        routing="path"
        path="/login"
        signUpUrl="/register"
        afterSignInUrl="/join"
        appearance={appearance}
      />
    </main>
  );
}
