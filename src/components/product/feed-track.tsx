"use client";
import {
  Component,
  createRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";

type Props = {
  layout: "rail" | "grid";
  label: string;
  ids: readonly string[];
  children: ReactNode;
};
type Anchor = { element: HTMLElement; position: number };

// Before an old page leaves the bounded cache, measure a retained visible
// poster. React applies the scroll correction before the browser paints.
export class FeedTrack extends Component<Props> {
  readonly track = createRef<HTMLDivElement>();

  getSnapshotBeforeUpdate(previous: Props): Anchor | null {
    if (!previous.ids.length || previous.ids[0] === this.props.ids[0])
      return null;
    const track = this.track.current;
    if (!track) return null;
    const rail = this.props.layout === "rail";
    const region = track.getBoundingClientRect();
    const start = rail ? region.left : 0;
    const end = rail ? region.right : window.innerHeight;
    const elements = [
      ...track.querySelectorAll<HTMLElement>("[data-title-id]"),
    ];
    // A manual next-page request can evict the visible first page. Prefer a
    // retained visible card, then a retained offscreen card as the anchor.
    const retained = new Set(this.props.ids);
    let fallback: Anchor | null = null;
    for (const element of elements) {
      if (!element.dataset.titleId || !retained.has(element.dataset.titleId))
        continue;
      const box = element.getBoundingClientRect();
      const position = rail ? box.left : box.top;
      fallback ??= { element, position };
      if (position < end && (rail ? box.right : box.bottom) > start)
        return { element, position };
    }
    return fallback;
  }

  componentDidUpdate(_previous: Props, _state: unknown, anchor: Anchor | null) {
    if (!anchor?.element.isConnected) return;
    const box = anchor.element.getBoundingClientRect();
    const rail = this.props.layout === "rail";
    const delta = (rail ? box.left : box.top) - anchor.position;
    if (Math.abs(delta) < 1) return;
    if (rail)
      this.track.current?.scrollBy({ left: delta, behavior: "instant" });
    else window.scrollBy({ top: delta, behavior: "instant" });
  }

  moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    const distance =
      event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (!distance || event.altKey || event.ctrlKey || event.metaKey) return;
    const track = event.currentTarget;
    const cards = [
      ...track.querySelectorAll<HTMLAnchorElement>("a.title-card"),
    ];
    const current = cards.findIndex((card) => card === document.activeElement);
    const next = cards[current < 0 ? 0 : current + distance];
    if (!next) return;
    event.preventDefault();
    next.focus({ preventScroll: true });
    const box = next.getBoundingClientRect();
    const frame = track.getBoundingClientRect();
    if (box.left < frame.left || box.right > frame.right)
      track.scrollBy({
        left:
          box.left < frame.left
            ? box.left - frame.left
            : box.right - frame.right,
        behavior: "instant",
      });
  }

  render() {
    const rail = this.props.layout === "rail";
    return (
      <div
        ref={this.track}
        className={
          rail
            ? "horizontal-rail poster-carousel feed-track"
            : "product-title-grid feed-track"
        }
        role="region"
        aria-label={this.props.label}
        tabIndex={rail ? 0 : undefined}
        onKeyDown={rail ? this.moveFocus : undefined}
      >
        {this.props.children}
      </div>
    );
  }
}
