import "server-only";
import type { MetadataProvider } from "./provider";

// No providers are approved or connected in this phase. No fabricated fallback data.
export const metadataProviders: readonly MetadataProvider[] = [];
