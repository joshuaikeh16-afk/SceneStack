import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export function FilterBar({ active }: { active: boolean }) {
  return (
    <div className="filter-bar">
      <p id="catalog-availability">
        Catalog preview <span>· Real titles are on their way</span>
      </p>
      <div className="filter-actions">
        {active && (
          <ButtonLink href="/discover" variant="quiet">
            Reset filters
          </ButtonLink>
        )}
        <details className="more-filters">
          <summary>
            <SlidersHorizontal size={15} aria-hidden="true" />
            More filters
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <div className="filter-popover">
            <h3>A little more specific.</h3>
            <p>
              These filters will become available when the catalog is connected.
            </p>
            <fieldset disabled aria-label="Future catalog filters">
              <div className="future-filter-grid">
                {[
                  "Genre",
                  "Year",
                  "Language",
                  "Country",
                  "Community rating",
                ].map((label) => (
                  <label key={label}>
                    <span>{label}</span>
                    <span className="select-wrap">
                      <select defaultValue="" aria-label={label}>
                        <option value="">Available with catalog</option>
                      </select>
                      <ChevronDown size={14} aria-hidden="true" />
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </details>
      </div>
    </div>
  );
}
