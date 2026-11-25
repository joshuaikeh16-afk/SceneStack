"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { safeRedirect } from "@/lib/utils/redirect";

export function GoogleSignIn({
  next,
  reauthenticate = false,
}: {
  next: string;
  reauthenticate?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setPending(true);
    setError("");
    try {
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", safeRedirect(next));
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback.toString(),
          ...(reauthenticate && {
            queryParams: { prompt: "select_account", max_age: "0" },
          }),
        },
      });
      if (error) throw error;
    } catch {
      setError(
        "We couldn’t connect to Google. Please try again. If this continues, check the Supabase Google provider configuration.",
      );
      setPending(false);
    }
  }

  return (
    <div className="google-signin">
      <button
        className="button google-button"
        onClick={signIn}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <LoaderCircle className="spin" size={20} aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.2 3-7.4Z"
            />
            <path
              fill="#34A853"
              d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
            />
            <path
              fill="#FBBC05"
              d="M6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z"
            />
            <path
              fill="#EA4335"
              d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.4L6.4 10C7.2 7.7 9.4 5.9 12 5.9Z"
            />
          </svg>
        )}
        {pending ? "Connecting to Google…" : "Continue with Google"}
      </button>
      <p className="auth-inline-error" role="alert">
        {error}
      </p>
    </div>
  );
}
