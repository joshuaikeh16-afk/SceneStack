"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { controlFetch } from "@/lib/control/client";
import { controlMutation } from "@/app/actions/control";
import { unwrap, useProduct } from "./providers";
type Invitation = { id: string; status: string; expires_at: string };
export function TeamInvitations() {
  const client = useQueryClient(),
    router = useRouter(),
    { toast, bootstrap } = useProduct();
  const [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState(false);
  const query = useQuery({
    queryKey: ["control-invitations", bootstrap.userId],
    queryFn: () => controlFetch<Invitation[]>("invitations"),
    refetchInterval: 30000,
  });
  async function respond(id: string, accept: boolean) {
    setBusy(true);
    try {
      unwrap(
        await controlMutation({ operation: "invitation_reply", id, accept }),
      );
      setAccepted(accept);
      await client.invalidateQueries();
      router.refresh();
      toast(accept ? "Moderator access granted." : "Invitation declined.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Please retry.", true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-section">
      <h2>Help care for the SceneStack community</h2>
      <p>
        Moderators review reports and corrections, enforce community rules
        fairly, protect private information, and record reasons for
        administrative decisions. Accept only if you agree to these
        responsibilities. Your access begins after acceptance.
      </p>
      {accepted && (
        <Link className="cc-button primary" href="/admin">
          Open admin dashboard
        </Link>
      )}
      {query.isPending ? (
        <p role="status">Loading invitations…</p>
      ) : query.isError ? (
        <button onClick={() => query.refetch()}>Retry invitations</button>
      ) : !query.data?.length ? (
        <p>No team invitations.</p>
      ) : (
        query.data.map((item) => {
          const status =
            item.status === "pending" &&
            Date.parse(item.expires_at) <= (query.dataUpdatedAt || 0)
              ? "expired"
              : item.status;
          return (
            <article key={item.id} className="settings-section">
              <h3>Moderator invitation</h3>
              <p>Status: {status}</p>
              {status === "pending" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <button
                    className="cc-button primary"
                    disabled={busy}
                    onClick={() => respond(item.id, true)}
                  >
                    Accept
                  </button>
                  <button
                    className="cc-button"
                    disabled={busy}
                    onClick={() => respond(item.id, false)}
                  >
                    Decline
                  </button>
                </div>
              )}
            </article>
          );
        })
      )}
    </section>
  );
}
