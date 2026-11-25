"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useQuery,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import {
  Settings,
  Pencil,
  UserPlus,
  Check,
  Flag,
  ShieldOff,
  Lock,
} from "lucide-react";
import {
  followCreator,
  blockCreator,
  editMyProfile,
  uploadPersonalImage,
} from "@/app/actions/profile";
import { CreateCollectionDialog } from "./create-collection";
import { ImageUpload } from "./image-upload";
import { ProductDialog } from "./dialog";
import { Confirmation } from "./confirmation";
import { ReportDialog } from "./submissions";
import {
  fetchData,
  unwrap,
  useProduct,
  useInvalidateProduct,
} from "./providers";
import { CollectionCard, assetUrl } from "./collection-card";
import { DataNotice, QuietEmpty } from "./availability";
import type { ProfileView, CollectionView } from "@/types/product";
export type CreatorData = {
  profile: ProfileView;
  collections: CollectionView[];
  followers: number;
  following: number;
  isFollowing: boolean;
  featuredCollection?: CollectionView | null;
};
export function CreatorProfile({
  initial,
  own = false,
}: {
  initial: CreatorData | null;
  own?: boolean;
}) {
  const { bootstrap, toast, online } = useProduct();
  const queryClient = useQueryClient();
  const router = useRouter();
  const invalidate = useInvalidateProduct();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false),
    [blocking, setBlocking] = useState(false),
    [report, setReport] = useState(false),
    [pending, setPending] = useState(false);
  const slug =
    initial?.profile.username ||
    initial?.profile.id ||
    (own ? bootstrap.userId : null);
  const query = useQuery({
    queryKey: ["profile", bootstrap.userId, slug],
    queryFn: ({ signal }) =>
      fetchData<CreatorData | null>(
        "profile",
        { id: slug ?? undefined },
        signal,
      ),
    initialData: initial,
    enabled: bootstrap.availability === "ready" && !!slug,
  });
  const collectionPages = useInfiniteQuery({
    queryKey: [
      "profile",
      "collections",
      bootstrap.userId,
      query.data?.profile.id,
    ],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      fetchData<CollectionView[]>(
        "profile-collections",
        { id: query.data?.profile.id, page: pageParam },
        signal,
      ),
    getNextPageParam: (last, pages) =>
      last.length === 24 ? pages.length + 1 : undefined,
    initialData: initial
      ? { pages: [initial.collections], pageParams: [1] }
      : undefined,
    enabled: !!query.data && bootstrap.availability === "ready",
  });
  const counts = useQuery({
    queryKey: ["library", bootstrap.userId, "counts"],
    queryFn: ({ signal }) =>
      fetchData<Record<string, number>>("my-counts", {}, signal),
    enabled: own && bootstrap.availability === "ready",
  });
  const data = query.data;
  const profile = data?.profile || (own ? bootstrap.profile : null);
  if (bootstrap.availability !== "ready")
    return <DataNotice state={bootstrap.availability} />;
  if (!data && query.isPending)
    return (
      <p className="profile-loading" role="status">
        Loading your profile…
      </p>
    );
  if (!data && query.isError)
    return (
      <div className="inline-error" role="alert">
        <p>{query.error.message}</p>
        <button
          className="button button-secondary"
          onClick={() => query.refetch()}
        >
          Try again
        </button>
      </div>
    );
  if (!data)
    return (
      <QuietEmpty
        title="This profile is unavailable."
        description="It may be inactive or no longer available."
        action={{ label: "Explore Discover", href: "/discover" }}
      />
    );
  return (
    <>
      <DataNotice state={bootstrap.availability} />
      <section className="real-profile-header">
        <div className="profile-banner-art">
          {profile?.cover_path && (
            <Image
              unoptimized
              src={assetUrl("avatar", profile.cover_path)}
              alt=""
              fill
              sizes="(max-width:600px) 100vw, 1200px"
            />
          )}
        </div>
        <div className="real-profile-top">
          <div className="profile-avatar">
            {profile?.avatar_path ? (
              <Image
                unoptimized
                src={assetUrl("avatar", profile.avatar_path)}
                alt=""
                fill
                sizes="100px"
              />
            ) : (
              <span>
                {(profile?.display_name || bootstrap.name)
                  .split(" ")
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")}
              </span>
            )}
          </div>
          <div className="profile-main-copy">
            <p className="eyebrow">
              {own ? "YOUR CORNER OF THE UNIVERSE" : "A FELLOW STORY LOVER"}
            </p>
            <h1>{profile?.display_name || bootstrap.name}</h1>
            <p className="profile-username">
              {profile?.username
                ? `@${profile.username}`
                : "Choose your username during setup"}
            </p>
            <p className="profile-bio">
              {profile?.bio ||
                (own ? "A few words about you, and the stories you love." : "")}
            </p>
            {data && (
              <div className="profile-counts">
                <span>
                  <strong>{data.followers}</strong> followers
                </span>
                <span>
                  <strong>{data.following}</strong> following
                </span>
              </div>
            )}
          </div>
          <div className="profile-action-buttons">
            {own ? (
              <>
                <button
                  className="button button-secondary"
                  disabled={!profile || bootstrap.availability !== "ready"}
                  onClick={() => setEditing(true)}
                >
                  <Pencil size={16} />
                  Edit profile
                </button>
                <Link
                  className="icon-button"
                  href="/settings"
                  aria-label="Account settings"
                >
                  <Settings size={20} />
                </Link>
                {bootstrap.roles.length > 0 && (
                  <Link className="button button-secondary" href="/admin">
                    Administration
                  </Link>
                )}
              </>
            ) : (
              <>
                <button
                  className={`button ${data?.isFollowing ? "button-secondary" : "button-primary"}`}
                  disabled={pending || !online}
                  onClick={async () => {
                    const profileKey = ["profile", bootstrap.userId, slug];
                    await queryClient.cancelQueries({ queryKey: profileKey });
                    const previous =
                      queryClient.getQueryData<CreatorData | null>(profileKey);
                    const enabled = !data?.isFollowing;
                    if (previous)
                      queryClient.setQueryData(profileKey, {
                        ...previous,
                        isFollowing: enabled,
                        followers: Math.max(
                          0,
                          previous.followers + (enabled ? 1 : -1),
                        ),
                      });
                    setPending(true);
                    try {
                      unwrap(
                        await followCreator({
                          id: profile?.id,
                          enabled,
                        }),
                      );
                      await invalidate();
                      toast(
                        data?.isFollowing
                          ? "Unfollowed creator."
                          : "You’re following this creator.",
                      );
                    } catch (e) {
                      if (previous)
                        queryClient.setQueryData(profileKey, previous);
                      toast(
                        e instanceof Error ? e.message : "Please try again.",
                        true,
                      );
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  {data?.isFollowing ? (
                    <Check size={16} />
                  ) : (
                    <UserPlus size={16} />
                  )}{" "}
                  {data?.isFollowing ? "Following" : "Follow"}
                </button>
                <button
                  className="icon-button"
                  aria-label="Report creator"
                  onClick={() => setReport(true)}
                >
                  <Flag size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Block creator"
                  onClick={() => setBlocking(true)}
                >
                  <ShieldOff size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </section>
      {own && counts.data && (
        <section className="private-profile-summary">
          <div>
            <Lock size={16} />
            <span>Only you can see this</span>
          </div>
          <div>
            {Object.entries(counts.data).map(([name, count]) => (
              <Link href="/library" key={name}>
                <strong>{count}</strong>
                <span>
                  {name === "tracking"
                    ? "Tracked titles"
                    : name[0].toUpperCase() + name.slice(1)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {own && counts.isError && (
        <div className="inline-error">
          <p>Your private library summary could not be loaded.</p>
          <button className="text-link" onClick={() => counts.refetch()}>
            Try again
          </button>
        </div>
      )}
      {data?.featuredCollection && (
        <section className="featured-profile-collection">
          <p className="eyebrow">
            FEATURED BY {own ? "YOU" : data.profile.display_name.toUpperCase()}
          </p>
          <CollectionCard view={data.featuredCollection} />
        </section>
      )}
      <CreateCollectionDialog
        key={creating ? "create-open" : "create-closed"}
        open={creating}
        onOpenChange={setCreating}
      />
      <section className="product-shelf">
        <div className="shelf-heading">
          <div>
            <p className="eyebrow">
              A WINDOW INTO {own ? "YOUR" : "THEIR"} WORLD
            </p>
            <h2>Published collections</h2>
          </div>
          {own && <Link href="/library">My collections →</Link>}
        </div>
        {query.isError && (
          <p className="form-error" role="alert">
            {query.error.message}
          </p>
        )}
        <div className="product-collection-grid">
          {collectionPages.data?.pages.flat().map((c) => (
            <CollectionCard view={c} key={c.record.id} />
          ))}
        </div>
        {collectionPages.isPending && (
          <p role="status">Loading published collections…</p>
        )}
        {collectionPages.hasNextPage && (
          <button
            className="button button-secondary load-more"
            disabled={collectionPages.isFetchingNextPage}
            onClick={() => collectionPages.fetchNextPage()}
          >
            More collections
          </button>
        )}
        {collectionPages.isError && (
          <p className="form-error" role="alert">
            {collectionPages.error.message}
          </p>
        )}
        {collectionPages.isSuccess &&
          !collectionPages.data?.pages.flat().length && (
            <QuietEmpty
              title={
                own
                  ? "Your taste tells a story."
                  : "Their next collection is still taking shape."
              }
              description={
                own
                  ? "Publish a collection to share a window into your world."
                  : "Published collections will appear here."
              }
              action={
                own
                  ? { label: "Visit my collections", href: "/library" }
                  : undefined
              }
            />
          )}
        <p className="privacy-caption">
          <Lock size={14} />
          Watching history, favorites, and personal ratings stay private.
        </p>
      </section>
      {profile && (
        <>
          <EditProfileDialog
            key={editing ? "edit" : "closed"}
            open={editing}
            onOpenChange={setEditing}
            profile={profile}
          />
          <Confirmation
            open={blocking}
            onOpenChange={setBlocking}
            title={`Block ${profile.display_name}?`}
            description="You’ll stop following each other. Their profile and collections will be hidden, and both of you lose access to each other’s interactions."
            danger
            confirmLabel="Block creator"
            onConfirm={async () => {
              unwrap(await blockCreator({ id: profile.id, enabled: true }));
              await invalidate();
              router.replace("/discover?tab=people");
            }}
          />
          <ReportDialog
            open={report}
            onOpenChange={setReport}
            userId={profile.id}
          />
        </>
      )}
    </>
  );
}
export function EditProfileDialog({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile: ProfileView;
}) {
  const { toast, online } = useProduct();
  const router = useRouter();
  const invalidate = useInvalidateProduct();
  const collectionOptions = useInfiniteQuery({
    queryKey: ["collections", "featured-options", profile.id],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      fetchData<CollectionView[]>(
        "own-collections",
        { page: pageParam },
        signal,
      ),
    getNextPageParam: (last, pages) =>
      last.length === 50 ? pages.length + 1 : undefined,
    enabled: open,
  });
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <ProductDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Make it feel like you."
      description="Your username is permanent. Your name, photo, and bio can grow with you."
      className="dialog-medium"
    >
      <form
        className="dialog-body product-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setPending(true);
          setError("");
          try {
            let avatarPath = profile.avatar_path;
            const file = f.get("avatar");
            if (file instanceof File && file.size) {
              const form = new FormData();
              form.set("kind", "avatar");
              form.set("file", file);
              avatarPath = unwrap(await uploadPersonalImage(form)).path;
            }
            if (f.get("removeAvatar")) avatarPath = null;
            let coverPath = profile.cover_path;
            const cover = f.get("profileCover");
            if (cover instanceof File && cover.size) {
              const upload = new FormData();
              upload.set("kind", "profile-cover");
              upload.set("file", cover);
              coverPath = unwrap(await uploadPersonalImage(upload)).path;
            }
            if (f.has("removeCover")) coverPath = null;
            unwrap(
              await editMyProfile({
                displayName: f.get("displayName"),
                bio: f.get("bio"),
                avatarPath,
                coverPath,
                featuredCollectionId: f.get("featuredCollection") || null,
              }),
            );
            await invalidate();
            router.refresh();
            toast("Profile updated.");
            onOpenChange(false);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Please try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        <label>
          Display name
          <input
            name="displayName"
            defaultValue={profile.display_name}
            minLength={1}
            maxLength={80}
            required
          />
        </label>
        <label>
          Username
          <input readOnly value={profile.username || "Not set yet"} />
        </label>
        <label>
          Bio
          <textarea
            name="bio"
            defaultValue={profile.bio}
            maxLength={500}
            rows={4}
          />
        </label>
        <ImageUpload
          name="avatar"
          label="Profile photo"
          maxMB={3}
          initial={
            profile.avatar_path ? assetUrl("avatar", profile.avatar_path) : null
          }
          disabled={pending || !online}
        />
        {profile.avatar_path && (
          <label className="check-label">
            <input name="removeAvatar" type="checkbox" />
            Remove profile photo
          </label>
        )}
        <ImageUpload
          name="profileCover"
          label="Optional profile cover"
          maxMB={3}
          initial={
            profile.cover_path ? assetUrl("avatar", profile.cover_path) : null
          }
          disabled={pending || !online}
        />
        {profile.cover_path && (
          <label className="check-label">
            <input name="removeCover" type="checkbox" />
            Remove cover image
          </label>
        )}
        <label>
          Featured published collection
          <select
            name="featuredCollection"
            defaultValue={profile.featured_collection_id ?? ""}
          >
            <option value="">No featured collection</option>
            {profile.featured_collection_id &&
              !collectionOptions.data?.pages
                .flat()
                .some(
                  (c) => c.record.id === profile.featured_collection_id,
                ) && (
                <option value={profile.featured_collection_id}>
                  Current featured collection
                </option>
              )}
            {collectionOptions.data?.pages
              .flat()
              .filter((c) => c.record.visibility === "published")
              .map((c) => (
                <option key={c.record.id} value={c.record.id}>
                  {c.record.title}
                </option>
              ))}
          </select>
          <small>Only your own published collections can be featured.</small>
        </label>
        {collectionOptions.hasNextPage && (
          <button
            type="button"
            className="text-link"
            onClick={() => collectionOptions.fetchNextPage()}
            disabled={collectionOptions.isFetchingNextPage}
          >
            Load more collections to choose from
          </button>
        )}
        <p className="form-error" role="alert">
          {error}
        </p>
        <button className="button button-primary" disabled={pending || !online}>
          {pending ? "Saving…" : "Save profile"}
        </button>
      </form>
    </ProductDialog>
  );
}
