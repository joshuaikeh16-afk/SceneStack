"use client";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X, Clock, ArrowUpRight } from "lucide-react";
import { categories } from "@/config/categories";
import { fetchData, unwrap, useProduct } from "./providers";
import {
  rememberSearch,
  clearDiscoveryHistory,
  saveDiscoveryPrivacy,
} from "@/app/actions/discovery";
import { rememberTitleTrigger } from "./dialog";
import type { CatalogResult } from "@/types/product";
type History = {
  searches: string[];
  rememberSearches: boolean;
  rememberViewed: boolean;
};
export function SearchSuggestions({
  value,
  onChange,
  onSearch,
  onNavigate,
}: {
  value: string;
  onChange: (v: string) => void;
  onSearch: (v: string) => void;
  onNavigate?: () => void;
}) {
  const { bootstrap, toast, online } = useProduct();
  const router = useRouter();
  const client = useQueryClient();
  const id = useId();
  const root = useRef<HTMLFormElement>(null),
    input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(-1),
    [pending, setPending] = useState(false);
  const privateReady = !!bootstrap.userId && bootstrap.availability === "ready";
  const search = value.trim();
  const [settledSearch, setSettledSearch] = useState(search);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setSettledSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [open, search]);
  // Retain cached options while closed so ArrowDown can select the first
  // match in the same event that reopens the listbox.
  const matchingSearch = settledSearch === search && search.length >= 2;
  const showMatches = open && matchingSearch;
  const history = useQuery({
    queryKey: ["search-history", bootstrap.userId],
    queryFn: ({ signal }) => fetchData<History>("history", {}, signal),
    enabled: open && privateReady,
  });
  const matches = useQuery({
    queryKey: ["search-suggestions", settledSearch],
    queryFn: ({ signal }) =>
      fetchData<CatalogResult>(
        "catalog",
        { q: settledSearch, limit: 5 },
        signal,
      ),
    enabled: showMatches,
  });
  const options = [
    ...(history.data?.searches ?? [])
      .filter((q) => !value || q.toLowerCase().includes(value.toLowerCase()))
      .map((query) => ({
        label: query,
        kind: "recent",
        href: "",
        query,
        poster: null,
      })),
    ...categories
      .filter(
        (c) => !value || c.label.toLowerCase().includes(value.toLowerCase()),
      )
      .map((c) => ({
        label: c.label,
        kind: "category",
        href: `/discover?category=${c.value}`,
        query: "",
        poster: null,
      })),
    ...(matchingSearch ? (matches.data?.titles ?? []) : []).map((t) => ({
      label: t.title.name,
      kind: "title",
      href: `/titles/${t.id}`,
      query: "",
      poster: t.title.posterUrl,
    })),
  ];
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  async function save(query: string) {
    if (
      privateReady &&
      navigator.onLine &&
      history.data?.rememberSearches &&
      query.trim()
    ) {
      try {
        unwrap(await rememberSearch(query));
        void client.invalidateQueries({
          queryKey: ["search-history", bootstrap.userId],
        });
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "The search was not remembered.",
          true,
        );
      }
    }
  }
  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    setOpen(false);
    setActive(-1);
    if (option.kind === "recent") {
      onChange(option.query);
      onSearch(option.query);
      void save(option.query);
    } else {
      onNavigate?.();
      if (input.current) rememberTitleTrigger(input.current);
      router.push(option.href, { scroll: false });
    }
  }
  return (
    <form
      ref={root}
      className="search-suggestion-root"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (open && active >= 0 && options[active]) choose(active);
        else {
          setOpen(false);
          onSearch(value.trim());
          void save(value.trim());
        }
      }}
    >
      <div className="product-search">
        <Search size={22} />
        <input
          ref={input}
          role="combobox"
          aria-label="Search titles, collections, or people"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-autocomplete="list"
          aria-activedescendant={
            open && active >= 0 ? `${id}-option-${active}` : undefined
          }
          value={value}
          maxLength={120}
          placeholder="A title. A world. A feeling."
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setActive(-1);
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActive((old) =>
                options.length
                  ? ((old < 0 ? (e.key === "ArrowDown" ? -1 : 0) : old) +
                      (e.key === "ArrowDown" ? 1 : -1) +
                      options.length) %
                    options.length
                  : -1,
              );
            }
          }}
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onChange("");
              onSearch("");
              input.current?.focus();
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>
      {open && (
        <div className="search-context-panel">
          <div className="search-context-heading">
            <span>{value ? "Find your next story" : "A little direction"}</span>
            <button
              type="button"
              aria-label="Close suggestions"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div
            role="listbox"
            id={`${id}-options`}
            aria-label="Search suggestions"
          >
            {options.map((o, i) => (
              <div
                id={`${id}-option-${i}`}
                role="option"
                aria-selected={active === i}
                key={`${o.kind}-${o.href || o.query}`}
                onPointerMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                className="search-option"
              >
                {o.poster ? (
                  <span className="suggestion-poster">
                    <Image src={o.poster} alt="" fill sizes="28px" />
                  </span>
                ) : o.kind === "recent" ? (
                  <Clock size={15} />
                ) : (
                  <Search size={15} />
                )}
                <span>
                  <strong>{o.label}</strong>
                  <small>
                    {o.kind === "recent"
                      ? "Recent search"
                      : o.kind === "category"
                        ? "Category"
                        : "Title"}
                  </small>
                </span>
                <ArrowUpRight size={14} />
              </div>
            ))}
          </div>
          {showMatches && matches.isFetching && (
            <p className="search-panel-note" role="status">
              Finding matching titles…
            </p>
          )}
          {showMatches && matches.isError && (
            <p className="search-panel-note">
              Matching titles are unavailable right now.{" "}
              <button
                type="button"
                className="text-link"
                onClick={() => matches.refetch()}
              >
                Try again
              </button>
            </p>
          )}
          {privateReady && (
            <div className="search-privacy-controls">
              {history.data?.rememberSearches ? (
                <>
                  <span>
                    Recent searches are private and expire after 30 days.
                  </span>
                  <button
                    type="button"
                    className="text-link"
                    disabled={
                      pending || !history.data.searches.length || !online
                    }
                    onClick={async () => {
                      setPending(true);
                      try {
                        unwrap(await clearDiscoveryHistory("searches"));
                        await history.refetch();
                      } catch (e) {
                        toast(
                          e instanceof Error ? e.message : "Please try again.",
                          true,
                        );
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    Clear recent searches
                  </button>
                </>
              ) : (
                <>
                  <span>
                    Search history is off. Only searches you submit are
                    remembered when you enable it.
                  </span>
                  <button
                    type="button"
                    className="text-link"
                    disabled={pending || !online}
                    onClick={async () => {
                      setPending(true);
                      try {
                        unwrap(
                          await saveDiscoveryPrivacy({
                            rememberSearches: true,
                          }),
                        );
                        await history.refetch();
                      } catch (e) {
                        toast(
                          e instanceof Error ? e.message : "Please try again.",
                          true,
                        );
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    Remember recent searches
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
