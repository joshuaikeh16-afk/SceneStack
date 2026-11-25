"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { recoverMyAccount } from "@/app/actions/account";
import { useProduct, unwrap } from "./providers";
export function Recovery({ until }: { until: string | null }) {
  const { bootstrap } = useProduct();
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const recoverable = bootstrap.profile?.status === "deletion_pending";
  return (
    <section className="recovery-card">
      <p className="eyebrow">AN INTERMISSION, PERHAPS.</p>
      <h1>
        {recoverable
          ? "Your universe is still here."
          : "Your account is unavailable."}
      </h1>
      <p>
        {recoverable
          ? `Your account is hidden. ${until ? `You can recover it until ${new Date(until).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "long" })}.` : "Recovery is available for 30 days after the deletion request."} Start with a fresh Google sign-in, then restore your account.`
          : "This account is suspended, banned, or being permanently deleted. Contact the platform owner if you believe this is an error."}
      </p>
      {recoverable && (
        <>
          <GoogleSignIn next="/account/recovery" reauthenticate />
          <button
            className="button button-primary"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                unwrap(await recoverMyAccount());
                router.replace("/library");
                router.refresh();
              } catch {
                setError(
                  "Recovery needs a fresh Google sign-in after your deletion request, within the last five minutes. Use the Google button above and try again before the recovery deadline.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Restoring…" : "Restore my account"}
          </button>
        </>
      )}
      <p className="form-error" role="alert">
        {error}
      </p>
      <SignOutButton />
    </section>
  );
}
