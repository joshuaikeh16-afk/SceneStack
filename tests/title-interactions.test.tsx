import assert from "node:assert/strict";
import test from "node:test";
import Module from "node:module";
import { readFileSync } from "node:fs";
import { useState } from "react";
import { installDom } from "./helpers/dom";
import type {
  ProductBootstrap,
  TitleState,
  TitleView,
  CollectionView,
  CollectionDetails,
} from "../src/types/product";

// DOM nodes contain React's cyclic fiber graph. Avoid asking Node's assertion
// formatter to recursively inspect that graph when a focus assertion fails.
function sameNode(actual: Element | null, expected: Element | null) {
  assert.ok(
    actual === expected,
    `Expected ${expected?.outerHTML.slice(0, 200) ?? "null"}; received ${actual?.outerHTML.slice(0, 200) ?? "null"}`,
  );
}

test("connected controls share immediate title state, preserve failed input, create with the selected title and autosave safely", async (t) => {
  const dom = installDom();
  const navigated: string[] = [];
  const location = dom.window.location;
  const handlers: Record<string, (input: unknown) => Promise<unknown>> = {};
  // Test-only CommonJS transport boundaries; application hooks/components remain real.
  const loader = Module as unknown as {
    _load: (...args: unknown[]) => unknown;
    _resolveFilename: (...args: unknown[]) => string;
  };
  const originalLoad = loader._load,
    originalResolve = loader._resolveFilename;
  loader._load = function (this: unknown, ...args: unknown[]) {
    const resolved = originalResolve(...args);
    if (
      resolved.includes("/@tanstack/react-query/") &&
      resolved.endsWith("/index.cjs")
    ) {
      const actual = Reflect.apply(
        originalLoad,
        this,
        args,
      ) as typeof import("@tanstack/react-query");
      return {
        ...actual,
        QueryClient: class extends actual.QueryClient {
          constructor(
            config: ConstructorParameters<typeof actual.QueryClient>[0],
          ) {
            super({
              ...config,
              defaultOptions: {
                ...config?.defaultOptions,
                queries: {
                  ...config?.defaultOptions?.queries,
                  gcTime: Infinity,
                },
                mutations: {
                  ...config?.defaultOptions?.mutations,
                  gcTime: Infinity,
                },
              },
            });
          }
        },
      };
    }
    if (resolved.includes("/src/app/actions/") && resolved.endsWith(".ts")) {
      const names = [
        ...readFileSync(resolved, "utf8").matchAll(
          /export async function (\w+)/g,
        ),
      ].map((m) => m[1]);
      return Object.fromEntries(
        names.map((name) => [
          name,
          (input: unknown) => {
            if (!handlers[name])
              throw new Error(`Unexpected fixture action: ${name}`);
            return handlers[name](input);
          },
        ]),
      );
    }
    if (resolved.endsWith("/next/navigation.js"))
      return {
        useRouter: () => ({
          push: (path: string) => {
            navigated.push(path);
          },
          replace: (path: string) => {
            navigated.push(path);
            dom.window.history.replaceState(null, "", path);
          },
          back: () => dom.window.history.back(),
        }),
        useSearchParams: () => new URLSearchParams(location.search),
        usePathname: () => location.pathname,
      };
    return Reflect.apply(originalLoad, this, args);
  };
  const id = "40000000-0000-4000-8000-000000000001",
    uid = "40000000-0000-4000-8000-000000000002";
  let state: TitleState = {
    titleId: id,
    tracking: null,
    favorite: false,
    rating: null,
  };
  let complete: ((success: boolean) => void) | undefined;
  handlers.changeTitle = async (raw) => {
    const input = raw as {
      action: string;
      status: TitleState["tracking"];
      enabled: boolean;
      rating: number | null;
    };
    return new Promise((resolve) => {
      complete = (success) => {
        if (!success) {
          resolve({
            ok: false,
            code: "UNAVAILABLE",
            message: "Isolated failure. Your changes were not saved.",
          });
          return;
        }
        if (input.action === "track")
          state = { ...state, tracking: input.status };
        if (input.action === "favorite")
          state = { ...state, favorite: input.enabled };
        if (input.action === "rate") state = { ...state, rating: input.rating };
        resolve({ ok: true, data: { ...state } });
      };
    });
  };
  const cid = "40000000-0000-4000-8000-000000000003";
  let rememberSearches = false;
  let recentSearches: string[] = [];
  let collections: CollectionView[] = [];
  let createdTitles: string[] = [];
  let version = 1,
    failEdit = false;
  const previousFetch = globalThis.fetch;
  let feedCalls = 0;
  let latePage: (() => void) | undefined;
  let lateSignal: AbortSignal | null | undefined;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("title-state")) return Response.json([{ ...state }]);
    if (url.includes("own-collections")) return Response.json(collections);
    if (url.includes("/history"))
      return Response.json({
        searches: recentSearches,
        rememberSearches,
        rememberViewed: true,
      });
    if (url.includes("/title-feed")) {
      feedCalls++;
      const params = new URL(url, location.origin).searchParams;
      const page = {
        availability: "ready",
        titles: [view],
        nextCursor: null,
        previousCursor: null,
        offset: 0,
      };
      if (params.get("category") === "anime" && !params.get("q")) {
        lateSignal = init?.signal;
        return new Promise((resolve) => {
          latePage = () =>
            resolve(
              Response.json({
                ...page,
                titles: [
                  {
                    ...view,
                    title: { ...view.title, name: "Superseded results" },
                  },
                ],
              }),
            );
        });
      }
      return Response.json(page);
    }
    if (url.includes("/catalog"))
      return Response.json({
        availability: "ready",
        titles: [view],
        hasMore: false,
      });
    if (url.includes("/lookups"))
      return Response.json({ genres: [], countries: [], languages: [] });
    throw new Error(`Unexpected fixture fetch: ${url}`);
  };
  const { render, waitFor, cleanup, act, fireEvent } =
    await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const { QueryClient, QueryClientProvider } =
    await import("@tanstack/react-query");
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
      mutations: { retry: false, networkMode: "always", gcTime: Infinity },
    },
  });
  t.after(() => {
    cleanup();
    queryClient.clear();
    loader._load = originalLoad;
    globalThis.fetch = previousFetch;
    dom.window.close();
  });
  const { ProductProviders } =
    await import("../src/components/product/providers");
  const { TitleActions } =
    await import("../src/components/product/title-actions");
  const { TitleStates } = await import("../src/components/product/title-state");
  const { TitleCard } =
    await import("../src/components/product/product-title-card");
  const bootstrap: ProductBootstrap = {
    userId: uid,
    name: "Isolated member",
    email: null,
    availability: "ready",
    profile: {
      id: uid,
      username: "isolated_member",
      display_name: "Isolated member",
      avatar_path: null,
      cover_path: null,
      featured_collection_id: null,
      bio: "",
      status: "active",
      verified_at: null,
      verified_by: null,
      username_change_required: false,
      created_at: "2026-11-23T00:00:00Z",
      updated_at: "2026-11-23T00:00:00Z",
    },
    onboarding: {
      user_id: uid,
      completed_at: "2026-11-23T00:00:00Z",
      created_at: "2026-11-23T00:00:00Z",
      step: 4,
      draft_username: null,
      draft_display_name: null,
      draft_starter_titles: [],
    },
    roles: [],
  };
  const view: TitleView = {
    id,
    title: {
      reference: { provider: "scenestack", providerId: id },
      name: "Isolated movie",
      kind: "movie",
      synopsis: null,
      posterUrl: null,
      backdropUrl: null,
      releaseYear: 2024,
      episodeCount: null,
    },
    genres: [],
    communityRating: null,
    voteCount: 0,
    status: "released",
    edition: "standalone",
  };
  const user = userEvent.setup({ document: dom.window.document });
  const ui = render(
    <ProductProviders bootstrap={bootstrap}>
      <QueryClientProvider client={queryClient}>
        <TitleStates ids={[id]}>
          <div>
            <TitleCard title={view.title} view={view} />
            <TitleActions view={view} />
            <TitleActions view={view} />
          </div>
        </TitleStates>
      </QueryClientProvider>
    </ProductProviders>,
  );
  await waitFor(() =>
    assert.equal(
      ui
        .getAllByRole("button", { name: /Add to Watched/ })
        .filter((b) => !(b as HTMLButtonElement).disabled).length,
      2,
    ),
  );
  await user.click(ui.getAllByRole("button", { name: /Add to Watched/ })[0]);
  await waitFor(() =>
    assert.equal(
      ui
        .getAllByRole("button", { name: /Watched/ })
        .filter(
          (b) =>
            b.textContent?.includes("Watched") &&
            !b.textContent?.includes("Add"),
        ).length,
      2,
    ),
  );
  sameNode(ui.queryByLabelText("Tracking: Completed"), null);
  assert.equal(
    ui.container
      .querySelector(".interactive-title-card")
      ?.querySelectorAll("button").length,
    0,
  );
  await act(async () => complete!(true));
  await waitFor(() =>
    assert.equal(
      ui
        .getAllByRole("button", { name: /Watched/ })
        .filter((b) => !(b as HTMLButtonElement).disabled).length,
      2,
    ),
  );
  await user.click(ui.getAllByRole("button", { name: /Watched/ })[1]);
  await user.click(await ui.findByRole("menuitemradio", { name: "Planned" }));
  await waitFor(() =>
    assert.equal(ui.getAllByRole("button", { name: /Planned/ }).length, 2),
  );
  sameNode(ui.queryByRole("button", { name: "Watched" }), null);
  await act(async () => complete!(true));
  await waitFor(() =>
    assert.ok(
      ui
        .getAllByRole("button", { name: "Favorite title" })
        .every((b) => !(b as HTMLButtonElement).disabled),
    ),
  );
  await user.click(ui.getAllByRole("button", { name: "Favorite title" })[0]);
  await waitFor(() =>
    assert.equal(
      ui.getAllByRole("button", { name: "Remove favorite" }).length,
      2,
    ),
  );
  await act(async () => complete!(false));
  await waitFor(() =>
    assert.equal(
      ui.getAllByRole("button", { name: "Favorite title" }).length,
      2,
    ),
  );
  await user.click(ui.getAllByRole("button", { name: "Rate" })[1]);
  const rating = await ui.findByLabelText("Your rating");
  await user.clear(rating);
  await user.type(rating, "8.3");
  await user.click(ui.getByRole("button", { name: "Save Rating" }));
  await waitFor(() =>
    assert.equal(
      [...ui.container.querySelectorAll("button")].filter((b) =>
        /Your rating\s*8\.3/.test(b.textContent || ""),
      ).length,
      2,
    ),
  );
  await act(async () => complete!(true));
  await waitFor(() =>
    sameNode(ui.queryByRole("region", { name: "Rate Isolated movie" }), null),
  );
  sameNode(ui.queryByRole("dialog"), null);
  await user.click(ui.getAllByRole("button", { name: /Your rating 8.3/ })[1]);
  const next = await ui.findByLabelText("Your rating");
  await user.clear(next);
  await user.type(next, "9.7");
  await user.click(ui.getByRole("button", { name: "Save Rating" }));
  await waitFor(() =>
    assert.equal(
      [...ui.container.querySelectorAll("button")].filter((b) =>
        /Your rating\s*9\.7/.test(b.textContent || ""),
      ).length,
      2,
    ),
  );
  await act(async () => complete!(false));
  await waitFor(() =>
    assert.equal(
      (ui.getByLabelText("Your rating") as HTMLInputElement).value,
      "9.7",
    ),
  );
  assert.equal(state.rating, 8.3);
  assert.equal(
    [...ui.container.querySelectorAll("button")].filter((b) =>
      /Your rating\s*8\.3/.test(b.textContent || ""),
    ).length,
    2,
  );
  await user.click(ui.getByRole("button", { name: "Cancel" }));
  handlers.createPersonalCollection = async (raw) => {
    const value = raw as {
      title: string;
      description: string;
      titleIds: string[];
    };
    createdTitles = value.titleIds;
    collections = [
      {
        record: {
          id: cid,
          owner_id: uid,
          title: value.title,
          description: value.description,
          visibility: "private",
          spoiler_warning: false,
          cover_path: null,
          collage_reference: null,
          sort_by: "manual",
          sort_desc: false,
          removed_at: null,
          created_at: "2026-11-23T00:00:00Z",
          updated_at: "2026-11-23T00:00:00Z",
          client_request_id: null,
          version: 1,
          published_at: null,
        },
        creator: null,
        count: value.titleIds.length,
        posters: [null],
        favorite: false,
        saved: false,
        sourceCreator: null,
        sourceDeleted: false,
        selectedTitleCount: value.titleIds.length,
      },
    ];
    return { ok: true, data: { id: cid } };
  };
  handlers.editPersonalCollection = async (raw) => {
    const value = raw as { version?: number; patch: Record<string, unknown> };
    if (failEdit) {
      failEdit = false;
      return {
        ok: false,
        code: "CONFLICT",
        message: "Isolated concurrent edit. Your text is kept.",
      };
    }
    if (value.version !== undefined) assert.equal(value.version, version);
    version++;
    return {
      ok: true,
      data: { id: cid, version, updated_at: "2026-11-23T00:01:00Z" },
    };
  };
  await user.click(ui.getAllByRole("button", { name: "Add to collection" })[1]);
  await user.click(
    await ui.findByRole("button", { name: "Create a new collection" }),
  );
  await user.type(
    await ui.findByRole("textbox", { name: /Collection name/ }),
    "Isolated new collection",
  );
  await user.type(
    ui.getByRole("textbox", { name: /Description/ }),
    "An isolated creator note.",
  );
  await user.click(ui.getByRole("button", { name: "Create collection" }));
  await waitFor(() => assert.deepEqual(createdTitles, [id]));
  await ui.findByRole("dialog", { name: "Add to a collection" });
  await ui.findByText("Isolated new collection");
  assert.match(
    ui.getByText(/Already added/).textContent ?? "",
    /Already added/,
  );
  await user.click(ui.getByRole("button", { name: "Close dialog" }));
  assert.equal(
    ui.getAllByRole("button", { name: "Add to collection" }).length,
    2,
  );
  cleanup();
  const { EditCollectionDialog } =
    await import("../src/components/product/collection-editor");
  const editor: CollectionDetails = {
    ...collections[0],
    record: { ...collections[0].record, version },
    items: [],
    hasMore: false,
    nextItemId: null,
    metrics: { favorites: 0, saves: 0, imports: 0 },
  };
  const editUi = render(
    <ProductProviders bootstrap={bootstrap}>
      <EditCollectionDialog open data={editor} onOpenChange={() => {}} />
    </ProductProviders>,
  );
  const name = editUi.getByRole("textbox", { name: /Name/ });
  await user.clear(name);
  await user.type(name, "Autosaved collection");
  await waitFor(() => assert.ok(version > 2), { timeout: 1800 });
  await waitFor(() =>
    assert.match(editUi.getByText("✓ Saved").textContent ?? "", /Saved/),
  );
  failEdit = true;
  const description = editUi.getByRole("textbox", { name: /Description/ });
  await user.type(description, " Kept after a failed save.");
  await editUi.findByText(
    "Failed to save — your text is kept",
    {},
    { timeout: 1800 },
  );
  assert.match(
    (description as HTMLTextAreaElement).value,
    /Kept after a failed save/,
  );
  await user.click(editUi.getByRole("button", { name: "Retry text save" }));
  await editUi.findByText("✓ Saved");
  await user.type(
    editUi.getByRole("textbox", { name: /Name/ }),
    " · recovered draft",
  );
  editUi.rerender(
    <ProductProviders bootstrap={bootstrap}>
      <p>Another in-app view</p>
    </ProductProviders>,
  );
  editUi.rerender(
    <ProductProviders bootstrap={bootstrap}>
      <EditCollectionDialog
        key="restored"
        open
        data={editor}
        onOpenChange={() => {}}
      />
    </ProductProviders>,
  );
  assert.match(
    (editUi.getByRole("textbox", { name: /Name/ }) as HTMLInputElement).value,
    /recovered draft/,
  );
  await editUi.findByText(/An unsaved draft was restored/);
  const beforeReview = version;
  await new Promise((resolve) => setTimeout(resolve, 850));
  assert.equal(version, beforeReview);
  assert.equal(dom.window.localStorage.length, 0);
  assert.equal(dom.window.sessionStorage.length, 0);
  const { SearchSuggestions } =
    await import("../src/components/product/search-suggestions");
  const submitted: string[] = [];
  handlers.saveDiscoveryPrivacy = async (raw) => {
    rememberSearches = (raw as { rememberSearches: boolean }).rememberSearches;
    return { ok: true };
  };
  handlers.rememberSearch = async (raw) => {
    recentSearches = [String(raw)];
    return { ok: true };
  };
  handlers.clearDiscoveryHistory = async () => {
    recentSearches = [];
    return { ok: true };
  };
  function SearchHarness() {
    const [value, setValue] = useState("");
    return (
      <ProductProviders bootstrap={bootstrap}>
        <SearchSuggestions
          value={value}
          onChange={setValue}
          onSearch={(q) => submitted.push(q)}
        />
      </ProductProviders>
    );
  }
  cleanup();
  const searchUi = render(<SearchHarness />);
  const search = searchUi.getByRole("combobox");
  await user.click(search);
  await user.keyboard("{ArrowUp}{Enter}");
  assert.equal(navigated.at(-1), "/discover?category=documentary");
  await user.type(search, "Isolated");
  await searchUi.findByRole("option", { name: /Isolated movie/ });
  await user.keyboard("{Escape}");
  sameNode(searchUi.queryByRole("listbox"), null);
  await user.keyboard("{ArrowDown}{Enter}");
  assert.equal(navigated.at(-1), `/titles/${id}`);
  await user.keyboard("{ArrowDown}");
  await user.click(
    await searchUi.findByRole("button", { name: "Remember recent searches" }),
  );
  await waitFor(() => assert.equal(rememberSearches, true));
  await user.click(search);
  await user.keyboard("{Escape}{Enter}");
  await waitFor(() => assert.deepEqual(submitted, ["Isolated"]));
  await waitFor(() => assert.deepEqual(recentSearches, ["Isolated"]));
  await user.keyboard("{ArrowDown}");
  const clear = await searchUi.findByRole("button", {
    name: "Clear recent searches",
  });
  await waitFor(() =>
    assert.equal((clear as HTMLButtonElement).disabled, false),
  );
  await user.click(clear);
  await waitFor(() => assert.deepEqual(recentSearches, []));
  cleanup();
  // A directly opened detail surface loads its own state, without a browsing batch.
  queryClient.clear();
  const { ProductDialog } = await import("../src/components/product/dialog");
  function DetailHarness() {
    const [open, setOpen] = useState(false);
    return (
      <ProductProviders bootstrap={bootstrap}>
        <QueryClientProvider client={queryClient}>
          <button onClick={() => setOpen(true)}>Open title</button>
          <ProductDialog
            open={open}
            onOpenChange={setOpen}
            title="Cinematic details"
          >
            <TitleActions view={view} />
          </ProductDialog>
        </QueryClientProvider>
      </ProductProviders>
    );
  }
  const detailUi = render(<DetailHarness />);
  await user.click(detailUi.getByRole("button", { name: "Open title" }));
  const personal = await detailUi.findByRole("button", {
    name: /Your rating 8.3/,
  });
  await waitFor(() =>
    assert.equal((personal as HTMLButtonElement).disabled, false),
  );
  await user.click(personal);
  const inline = await detailUi.findByRole("region", {
    name: "Rate Isolated movie",
  });
  assert.equal(detailUi.getAllByRole("dialog").length, 1);
  assert.equal(dom.window.document.body.dataset.modalCount, "1");
  await user.keyboard("{Escape}");
  await waitFor(() => assert.equal(inline.isConnected, false));
  assert.equal(detailUi.getAllByRole("dialog").length, 1);
  sameNode(dom.window.document.activeElement, personal);
  await user.keyboard("{Escape}");
  await waitFor(() => sameNode(detailUi.queryByRole("dialog"), null));
  assert.equal(dom.window.document.body.dataset.modalCount, undefined);
  sameNode(
    dom.window.document.activeElement,
    detailUi.getByRole("button", { name: "Open title" }),
  );
  cleanup();
  queryClient.clear();
  const { FeaturedTitle } =
    await import("../src/components/home/featured-title");
  const heroUi = render(
    <ProductProviders bootstrap={bootstrap}>
      <QueryClientProvider client={queryClient}>
        <FeaturedTitle views={[view]} />
      </QueryClientProvider>
    </ProductProviders>,
  );
  const tracking = await heroUi.findByRole("button", { name: /Planned/ });
  await waitFor(() =>
    assert.equal((tracking as HTMLButtonElement).disabled, false),
  );
  assert.equal(heroUi.getAllByRole("button").length, 1);
  assert.equal(
    heroUi.getByRole("link", { name: "View Details" }).getAttribute("href"),
    `/titles/${id}`,
  );
  sameNode(heroUi.queryByRole("button", { name: "Favorite title" }), null);
  sameNode(heroUi.queryByRole("button", { name: "Rate" }), null);
  assert.equal(
    heroUi.getByRole("heading", { level: 1 }).textContent,
    view.title.name,
  );
  const otherId = "40000000-0000-4000-8000-000000000003";
  const otherView: TitleView = {
    ...view,
    id: otherId,
    title: {
      ...view.title,
      name: "Another isolated title",
      reference: { provider: "scenestack", providerId: otherId },
    },
  };
  heroUi.rerender(
    <ProductProviders bootstrap={bootstrap}>
      <QueryClientProvider client={queryClient}>
        <FeaturedTitle views={[view, otherView]} />
      </QueryClientProvider>
    </ProductProviders>,
  );
  await user.click(heroUi.getByRole("button", { name: "Next featured title" }));
  assert.equal(
    heroUi.getByRole("heading", { level: 1 }).textContent,
    "Another isolated title",
  );
  assert.equal(
    heroUi.getByRole("link", { name: "View Details" }).getAttribute("href"),
    `/titles/${otherId}`,
  );
  assert.equal(
    heroUi
      .getByRole("button", { name: "Show Another isolated title" })
      .getAttribute("aria-pressed"),
    "true",
  );
  await user.click(heroUi.getByRole("button", { name: "Next featured title" }));
  assert.equal(
    heroUi.getByRole("heading", { level: 1 }).textContent,
    view.title.name,
  );
  await user.click(
    heroUi.getByRole("button", { name: "Previous featured title" }),
  );
  assert.equal(
    heroUi.getByRole("heading", { level: 1 }).textContent,
    "Another isolated title",
  );
  cleanup();
  dom.window.history.replaceState(null, "", "/discover");
  const { CatalogBrowser } =
    await import("../src/components/product/catalog-browser");
  const { productQuerySchema } = await import("../src/lib/product/validation");
  const { TitleRouteModal } =
    await import("../src/components/product/title-route-modal");
  handlers.rememberTitle = async () => ({ ok: true });
  function CatalogHarness() {
    return (
      <ProductProviders bootstrap={bootstrap}>
        <CatalogBrowser
          initial={{
            availability: "ready",
            titles: [view],
            offset: 0,
            nextCursor: null,
            previousCursor: null,
          }}
          initialQuery={productQuerySchema.parse({})}
        />
        {location.pathname.startsWith("/titles/") && (
          <TitleRouteModal
            details={{
              ...view,
              originalTitle: null,
              ageRating: null,
              releaseDate: null,
              runtimeMinutes: null,
              aliases: [],
              countries: [],
              languages: [],
              companies: [],
              warnings: [],
              relationshipLabels: {},
              credits: [],
              trailers: [],
              related: [],
              providerAttributions: [],
            }}
          />
        )}
      </ProductProviders>
    );
  }
  const catalogUi = render(<CatalogHarness />);
  await user.type(
    catalogUi.getByRole("combobox", {
      name: "Search titles, collections, or people",
    }),
    "Isolated",
  );
  await user.click(catalogUi.getByRole("button", { name: "Anime" }));
  catalogUi.rerender(<CatalogHarness />);
  await waitFor(
    () =>
      assert.equal(new URLSearchParams(location.search).get("q"), "Isolated"),
    { timeout: 1500 },
  );
  assert.equal(new URLSearchParams(location.search).get("category"), "anime");
  catalogUi.rerender(<CatalogHarness />);
  const card = await catalogUi.findByRole("link", { name: /Isolated movie/ });
  assert.ok(latePage);
  assert.equal(lateSignal?.aborted, true);
  await act(async () => latePage!());
  sameNode(catalogUi.queryByText("Superseded results"), null);
  assert.equal(card.querySelectorAll("button").length, 0);
  const settledCalls = feedCalls;
  const originalSearch = location.search;
  // Stand in for Next's soft navigation transport and retain the actual
  // poster click, route dialog, history back and focus-return behavior.
  card.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      dom.window.history.pushState(null, "", card.getAttribute("href"));
    },
    { once: true },
  );
  await user.click(card);
  catalogUi.rerender(<CatalogHarness />);
  await catalogUi.findByRole("dialog", {
    name: "Title details · Isolated movie",
  });
  assert.equal(
    catalogUi.container.querySelector(".category-pills .active")?.textContent,
    "Anime",
  );
  assert.equal(
    (
      catalogUi.container.querySelector(
        'input[role="combobox"]',
      ) as HTMLInputElement
    ).value,
    "Isolated",
  );
  await user.click(catalogUi.getByRole("button", { name: "Close dialog" }));
  await waitFor(() => assert.equal(location.pathname, "/discover"));
  catalogUi.rerender(<CatalogHarness />);
  await waitFor(() => sameNode(dom.window.document.activeElement, card));
  assert.equal(location.search, originalSearch);
  sameNode(
    await catalogUi.findByRole("link", { name: /Isolated movie/ }),
    card,
  );
  assert.equal(feedCalls, settledCalls);
  await user.click(catalogUi.getByRole("button", { name: /Filters/ }));
  const year = await catalogUi.findByRole("spinbutton", {
    name: "Release year",
  });
  const beforeYear = location.search;
  fireEvent.change(year, { target: { value: "2001.5" } });
  fireEvent.blur(year);
  assert.equal(location.search, beforeYear);
  cleanup();
  const { CreatorProfile } = await import("../src/components/product/profile");
  const missingProfileUi = render(
    <ProductProviders bootstrap={bootstrap}>
      <CreatorProfile initial={null} />
    </ProductProviders>,
  );
  await missingProfileUi.findByText("This profile is unavailable.");
  sameNode(missingProfileUi.queryByText("Isolated member"), null);
  sameNode(missingProfileUi.queryByText("Only you can see this"), null);
  cleanup();
  loader._load = originalLoad;
  globalThis.fetch = previousFetch;
  dom.window.close();
});
