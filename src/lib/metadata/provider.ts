import type { EntertainmentKind, Title, TitleReference } from "@/types/title";

/** Implement approved adapters server-side; UI consumes these normalized contracts. */
export interface MetadataProvider {
  readonly id: string;
  readonly supportedKinds: readonly EntertainmentKind[];
  search(
    query: string,
    options?: { kind?: EntertainmentKind; page?: number; signal?: AbortSignal },
  ): Promise<{
    items: Title[];
    nextPage: number | null;
  }>;
  getTitle(
    reference: TitleReference,
    options?: { signal?: AbortSignal },
  ): Promise<Title | null>;
}
