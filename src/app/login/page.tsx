import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Layers3, ShieldCheck } from "lucide-react";
import { getAuth } from "@/lib/auth/session";
import { getSupabaseConfig } from "@/config/env";
import { safeRedirect } from "@/lib/utils/redirect";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { SetupNotice } from "@/components/auth/setup-notice";
import { ButtonLink } from "@/components/ui/button";
import { Brand } from "@/components/layout/brand";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};
const errors: Record<string, string> = {
  callback:
    "We couldn’t finish signing you in. The sign-in link may have expired. Please try again.",
  denied:
    "Google sign-in wasn’t completed. You can try again whenever you’re ready.",
  unavailable:
    "Authentication is temporarily unavailable. Please try again shortly.",
  signout:
    "We couldn’t confirm sign-out. Please try signing out again from Settings.",
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; signed_out?: string }>;
}) {
  const params = await searchParams;
  const next = safeRedirect(params.next);
  const { user } = await getAuth();
  if (user && params.error !== "signout") redirect(next);
  const configured = Boolean(getSupabaseConfig());
  return (
    <div className="login-page page-container">
      <section className="login-story">
        <div className="login-backdrop" aria-hidden="true" />
        <span className="eyebrow">YOUR STORIES ARE WAITING</span>
        <div className="login-story-copy">
          <h1>
            A world of stories.
            <br />
            <em>A place for yours.</em>
          </h1>
          <p>Your entertainment. Your universe.</p>
        </div>
        <span className="login-art-credit">ORIGINAL SCENESTACK ARTWORK</span>
      </section>
      <section className="login-panel" aria-labelledby="login-title">
        <Brand />
        <p className="eyebrow">COME ON IN</p>
        <h2 id="login-title">
          You belong in
          <br />a good story.
        </h2>
        <p className="login-description">
          A home for your favorites. Room for your next obsession. Sign in to
          make it yours.
        </p>
        {params.error && (
          <p className="notice notice-error" role="alert">
            {errors[params.error] || errors.callback}
          </p>
        )}
        {params.signed_out === "1" && (
          <p className="notice" role="status">
            You’re signed out. See you for the next story.
          </p>
        )}
        {configured ? <GoogleSignIn next={next} /> : <SetupNotice />}
        <div className="login-benefits">
          <span>
            <Layers3 size={15} aria-hidden="true" />
            One universe for every kind of entertainment.
          </span>
          <span>
            <ShieldCheck size={15} aria-hidden="true" />
            Private tracking. Thoughtful collections.
          </span>
        </div>
        <p className="auth-privacy">
          Google is our only sign-in method. Your profile is visible to members;
          your tracking, ratings, and favorites stay private.
        </p>
        <p className="login-policy-links">
          Read our <Link href="/terms">Terms of Service</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link> before continuing.
        </p>
        <ButtonLink href="/" variant="quiet">
          Back to the home page
        </ButtonLink>
      </section>
    </div>
  );
}
