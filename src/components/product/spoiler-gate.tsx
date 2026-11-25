"use client";
import { Eye, ShieldAlert, ArrowLeft } from "lucide-react";
export function SpoilerGate({
  title,
  onReveal,
  onBack,
}: {
  title: string;
  onReveal: () => void;
  onBack: () => void;
}) {
  return (
    <section className="spoiler-gate">
      <span className="spoiler-gate-icon">
        <ShieldAlert size={31} />
      </span>
      <p className="eyebrow">A LITTLE WARNING BEFORE YOU STEP INSIDE</p>
      <h1>{title}</h1>
      <p>
        This collection contains spoilers. Its titles, description, artwork, and
        creator notes stay hidden until you choose to reveal them.
      </p>
      <div>
        <button className="button button-secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
        <button className="button button-primary" onClick={onReveal}>
          <Eye size={17} />
          Reveal Collection
        </button>
      </div>
    </section>
  );
}
