import { requireProductUser } from "@/lib/product/runtime";
import { PageContainer } from "@/components/layout/page-container";
import { ConnectedLibrary } from "@/components/product/library";
import { libraryQuerySchema } from "@/lib/product/validation";
export const metadata = {
  title: "My Library",
  robots: { index: false, follow: false },
};
export default async function Library({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = libraryQuerySchema.safeParse(await searchParams);
  const params = new URLSearchParams();
  if (parsed.success)
    for (const [key, value] of Object.entries(parsed.data))
      params.set(key, String(value));
  await requireProductUser(`/library${params.size ? `?${params}` : ""}`);
  return (
    <PageContainer className="account-page library-page">
      <header className="library-heading">
        <div>
          <p className="eyebrow">YOUR STORIES, KEPT CLOSE</p>
          <h1>My Library</h1>
          <p>Keep track of what’s next, what’s on, and what stayed with you.</p>
        </div>
      </header>
      <ConnectedLibrary />
    </PageContainer>
  );
}
