import { Compass, Layers3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
export function CinematicHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="cinematic-hero" aria-labelledby="hero-title">
      <div className="cinematic-backdrop" aria-hidden="true" />
      <div className="hero-topline">
        <span className="eyebrow">THE SCENESTACK EDIT</span>
        <Badge>Original artwork · Editorial</Badge>
      </div>
      <div className="hero-body">
        <p className="hero-kicker">FOR THE LOVE OF A GOOD STORY</p>
        <h1 id="hero-title">
          Find your next
          <br />
          <em>favorite feeling.</em>
        </h1>
        <p className="hero-synopsis">
          The worlds you escape to. The characters you carry with you. A home
          for everything you love to watch.
        </p>
        <div className="hero-actions">
          <ButtonLink href="/discover">
            <Compass size={17} aria-hidden="true" />
            Explore the universe
          </ButtonLink>
          <ButtonLink
            href={signedIn ? "/library" : "/login?next=/library"}
            variant="secondary"
          >
            <Layers3 size={17} aria-hidden="true" />
            {signedIn ? "My Library" : "Start your stack"}
          </ButtonLink>
        </div>
      </div>
      <div className="hero-bottomline">
        <span>Your entertainment. Your universe.</span>
        <span className="hero-art-credit">SCENESTACK ORIGINAL LANDSCAPE</span>
      </div>
    </section>
  );
}
