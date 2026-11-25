"use client";
import type { CatalogDiagnostics as Diagnostics } from "@/lib/data/catalog-diagnostics";
function date(value: string | null | undefined) {
  return value
    ? new Date(value).toLocaleString()
    : "No successful request recorded";
}
export function CatalogDiagnostics({ data }: { data: Diagnostics }) {
  return (
    <div className="catalog-diagnostics">
      <div className="admin-stats">
        <div>
          <strong>{data.total}</strong>
          <span>Canonical titles</span>
        </div>
        {Object.entries(data.counts).map(([kind, count]) => (
          <div key={kind}>
            <strong>{count}</strong>
            <span>{kind}</span>
          </div>
        ))}
      </div>
      {data.providers.map((provider) => (
        <section className="settings-section" key={provider.key}>
          <h3>{provider.key === "tmdb" ? "TMDB" : "MyAnimeList"}</h3>
          <dl className="diagnostic-facts">
            <div>
              <dt>Environment integration</dt>
              <dd>{provider.environmentEnabled ? "Enabled" : "Disabled"}</dd>
            </div>
            <div>
              <dt>Credential</dt>
              <dd>
                {provider.credentialConfigured
                  ? "Configured (value hidden)"
                  : "Missing"}
              </dd>
            </div>
            <div>
              <dt>Public-release permission</dt>
              <dd>
                {provider.publicReleaseApproved
                  ? "Operator-confirmed flag"
                  : "Not confirmed"}
              </dd>
            </div>
            <div>
              <dt>Database registration</dt>
              <dd>
                {provider.databaseApproved && provider.databaseEnabled
                  ? "Approved / enabled"
                  : "Disabled or not approved"}
              </dd>
            </div>
            <div>
              <dt>Last successful request on this instance</dt>
              <dd>{date(provider.lastSuccess)}</dd>
            </div>
            <div>
              <dt>Requests / cache hits / cache misses</dt>
              <dd>
                {provider.requests} / {provider.hits} / {provider.misses}
              </dd>
            </div>
            <div>
              <dt>Pagination failures</dt>
              <dd>{provider.paginationFailures}</dd>
            </div>
            <div>
              <dt>Ingestion attempts on this instance</dt>
              <dd>{provider.imported}</dd>
            </div>
          </dl>
          <h4>Recent request errors</h4>
          {provider.errors.length ? (
            <ul>
              {provider.errors.map((error, i) => (
                <li key={i}>
                  {date(error.at)} · {error.operation} · {error.code}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-copy">No errors recorded on this instance.</p>
          )}
          <h4>Recent persisted title synchronization</h4>
          {provider.persistedRecentSync.length ? (
            <ul>
              {provider.persistedRecentSync.map((sync, i) => (
                <li key={i}>
                  {sync.state} · Last success: {date(sync.last_success_at)}
                  {sync.last_error_code ? ` · ${sync.last_error_code}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-copy">No synchronization records available.</p>
          )}
        </section>
      ))}
      <section className="settings-section">
        <h3>Discovery cache & synchronization</h3>
        <p>
          {data.cache.entries} / {data.cache.maximumEntries} cached responses ·{" "}
          {Math.round(data.cache.bytes / 1024)} KiB of serialized payload ·{" "}
          {data.cache.pending} in-flight requests.
        </p>
        <p>
          Refresh queue:{" "}
          {Object.entries(data.synchronization)
            .map(([state, count]) => `${count} ${state}`)
            .join(" · ") || "Unavailable"}
        </p>
        <p className="privacy-caption">
          {data.scope} The in-memory request and ingestion budgets are per
          instance, not distributed fleet-wide limits.
        </p>
      </section>
    </div>
  );
}
