import type { Row } from "./database";
import type { Title } from "./title";

export type Availability =
  "ready" | "unconfigured" | "migration_required" | "unavailable";
export type ActionReply<T = undefined> =
  { ok: true; data: T } | { ok: false; code: string; message: string };
export type TitleState = {
  titleId: string;
  tracking: Row<"tracking">["status"] | null;
  favorite: boolean;
  rating: number | null;
};
export type TitleView = {
  id: string;
  sourceId?: string;
  title: Title;
  genres: { id: string; name: string }[];
  communityRating: {
    source: "scenestack";
    score: number;
    voteCount: number;
  } | null;
  voteCount: number;
  status: Row<"titles">["status"];
  edition: string;
  reason?: string;
  freshness?: { lastSuccessAt: string | null; stale: boolean };
};
export type TitleDetails = TitleView & {
  originalTitle: string | null;
  ageRating: string | null;
  releaseDate: string | null;
  runtimeMinutes: number | null;
  aliases: string[];
  countries: string[];
  languages: string[];
  companies: string[];
  warnings: string[];
  relationshipLabels: Record<string, string>;
  credits: { id: string; name: string; department: string; role: string }[];
  trailers: { id: string; url: string; label: string | null }[];
  related: TitleView[];
  providerAttributions: {
    name: string;
    termsUrl: string | null;
    attribution: string | null;
  }[];
};
export type ProfileView = Pick<
  Row<"profiles">,
  | "id"
  | "username"
  | "display_name"
  | "avatar_path"
  | "bio"
  | "cover_path"
  | "featured_collection_id"
  | "created_at"
>;
export type ProductBootstrap = {
  userId: string | null;
  name: string;
  email: string | null;
  availability: Availability;
  profile: Row<"profiles"> | null;
  onboarding: Row<"onboarding"> | null;
  roles: Row<"admin_roles">["role"][];
};
export type CatalogResult = {
  availability: Availability;
  titles: TitleView[];
  hasMore: boolean;
  total?: number;
  collections?: CollectionView[];
  people?: ProfileView[];
  includedIds?: string[];
};
export type CollectionView = {
  record: Row<"collections">;
  creator: ProfileView | null;
  count: number;
  posters: (string | null)[];
  favorite: boolean;
  saved: boolean;
  sourceCreator: ProfileView | null;
  sourceDeleted: boolean;
  selectedTitleCount?: number;
};
export type CollectionDetails = CollectionView & {
  items: {
    id: string;
    position: number;
    note: string;
    addedAt: string;
    title: TitleView;
  }[];
  hasMore: boolean;
  nextItemId: string | null;
  spoilerGated?: boolean;
  metrics: { favorites: number; saves: number; imports: number } | null;
};
export type NotificationView = Row<"notifications"> & {
  actor: ProfileView | null;
  collectionTitle: string | null;
};
export type LibraryResult = {
  availability: Availability;
  titles: TitleView[];
  states: TitleState[];
  collections: CollectionView[];
  hasMore: boolean;
};
export type LookupData = {
  genres: { id: string; name: string }[];
  countries: { code: string; name: string }[];
  languages: { code: string; name: string }[];
};

export type TitleFeedSource =
  "catalog" | "watching" | "planned" | "recent" | "recommendations";

export type TitleFeedPage = {
  availability: Availability;
  titles: TitleView[];
  nextCursor: string | null;
  previousCursor: string | null;
  offset: number;
  issues?: { source: string; code: string; message: string }[];
  catalog?: {
    mode: "federated" | "local";
    providers: string[];
    limitations: string[];
    terminal: "exhausted" | "cache_only" | "pagination_limit" | null;
  };
};
