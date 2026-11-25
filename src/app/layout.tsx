import type { Metadata, Viewport } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PrimaryNav } from "@/components/navigation/primary-nav";
import { ProductProviders } from "@/components/product/providers";
import { getBootstrap } from "@/lib/product/runtime";
import { PwaRuntime } from "@/components/product/pwa";
import { AppChrome } from "@/components/layout/app-chrome";
import { site, siteOrigin, searchIndexingEnabled } from "@/config/site";
import "./globals.css";
import "@fontsource-variable/geist";
import "./production.css";
import "@/components/catalog/carousel.css";
import "@/components/control/control.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  openGraph: {
    type: "website",
    siteName: site.name,
    title: site.name,
    description: site.description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: site.name,
    description: site.description,
  },
  applicationName: site.name,
  appleWebApp: {
    capable: true,
    title: "SceneStack",
    statusBarStyle: "black-translucent",
  },
  icons: { apple: "/app-icons/apple-touch-icon.png" },
  // Search indexing is an explicit release step, never enabled by a preview build.
  robots: {
    index: searchIndexingEnabled(),
    follow: searchIndexingEnabled(),
  },
};
export const viewport: Viewport = {
  themeColor: "#090A0D",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  const bootstrap = await getBootstrap();
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <ProductProviders bootstrap={bootstrap}>
          <PwaRuntime />
          <AppChrome
            header={<Header />}
            footer={<Footer />}
            dock={<PrimaryNav mobile />}
            modal={modal}
          >
            {children}
          </AppChrome>
        </ProductProviders>
      </body>
    </html>
  );
}
