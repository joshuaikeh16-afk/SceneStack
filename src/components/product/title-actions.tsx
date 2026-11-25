"use client";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Plus,
  Heart,
  Star,
  ChevronDown,
  Layers3,
  Trash2,
  Bookmark,
  Pause,
  Play,
  Flag,
} from "lucide-react";
import { useProduct } from "./providers";
import { useTitleState, useTitleMutation } from "./title-state";
import { Confirmation } from "./confirmation";
import { CollectionPicker } from "./collection-picker";
import {
  defaultTracking,
  trackingLabel,
  statusLabels,
} from "@/lib/product/state";
import { ratingSchema } from "@/lib/validation/data";
import type { TitleView } from "@/types/product";
import type { Row } from "@/types/database";
const icons = {
  planned: Bookmark,
  watching: Play,
  completed: Check,
  on_hold: Pause,
  dropped: Flag,
};
export function TitleActions({
  view,
  hero = false,
}: {
  view: TitleView;
  hero?: boolean;
}) {
  const { bootstrap, toast, online } = useProduct();
  const router = useRouter();
  const params = useSearchParams();
  const stateQuery = useTitleState(view.id, true);
  const state = stateQuery.data;
  const mutation = useTitleMutation(view.id);
  const [ratingOpen, setRatingOpen] = useState(false),
    [collectionOpen, setCollectionOpen] = useState(false),
    [removeOpen, setRemoveOpen] = useState(false),
    [draft, setDraft] = useState("7.0");
  const [ratingError, setRatingError] = useState("");
  const attempted = useRef(false);
  const ratingTrigger = useRef<HTMLButtonElement>(null);
  const ratingInput = useRef<HTMLInputElement>(null);
  function closeRating() {
    setRatingOpen(false);
    ratingTrigger.current?.focus();
  }
  useEffect(() => {
    if (ratingOpen) {
      ratingInput.current?.focus({ preventScroll: true });
      ratingInput.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [ratingOpen]);
  const available =
    !!bootstrap.userId &&
    bootstrap.availability === "ready" &&
    bootstrap.profile?.status === "active";
  function signIn(intent: string) {
    const nonce = crypto.randomUUID();
    sessionStorage.setItem(
      "scenestack.pending-intent",
      JSON.stringify({
        titleId: view.id,
        intent,
        nonce,
        at: new Date().getTime(),
      }),
    );
    router.push(
      `${bootstrap.userId ? "/onboarding" : "/login"}?${new URLSearchParams({ next: `/titles/${view.id}?intent=${intent}&nonce=${nonce}` })}`,
    );
  }
  function allowed(intent: string) {
    if (!bootstrap.userId) {
      signIn(intent);
      return false;
    }
    if (bootstrap.onboarding && !bootstrap.onboarding.completed_at) {
      signIn(intent);
      return false;
    }
    if (!available) {
      toast(
        "This workspace’s database isn’t connected yet. Your changes were not saved.",
        true,
      );
      return false;
    }
    return true;
  }
  function openRating() {
    if (!allowed("rate")) return;
    setDraft(state?.rating?.toFixed(1) ?? "7.0");
    setRatingError("");
    setRatingOpen(true);
  }
  useEffect(() => {
    if (
      attempted.current ||
      !available ||
      !bootstrap.onboarding?.completed_at ||
      state === undefined
    )
      return;
    const intent = params.get("intent"),
      nonce = params.get("nonce");
    if (!intent || !nonce) return;
    let pending;
    try {
      pending = JSON.parse(
        sessionStorage.getItem("scenestack.pending-intent") || "null",
      );
    } catch {
      return;
    }
    if (
      !pending ||
      pending.titleId !== view.id ||
      pending.intent !== intent ||
      pending.nonce !== nonce ||
      Date.now() - pending.at > 1800000
    )
      return;
    attempted.current = true;
    sessionStorage.removeItem("scenestack.pending-intent");
    window.setTimeout(() => {
      if (intent === "collection") setCollectionOpen(true);
      else if (intent === "rate") {
        setDraft(state.rating?.toFixed(1) ?? "7.0");
        setRatingOpen(true);
      } else if (intent === "favorite")
        mutation.mutate({
          action: "favorite",
          titleId: view.id,
          enabled: true,
        });
      else if (intent === "watched" || intent === "watching")
        mutation.mutate({
          action: "track",
          titleId: view.id,
          status: intent === "watched" ? "completed" : "watching",
        });
      router.replace(`/titles/${view.id}`, { scroll: false });
    }, 0);
  }, [
    available,
    bootstrap.onboarding?.completed_at,
    view.id,
    params,
    state,
    mutation,
    router,
  ]);
  const pending =
    mutation.isPending ||
    (available && (stateQuery.isPending || stateQuery.isError));
  const blocked = pending || !online;
  const label = trackingLabel(state, view.title, view.edition);
  const sliderValue = Math.min(10, Math.max(1, Number(draft) || 1));
  const statusMenu = (trigger: React.ReactNode) => (
    <Menu.Root>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className="tracking-menu"
          sideOffset={8}
          collisionPadding={14}
          align="start"
        >
          <Menu.Label>My tracking status</Menu.Label>
          <Menu.RadioGroup
            value={state?.tracking ?? ""}
            onValueChange={(value) => {
              if (allowed("watching"))
                mutation.mutate({
                  action: "track",
                  titleId: view.id,
                  status: value as Row<"tracking">["status"],
                });
            }}
          >
            {Object.entries(statusLabels).map(([value, text]) => {
              const Icon = icons[value as keyof typeof icons];
              return (
                <Menu.RadioItem key={value} value={value} disabled={blocked}>
                  <Icon size={16} aria-hidden="true" />
                  <span>
                    {value === "completed" &&
                    defaultTracking(view.title, view.edition) === "completed"
                      ? "Watched"
                      : text}
                  </span>
                  <Menu.ItemIndicator>
                    <Check size={16} />
                  </Menu.ItemIndicator>
                </Menu.RadioItem>
              );
            })}
          </Menu.RadioGroup>
          {state?.tracking && (
            <>
              <Menu.Separator />
              <Menu.Item
                className="destructive-menu-item"
                disabled={blocked}
                onSelect={() => setRemoveOpen(true)}
              >
                <Trash2 size={16} />
                Remove from Library
              </Menu.Item>
            </>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
  return (
    <div
      className={`title-actions ${hero ? "title-actions-hero" : "title-actions-detail"}`}
    >
      {!hero && stateQuery.isError && (
        <div className="inline-error">
          <p>Your private title state is unavailable.</p>
          <button className="text-link" onClick={() => stateQuery.refetch()}>
            Try again
          </button>
        </div>
      )}
      <div className="tracking-button-group">
        {state?.tracking ? (
          statusMenu(
            <button className="button button-tracked" disabled={blocked}>
              <Check size={17} aria-hidden="true" />
              {label}
              <ChevronDown size={14} />
            </button>,
          )
        ) : (
          <button
            className="button button-primary"
            disabled={blocked}
            aria-busy={pending}
            onClick={() => {
              const desired = defaultTracking(view.title, view.edition);
              if (allowed(desired === "completed" ? "watched" : "watching"))
                mutation.mutate({
                  action: "track",
                  titleId: view.id,
                  status: desired,
                });
            }}
          >
            <Plus size={17} aria-hidden="true" />
            {label}
          </button>
        )}
        {!state?.tracking &&
          available &&
          statusMenu(
            <button
              className="button button-secondary status-more"
              disabled={blocked}
              aria-label="Choose tracking status"
            >
              <ChevronDown size={16} />
            </button>,
          )}
      </div>
      {!hero && (
        <div className="title-secondary-actions">
          <button
            className={`button button-secondary favorite-control ${state?.favorite ? "is-favorite" : ""}`}
            aria-label={state?.favorite ? "Remove favorite" : "Favorite title"}
            aria-pressed={state?.favorite ?? false}
            disabled={blocked}
            onClick={() => {
              if (allowed("favorite"))
                mutation.mutate({
                  action: "favorite",
                  titleId: view.id,
                  enabled: !state?.favorite,
                });
            }}
          >
            <Heart size={19} fill={state?.favorite ? "currentColor" : "none"} />
            {!hero && <span>Favorite</span>}
          </button>
          <button
            className={`button button-secondary ${state?.rating !== null && state?.rating !== undefined ? "is-rated" : ""}`}
            disabled={blocked}
            ref={ratingTrigger}
            aria-expanded={ratingOpen}
            onClick={openRating}
          >
            <Star size={17} />
            {state?.rating !== null && state?.rating !== undefined ? (
              <>
                <span>Your rating</span>{" "}
                <strong>{state.rating.toFixed(1)}</strong>
              </>
            ) : (
              "Rate"
            )}
          </button>
          <button
            className="button button-secondary collection-control"
            aria-label="Add to collection"
            disabled={blocked}
            onClick={() => {
              if (allowed("collection")) setCollectionOpen(true);
            }}
          >
            <Layers3 size={17} />
            {!hero && "Add to Collection"}
          </button>
        </div>
      )}
      {!hero && ratingOpen && (
        <section
          role="region"
          aria-label={`Rate ${view.title.name}`}
          className="inline-rating-editor"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              if (!pending) closeRating();
            }
          }}
        >
          <div className="rating-editor-heading">
            <h3>Your rating</h3>
            <p>Private to you · 1.0–10.0</p>
          </div>
          <div className="dialog-body rating-dialog">
            <div className="rating-title">
              <div
                className="rating-thumbnail"
                style={
                  view.title.posterUrl
                    ? { backgroundImage: `url('${view.title.posterUrl}')` }
                    : undefined
                }
              />
              <div>
                <h3>{view.title.name}</h3>
                <p>{view.title.releaseYear ?? ""}</p>
              </div>
            </div>
            <label htmlFor={`rating-${view.id}`}>Your rating</label>
            <div className="rating-number">
              <input
                ref={ratingInput}
                id={`rating-${view.id}`}
                type="number"
                inputMode="decimal"
                min="1"
                max="10"
                step="0.1"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={blocked}
              />
              <span>/ 10</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="0.1"
              value={sliderValue}
              aria-valuetext={`${sliderValue.toFixed(1)} out of 10`}
              aria-label="Adjust your rating"
              onChange={(event) =>
                setDraft(Number(event.target.value).toFixed(1))
              }
              disabled={blocked}
            />
            <p className="form-error" role="alert">
              {ratingError}
            </p>
            <div className="dialog-actions">
              {state?.rating !== null && state?.rating !== undefined && (
                <button
                  className="text-link danger-text"
                  disabled={blocked}
                  onClick={async () => {
                    try {
                      await mutation.mutateAsync({
                        action: "rate",
                        titleId: view.id,
                        rating: null,
                      });
                      closeRating();
                    } catch (error) {
                      setRatingError(
                        error instanceof Error
                          ? error.message
                          : "Your rating could not be saved. Please try again.",
                      );
                    }
                  }}
                >
                  Remove Rating
                </button>
              )}
              <button
                className="button button-secondary"
                disabled={pending}
                onClick={closeRating}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                disabled={blocked}
                onClick={async () => {
                  const parsed = ratingSchema.safeParse(Number(draft));
                  if (!parsed.success) {
                    setRatingError(
                      "Enter a number from 1.0 to 10.0 with at most one decimal place.",
                    );
                    return;
                  }
                  try {
                    await mutation.mutateAsync({
                      action: "rate",
                      titleId: view.id,
                      rating: parsed.data,
                    });
                    closeRating();
                  } catch (error) {
                    setRatingError(
                      error instanceof Error
                        ? error.message
                        : "Your rating could not be saved. Please try again.",
                    );
                  }
                }}
              >
                {pending ? "Saving…" : "Save Rating"}
              </button>
            </div>
          </div>
        </section>
      )}
      <Confirmation
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove this title from tracking?"
        description="Your rating and favorite stay exactly as they are."
        confirmLabel="Remove from Library"
        danger
        onConfirm={async () => {
          await mutation.mutateAsync({
            action: "track",
            titleId: view.id,
            status: null,
          });
        }}
      />
      {mutation.isError && !ratingOpen && (
        <p className="form-error title-action-error" role="alert">
          {mutation.error.message}
        </p>
      )}
      {!hero && (
        <CollectionPicker
          open={collectionOpen}
          onOpenChange={setCollectionOpen}
          titleIds={[view.id]}
          titleName={view.title.name}
        />
      )}
    </div>
  );
}
