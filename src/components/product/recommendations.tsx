import { InfiniteTitleFeed } from "./infinite-title-feed";

export function Recommendations() {
  return (
    <InfiniteTitleFeed
      source="recommendations"
      layout="rail"
      label="Recommended for you"
      query={{ limit: 12 }}
      heading={
        <div className="shelf-heading">
          <div>
            <h2>Recommended for you</h2>
            <p>Inspired by your preferences and the stories you keep.</p>
          </div>
        </div>
      }
    />
  );
}
