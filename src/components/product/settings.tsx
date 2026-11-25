"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { FileDown, ShieldCheck, LogOut } from "lucide-react";
import {
  useProduct,
  fetchData,
  unwrap,
  useInvalidateProduct,
} from "./providers";
import { savePreferences, blockCreator } from "@/app/actions/profile";
import { exportMyData, requestDeletion } from "@/app/actions/account";
import { categories } from "@/config/categories";
import type { Row } from "@/types/database";
import type { LookupData } from "@/types/product";
import { DataNotice } from "./availability";
import { ProductDialog } from "./dialog";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { EditProfileDialog } from "./profile";
export type PreferencesData = {
  categories: { category: Row<"titles">["kind"] }[] | null;
  genres: { genre_id: string }[] | null;
  notifications: Row<"notification_preferences"> | null;
  recommendations: Row<"recommendation_preferences"> | null;
  onboarding: { completed_at: string | null } | null;
};
export function SettingsContent() {
  const { bootstrap, toast, online } = useProduct();
  const router = useRouter();
  const invalidate = useInvalidateProduct();
  const [deleting, setDeleting] = useState(false),
    [editing, setEditing] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["preferences", bootstrap.userId],
    queryFn: ({ signal }) =>
      fetchData<PreferencesData>("preferences", {}, signal),
    enabled: bootstrap.availability === "ready",
  });
  const lookups = useQuery({
    queryKey: ["lookups"],
    queryFn: ({ signal }) => fetchData<LookupData>("lookups", {}, signal),
    enabled: bootstrap.availability === "ready",
  });
  async function download(format: "json" | "csv") {
    setPending(true);
    try {
      const data = unwrap(await exportMyData(format));
      const url = URL.createObjectURL(
        new Blob([data.body], { type: data.contentType }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("Your export is ready.");
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Export failed. Please try again.",
        true,
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <DataNotice state={bootstrap.availability} />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {[
            ["account", "Account"],
            ["discovery", "Your interests"],
            ["notifications", "Notifications"],
            ["recommendations", "Recommendations"],
            ["blocked", "Blocked accounts"],
            ["your-data", "Your data"],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>
        <div className="settings-content">
          <section id="account" className="settings-section">
            <div className="settings-section-heading">
              <h2>Account</h2>
              <span className="badge">Google connected</span>
            </div>
            <h3>{bootstrap.profile?.display_name || bootstrap.name}</h3>
            <p>{bootstrap.email || "Email not shared by Google"}</p>
            <p className="settings-help">
              <ShieldCheck size={15} />
              Your sign-in uses Google. There’s no SceneStack password to
              manage.
            </p>
            <button
              className="button button-secondary"
              onClick={() => setEditing(true)}
              disabled={!bootstrap.profile}
            >
              Edit profile
            </button>
          </section>
          {query.isPending && bootstrap.availability === "ready" && (
            <p role="status">Loading your preferences…</p>
          )}
          {query.isError && (
            <div className="inline-error">
              <p>{query.error.message}</p>
              <button onClick={() => query.refetch()}>Try again</button>
            </div>
          )}
          {query.data && (
            <PreferencesForm
              key={query.data.notifications?.updated_at || "prefs"}
              data={query.data}
              lookup={lookups.data}
              onSaved={async () => {
                await query.refetch();
                await invalidate();
              }}
            />
          )}
          <section id="blocked" className="settings-section">
            <h2>Blocked accounts</h2>
            <p>
              Blocking hides profiles, collections, and interactions in both
              directions.
            </p>
            {bootstrap.availability === "ready" && <BlockedAccounts />}
          </section>
          <section className="settings-section">
            <h2>On your home screen</h2>
            <p>
              SceneStack can be installed from your browser’s Install app or Add
              to Home Screen menu where supported. Offline mode includes the app
              shell and explicitly licensed public title copies. Your private
              library and account images are never stored in the offline cache.
            </p>
          </section>
          <section id="your-data" className="settings-section">
            <h2>Your data</h2>
            <p>
              Your tracking, ratings, favorites, preferences, and collections
              belong to you.
            </p>
            <div className="export-actions">
              <button
                className="button button-secondary"
                disabled={
                  pending || bootstrap.availability !== "ready" || !online
                }
                onClick={() => download("json")}
              >
                <FileDown size={16} />
                Export JSON
              </button>
              <button
                className="button button-secondary"
                disabled={
                  pending || bootstrap.availability !== "ready" || !online
                }
                onClick={() => download("csv")}
              >
                Export CSV
              </button>
            </div>
            <div className="danger-zone">
              <h3>Delete your account</h3>
              <p>
                Your public profile and collections are hidden immediately. You
                have 30 days to return and recover your account with a fresh
                Google sign-in. Permanent deletion requires the account
                lifecycle worker to run.
              </p>
              <button
                className="button button-danger"
                disabled={
                  pending || bootstrap.availability !== "ready" || !online
                }
                onClick={() => setDeleting(true)}
              >
                Delete account
              </button>
            </div>
          </section>
          <section className="settings-section signout-section">
            <div>
              <h2>
                <LogOut size={18} />
                Taking an intermission?
              </h2>
              <p>Sign out on this device.</p>
            </div>
            <SignOutButton />
          </section>
        </div>
      </div>
      {bootstrap.profile && (
        <EditProfileDialog
          key={editing ? "editing" : "closed"}
          profile={bootstrap.profile}
          open={editing}
          onOpenChange={setEditing}
        />
      )}
      <ProductDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Leave your universe behind?"
        description="Your account will be hidden immediately. You can recover it for 30 days by signing in again with Google. After that, permanent deletion is handled by the lifecycle worker."
        className="dialog-small"
      >
        <form
          className="dialog-body product-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const confirmation = new FormData(e.currentTarget).get(
              "confirmation",
            );
            setPending(true);
            setError("");
            try {
              unwrap(await requestDeletion(confirmation));
              router.replace("/account/recovery");
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Please try again.");
            } finally {
              setPending(false);
            }
          }}
        >
          <label>
            Type “
            {bootstrap.profile?.username || bootstrap.profile?.display_name}” to
            confirm
            <input name="confirmation" required autoComplete="off" />
          </label>
          <p className="form-error" role="alert">
            {error}
          </p>
          <button
            className="button button-danger"
            disabled={pending || !online}
          >
            {pending ? "Requesting deletion…" : "Request account deletion"}
          </button>
        </form>
      </ProductDialog>
    </>
  );
}
function PreferencesForm({
  data,
  lookup,
  onSaved,
}: {
  data: PreferencesData;
  lookup?: LookupData;
  onSaved: () => Promise<void>;
}) {
  const { toast, online } = useProduct();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const disabled = pending || !online;
  return (
    <form
      className="preferences-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setPending(true);
        setError("");
        try {
          unwrap(
            await savePreferences({
              categories: f.getAll("categories"),
              genres: f.getAll("genres"),
              notifications: {
                enabled: f.has("notifications"),
                newFollowers: f.has("newFollowers"),
                collectionFavorites: f.has("collectionFavorites"),
                followedCollections: f.has("followedCollections"),
              },
              recommendations: {
                enabled: f.has("recommendations"),
                includeMature: f.has("includeMature"),
                diversify: f.has("diversify"),
                rememberSearches: f.has("rememberSearches"),
                rememberViewed: f.has("rememberViewed"),
              },
            }),
          );
          await onSaved();
          toast("Your preferences are saved.");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Please try again.");
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={disabled} id="discovery" className="settings-section">
        <legend>Your interests</legend>
        <p>A few good starting points for discovering what comes next.</p>
        <div className="preference-chips">
          {categories.map((c) => (
            <label key={c.value}>
              <input
                type="checkbox"
                name="categories"
                value={c.value}
                defaultChecked={data.categories?.some(
                  (x) => x.category === c.value,
                )}
              />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
        <h3>Favorite genres</h3>
        <div className="preference-chips">
          {lookup?.genres.map((g) => (
            <label key={g.id}>
              <input
                type="checkbox"
                name="genres"
                value={g.id}
                defaultChecked={data.genres?.some((x) => x.genre_id === g.id)}
              />
              <span>{g.name}</span>
            </label>
          ))}
        </div>
        {lookup?.genres.length === 0 && (
          <p>Genre choices will appear when the catalog is connected.</p>
        )}
      </fieldset>
      <fieldset
        disabled={disabled}
        id="notifications"
        className="settings-section"
      >
        <legend>Notifications</legend>
        <Toggle
          name="notifications"
          title="Keep me in the loop"
          copy="Enable collection and community notifications."
          checked={data.notifications?.enabled ?? true}
        />
        <Toggle
          name="newFollowers"
          title="New followers"
          checked={data.notifications?.new_followers ?? true}
        />
        <Toggle
          name="collectionFavorites"
          title="Favorites on my collections"
          checked={data.notifications?.collection_favorites ?? true}
        />
        <Toggle
          name="followedCollections"
          title="New collections from creators I follow"
          checked={data.notifications?.followed_collections ?? true}
        />
      </fieldset>
      <fieldset
        disabled={disabled}
        id="recommendations"
        className="settings-section"
      >
        <legend>Recommendations</legend>
        <Toggle
          name="recommendations"
          title="Find stories for me"
          copy="Use my categories, genres, favorites, and ratings for explainable suggestions."
          checked={data.recommendations?.enabled ?? true}
        />
        <Toggle
          name="diversify"
          title="Leave room for discovery"
          copy="Mix familiar interests with something different."
          checked={data.recommendations?.diversify ?? true}
        />
        <Toggle
          name="includeMature"
          title="Include mature titles"
          checked={data.recommendations?.include_mature ?? false}
        />
        <Toggle
          name="rememberSearches"
          title="Remember recent searches"
          copy="Off by default. Only submitted searches are kept privately, up to eight for 30 days. Turning this off clears them."
          checked={data.recommendations?.remember_searches ?? false}
        />
        <Toggle
          name="rememberViewed"
          title="Remember recently viewed titles"
          copy="Keep up to 40 title IDs privately for 90 days. Turning this off clears them."
          checked={data.recommendations?.remember_viewed ?? true}
        />
      </fieldset>
      <p className="form-error" role="alert">
        {error}
      </p>
      <button
        className="button button-primary preferences-save"
        disabled={pending || !online}
      >
        {pending ? "Saving…" : "Save preferences"}
      </button>
    </form>
  );
}
function Toggle({
  name,
  title,
  copy,
  checked,
}: {
  name: string;
  title: string;
  copy?: string;
  checked: boolean;
}) {
  return (
    <label className="preference-toggle">
      <span>
        <strong>{title}</strong>
        {copy && <small>{copy}</small>}
      </span>
      <input type="checkbox" name={name} defaultChecked={checked} />
    </label>
  );
}
function BlockedAccounts() {
  const { bootstrap, toast, online } = useProduct();
  const [pending, setPending] = useState(false);
  const query = useInfiniteQuery({
    queryKey: ["blocked", bootstrap.userId],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      fetchData<
        {
          blocked_id: string;
          created_at: string;
          display_name: string;
          username: string | null;
        }[]
      >("blocked", { page: pageParam }, signal),
    getNextPageParam: (last, pages) =>
      last.length === 24 ? pages.length + 1 : undefined,
  });
  return (
    <div className="blocked-list">
      {query.isPending && <p>Loading blocked accounts…</p>}
      {query.isError && <p className="form-error">{query.error.message}</p>}
      {query.data?.pages.flat().map((p) => (
        <div key={p.blocked_id}>
          <span>
            {p.display_name} {p.username ? `(@${p.username})` : ""}
          </span>
          <button
            className="button button-secondary"
            disabled={pending || !online}
            onClick={async () => {
              setPending(true);
              try {
                unwrap(
                  await blockCreator({ id: p.blocked_id, enabled: false }),
                );
                await query.refetch();
                toast("Account unblocked.");
              } catch (e) {
                toast(
                  e instanceof Error ? e.message : "Please try again.",
                  true,
                );
              } finally {
                setPending(false);
              }
            }}
          >
            Unblock
          </button>
        </div>
      ))}
      {!query.data?.pages[0].length && !query.isPending && !query.isError && (
        <p className="muted-copy">You haven’t blocked anyone.</p>
      )}
      {query.hasNextPage && (
        <button className="text-link" onClick={() => query.fetchNextPage()}>
          Load more blocked accounts
        </button>
      )}
    </div>
  );
}
