import { Layers3, LockKeyhole } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
export function AuthPrompt({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="auth-prompt">
      <div className="prompt-mark">
        <Layers3 size={32} strokeWidth={1.3} aria-hidden="true" />
      </div>
      <div>
        <p className="eyebrow">YOUR STORIES, ALL TOGETHER</p>
        <h2>
          {signedIn
            ? "A little universe, entirely your own."
            : "Your next favorite deserves a home."}
        </h2>
        <p>
          Make room for the titles you love and the ones you haven’t met yet.
        </p>
        <span className="privacy-micro">
          <LockKeyhole size={13} aria-hidden="true" />
          Your tracking, ratings, and favorites stay private.
        </span>
      </div>
      <ButtonLink href={signedIn ? "/library" : "/login?next=/library"}>
        {signedIn ? "Open my library" : "Make it yours"}
      </ButtonLink>
    </section>
  );
}
