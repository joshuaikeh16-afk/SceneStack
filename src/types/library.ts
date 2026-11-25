import type { TitleReference } from "./title";

// Canonical persistence contracts; display labels remain presentation concerns.
export type TrackingStatus =
  "planned" | "watching" | "completed" | "on_hold" | "dropped";
export type LibraryEntry = {
  ownerId: string;
  title: TitleReference;
  status: TrackingStatus;
  rating: number | null;
  favorite: boolean;
};
export type CollectionVisibility = "private" | "published";
export type Collection = {
  id: string;
  ownerId: string;
  name: string;
  visibility: CollectionVisibility;
};
export type PublicProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};
