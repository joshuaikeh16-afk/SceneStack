import { PageContainer } from "@/components/layout/page-container";
import { CatalogBrowser } from "@/components/product/catalog-browser";
import { productQuerySchema } from "@/lib/product/validation";
import { discoverData } from "@/lib/product/queries";
import { titleFeedPage } from "@/lib/product/title-feed";
export const metadata = { title: "Discover" };
export default async function Discover({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = productQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : productQuerySchema.parse({});
  const initial =
    query.tab === "titles"
      ? await titleFeedPage("catalog", query)
      : await discoverData(query);
  return (
    <PageContainer className="account-page discover-page">
      <header className="discover-heading">
        <div>
          <p className="eyebrow">FIND YOUR NEXT STORY</p>
          <h1>Discover</h1>
          <p>What will you find next?</p>
        </div>
      </header>
      {!parsed.success && (
        <p className="form-error" role="alert">
          Some filters were invalid. Showing all stories.
        </p>
      )}
      <CatalogBrowser initial={initial} initialQuery={query} />
    </PageContainer>
  );
}
