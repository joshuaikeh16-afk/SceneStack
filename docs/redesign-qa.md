> Historical Prompt 02 report. The connected Prompt 04 implementation supersedes the pending-feature descriptions below; see [current delivery report](prompt-04-delivery.md).

# SceneStack cinematic redesign — delivery and verification

## Visual changes

The presentation layer has been rebuilt around an editorial entertainment experience: a framed panoramic hero, original illustrated category guides, quieter charcoal surfaces, compact category shortcuts, and varied layouts for personal stories and future community collections. No live trending, recommendation, title, rating, follower count, collection, or tracking record has been invented.

**Pages rebuilt:** Home, Discover, My Library, Profile, Login, Settings, account loading skeletons, and the shared navigation/footer. Existing missing-page and error components use the new visual system.

**Component library:** `CinematicHero`, `EditorialShelf`, `AuthPrompt`, `CategorySelector`, `SearchField`, `FilterBar`, `TitleCard`, `TitlePosterGrid`, `HorizontalTitleRail`, `CollectionCard`, `LibraryBrowser`, `ProfileHeader`, `PageContainer`, `SectionHeader`, `Button`/`ButtonLink`, `Avatar`, `Badge`, and `LoadingSkeleton`. Header, brand, footer, notification disclosure, and empty states use the shared system. There is no modal requiring a focus trap; filter and notification disclosures are contextual, non-modal controls.

## Tokens and typography

The CSS theme defines `#090A0D` background, `#111318` surfaces, `#191C23` elevated surfaces, `#242832` hover surfaces, `#F6F5F2` primary text, `#A3A6AF` secondary text, `#F2A23A` accent, and `#FFB653` accent hover. Muted text is slightly brighter than the supplied starting palette for readability. Spacing, page width/gutters, radii, type sizes, and transitions share tokens.

Geist is self-hosted through `@fontsource-variable/geist`; no Google font request is made. Georgia italic is used selectively in editorial display text. All current images are original local SVGs. `city.svg`, `orbit.svg`, and `grove.svg` join the existing landscape artwork. No remote image hosts are approved. The poster component rejects unapproved image paths and supplies a missing-image fallback. Metadata host licensing and image allowlists must be added together in a later phase.

## Responsive and interaction design

Desktop uses a compact sticky top bar with exactly four primary destinations, a search entry point, and contextual account controls. Signed-in notifications open an honest pending-feature disclosure with Escape/outside-click dismissal; there is no fabricated unread indicator.

At widths below 900px, the same four destinations move into the bottom navigation. Touch targets, page bottom padding, and `env(safe-area-inset-bottom)` prevent the bar from covering content. Small-screen headers keep the brand and compact search/account actions. Category shortcuts and editorial cards reflow into two columns; future poster data uses two columns on phones, four on tablets, six on regular desktops, and seven on large screens. Horizontal title rails scroll inside their own region.

Discover submits search through a normal GET form and retains the selected category. Chips and clear/reset links update the URL. Advanced filters are explicitly unavailable, inside a compact disclosure. Library sections support Left/Right/Home/End keyboard navigation, with proper tab/panel relationships. Tracking filters use pressed states and do not display progress. Reduced-motion preferences disable animation and smooth scrolling.

## Authentication preservation

Google initiation, the PKCE exchange callback, Supabase browser/server clients, verified user access, cookie refresh, and the sign-out action are retained. No authentication bypass, mock account route, database table, SQL migration, provider integration, or extra sign-in method was added.

The one behavioral extension is an allowlist for Discover return URLs: only a supported `category` and a bounded `q` survive sign-in. Duplicate/unknown keys and nested redirects are rejected. This preserves category selection for guests while keeping the existing open-redirect protections.

`.env.local` was neither read nor edited for this redesign. The unconfigured smoke server explicitly uses blank public environment overrides; it does not modify local configuration. Component-test fixtures remain confined to tests and cannot appear through application routes.

## Verification

ESLint (zero warnings), the strict TypeScript checks, all four automated test files, and the production build pass. The unconfigured development server passes all 27 HTTP smoke checks. The production server also passes 26 guest-only checks with the existing configuration; this mode skips invalid-code exchange. Both servers started successfully and were stopped after verification. The suite includes existing environment and redirect tests plus query normalization, URL-image approval, title-link and rating semantics, profile onboarding, library markup, and category-link retention checks.

**Browser tooling was unavailable:** the browser inventory returned no available browsers or apps. No real-browser responsive inspection or mobile/desktop screenshot capture occurred. No screenshot locations are claimed. Component/server checks are not substitutes for visual inspection or a real Google consent flow.

## Exact local verification commands

From the repository root, with dependencies already installed:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run dev
```

Open `http://localhost:3000` in your browser. Keep your existing `.env.local` for real Google sign-in. Do not overwrite it with the example file.

For the unconfigured boundary smoke checks in two terminals:

```bash
# Terminal 1 — these overrides apply to this process only.
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run dev -- --port 3001
```

```bash
# Terminal 2
node tests/routes.smoke.mjs http://localhost:3001
```

The default smoke suite intentionally expects the missing-configuration state. Do not point it at a configured production deployment. For a configured local production startup, stop the dev server, then use `npm run build && npm start`.

For guest-only checks against your configured **local** production server, run `node tests/routes.smoke.mjs http://localhost:3000 --auto`. This accepts either Google or setup UI and skips the invalid-code exchange so it does not probe your real Auth API. It does not sign in or certify a live OAuth flow.

## Manual browser matrix

Open browser Developer Tools → device toolbar → Responsive. Enter each width and height below at 100% zoom. Test Home, Login, Discover, Library, Profile, and Settings; the last four require a real Google session.

| Viewport    | Expected layout                                                                         |
| ----------- | --------------------------------------------------------------------------------------- |
| 320 × 700   | Compact header, four-item bottom nav, two category/poster columns, stacked hero actions |
| 390 × 844   | Same phone layout with comfortable reading space                                        |
| 430 × 932   | Two-column phone cards and a larger editorial image crop                                |
| 768 × 1024  | Bottom nav, three category shortcut columns, four poster columns                        |
| 1366 × 768  | Desktop header/search, six poster columns, split editorial sections                     |
| 1440 × 900  | Desktop composition within the shared content width                                     |
| 1920 × 1080 | Centered maximum-width content and seven poster columns                                 |

At each size:

1. Inspect for horizontal page overflow, clipped header items, overlapping content, safe-area coverage, readable text, and consistent poster ratios. Only designated title rails should scroll horizontally.
2. Confirm all four primary destinations, category shortcuts, search submit/clear, reset filters, library tabs/statuses, profile setup anchor, settings anchors, and sign-out can be reached by keyboard. Use Left/Right/Home/End on library section tabs.
3. Check original artwork loads, image focal points remain visible, and missing posters remain clean. Verify there are no sample titles or statistics.
4. Enable reduced motion in browser rendering preferences and check skeletons/hover behavior.
5. Capture browser screenshots after checking each page. Suggested names: `home-390x844.png`, `home-1440x900.png`, `discover-390x844.png`, `library-1440x900.png`, and `profile-390x844.png`. Screenshots containing account information should remain local.

For an optional page-overflow check in the DevTools console, run:

```js
document.documentElement.scrollWidth <= window.innerWidth;
```

## Live authentication checklist

1. Signed out, choose Anime on Home. Confirm Login retains `/discover?category=anime` in its safe return destination.
2. Continue with Google and confirm the callback returns to Discover with Anime selected.
3. Submit a search, change categories, and reset. Confirm the URL and pending-data copy agree.
4. Reload each protected page. Confirm account identity persists and no private activity appears publicly.
5. Sign out from Settings. Confirm `/library`, `/profile`, `/settings`, and `/discover` require sign-in again. Reject/expired OAuth flows must show the existing useful login error messages.

## Remaining work

Real metadata providers, results, title details, user/profile records, usernames, bios, following, notifications, exports, deletion, collections, ratings, and tracking persistence still require their later backend phases. Profile editing is an onboarding explanation, not a save form. Search/category selections are real URL state but do not query a catalog yet. Sign-in, callback success, cookie rotation, sign-out against a live project, all seven visual viewport checks, and screenshots still need browser verification.
