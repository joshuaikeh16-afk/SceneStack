import { notFound } from "next/navigation";
import { getTitleDetails } from "@/lib/product/queries";
import { TitleDetail } from "@/components/product/title-detail";
import { PageContainer } from "@/components/layout/page-container";
import { cache } from "react";
import type { Metadata } from "next";
const detailsForPage = cache(getTitleDetails);
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const details = await detailsForPage((await params).id);
    if (!details)
      return {
        title: "Title unavailable",
        robots: { index: false, follow: false },
      };
    const description =
      details.title.synopsis?.slice(0, 180) ||
      `Explore ${details.title.name} on SceneStack.`;
    const image = details.title.backdropUrl || details.title.posterUrl;
    return {
      title: details.title.name,
      description,
      alternates: { canonical: `/titles/${details.id}` },
      openGraph: {
        title: `${details.title.name} · SceneStack`,
        description,
        url: `/titles/${details.id}`,
        ...(image ? { images: [{ url: image, alt: details.title.name }] } : {}),
      },
    };
  } catch {
    return {
      title: "Title unavailable",
      robots: { index: false, follow: false },
    };
  }
}
export default async function TitlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let details;
  try {
    details = await detailsForPage((await params).id);
  } catch {
    throw new Error("This title is temporarily unavailable. Please try again.");
  }
  if (!details) notFound();
  return (
    <PageContainer className="title-page">
      <TitleDetail key={details.id} details={details} asPage />
    </PageContainer>
  );
}
