"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";
import { categories } from "@/config/categories";
import { usernameSchema } from "@/lib/validation/data";
import {
  saveOnboardingStep,
  savePreferences,
  finishOnboarding,
  checkUsername,
  saveOnboardingStarters,
} from "@/app/actions/profile";
import { fetchData, unwrap, useProduct } from "./providers";
import { TitleSelector } from "./title-selector";
import { DataNotice } from "./availability";
import type { PreferencesData } from "./settings";
import type { LookupData } from "@/types/product";
export function OnboardingWizard({
  next,
  initial,
}: {
  next: string;
  initial: PreferencesData | null;
}) {
  const { bootstrap, toast } = useProduct();
  const router = useRouter();
  const draft = bootstrap.onboarding;
  const [step, setStep] = useState(draft?.step ?? 1),
    [username, setUsername] = useState(draft?.draft_username ?? ""),
    [name, setName] = useState(draft?.draft_display_name || bootstrap.name),
    [selectedCategories, setSelectedCategories] = useState<string[]>(
      initial?.categories?.map((c) => c.category) ?? [],
    ),
    [genres, setGenres] = useState<string[]>(
      initial?.genres?.map((g) => g.genre_id) ?? [],
    ),
    [starters, setStarters] = useState<string[]>(
      draft?.draft_starter_titles ?? [],
    ),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [usernameState, setUsernameState] = useState("");
  const lookup = useQuery({
    queryKey: ["lookups"],
    queryFn: ({ signal }) => fetchData<LookupData>("lookups", {}, signal),
    enabled: bootstrap.availability === "ready",
  });
  const titles = [
    "Make it yours.",
    "Which worlds feel like home?",
    "Follow a feeling.",
    "A few good places to begin.",
  ];
  async function persist(target: number, finish = false) {
    setPending(true);
    setError("");
    try {
      if (!usernameSchema.safeParse(username).success)
        throw new Error(
          "Use 3–30 lowercase letters, numbers, or underscores, starting with a letter.",
        );
      if (!name.trim()) throw new Error("Enter a display name.");
      if (step === 1 && !unwrap(await checkUsername(username)))
        throw new Error("That username isn’t available. Try another.");
      unwrap(await savePreferences({ categories: selectedCategories, genres }));
      unwrap(await saveOnboardingStarters(starters));
      if (finish) {
        unwrap(
          await finishOnboarding({
            username,
            displayName: name,
            categories: selectedCategories,
            genres,
            starterTitles: starters,
          }),
        );
        toast("Welcome to your universe.");
        router.replace(next);
        router.refresh();
      } else {
        unwrap(
          await saveOnboardingStep({
            step: target,
            username,
            displayName: name,
          }),
        );
        setStep(target);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="onboarding-shell">
      <aside className="onboarding-art">
        <span className="eyebrow">YOUR ENTERTAINMENT. YOUR UNIVERSE.</span>
        <h2>
          A world of stories.
          <br />
          <em>A place for yours.</em>
        </h2>
        <p>A few little details, then the next chapter is yours.</p>
      </aside>
      <section className="onboarding-panel">
        <div className="onboarding-progress" aria-label={`Step ${step} of 4`}>
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={step >= n ? "active" : ""}>
              {step > n ? <Check size={14} /> : n}
            </span>
          ))}
        </div>
        <p className="eyebrow">STEP {step} OF 4</p>
        <h1>{titles[step - 1]}</h1>
        <DataNotice state={bootstrap.availability} />
        {bootstrap.availability === "ready" && (
          <>
            <p className="onboarding-intro">
              {step === 1
                ? "Choose your permanent username. You can change your display name whenever you like."
                : step === 2
                  ? "Pick the categories you love. There’s room for all of them."
                  : step === 3
                    ? "Choose a few favorite genres. You can change these anytime."
                    : "Optional: add a few titles to Planned. Your own universe starts here."}
            </p>
            {step === 1 ? (
              <div className="product-form">
                <label>
                  Display name
                  <input
                    value={name}
                    maxLength={80}
                    required
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Permanent username
                  <div className="username-input">
                    <span>@</span>
                    <input
                      value={username}
                      maxLength={30}
                      autoComplete="username"
                      onChange={(e) => {
                        setUsername(e.target.value.toLowerCase());
                        setUsernameState("");
                      }}
                      onBlur={async () => {
                        if (usernameSchema.safeParse(username).success) {
                          try {
                            setUsernameState(
                              unwrap(await checkUsername(username))
                                ? "Available — this one can be yours."
                                : "That username is already taken.",
                            );
                          } catch {
                            setUsernameState(
                              "We couldn’t check availability. Try again.",
                            );
                          }
                        }
                      }}
                    />
                  </div>
                  <small>
                    3–30 characters. Start with a letter. Letters, numbers, and
                    underscores only.
                  </small>
                </label>
                <p className="username-availability" role="status">
                  {usernameState}
                </p>
                <p className="permanent-note">
                  Your username is permanent. Choose one that feels like you.
                </p>
              </div>
            ) : step === 2 ? (
              <div className="onboarding-categories">
                {categories.map((c) => (
                  <button
                    key={c.value}
                    aria-pressed={selectedCategories.includes(c.value)}
                    onClick={() =>
                      setSelectedCategories((old) =>
                        old.includes(c.value)
                          ? old.filter((v) => v !== c.value)
                          : [...old, c.value],
                      )
                    }
                  >
                    <Sparkles size={21} />
                    <strong>{c.label}</strong>
                    <small>{c.description}</small>
                    {selectedCategories.includes(c.value) && (
                      <Check size={17} />
                    )}
                  </button>
                ))}
              </div>
            ) : step === 3 ? (
              <div className="preference-chips">
                {lookup.data?.genres.map((g) => (
                  <label key={g.id}>
                    <input
                      type="checkbox"
                      checked={genres.includes(g.id)}
                      onChange={(e) =>
                        setGenres((old) =>
                          e.target.checked
                            ? [...old, g.id]
                            : old.filter((v) => v !== g.id),
                        )
                      }
                    />
                    <span>{g.name}</span>
                  </label>
                ))}
                {lookup.isPending && <p>Loading genres…</p>}
                {lookup.isError && (
                  <p className="form-error">
                    Genres aren’t available right now. You can continue and
                    choose them in Settings.
                  </p>
                )}
                {lookup.data?.genres.length === 0 && (
                  <p className="muted-copy">
                    Genre choices will arrive with the catalog. You can choose
                    them later.
                  </p>
                )}
              </div>
            ) : (
              <TitleSelector selected={starters} onChange={setStarters} />
            )}
            <p className="form-error" role="alert">
              {error}
            </p>
            <div className="onboarding-actions">
              {step > 1 && (
                <button
                  className="button button-secondary"
                  disabled={pending}
                  onClick={() => persist(step - 1)}
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              )}
              <button
                className="button button-primary"
                disabled={pending}
                onClick={() => persist(Math.min(4, step + 1), step === 4)}
              >
                {pending
                  ? "Saving…"
                  : step === 4
                    ? "Enter your universe"
                    : "Continue"}
                <ArrowRight size={16} />
              </button>
            </div>
            {step > 1 && (
              <button
                className="text-link onboarding-skip"
                disabled={pending}
                onClick={() => {
                  void persist(Math.min(4, step + 1), step === 4);
                }}
              >
                {step === 4
                  ? "Finish without adding more titles"
                  : "Skip for now"}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
