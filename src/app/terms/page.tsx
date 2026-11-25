import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { site } from "@/config/site";
export const metadata = {
  title: "Terms of Service",
  description:
    "Terms for using SceneStack’s discovery, library, and community collection features.",
  alternates: { canonical: "/terms" },
};
export default function Terms() {
  return (
    <PageContainer className="account-page legal-page">
      <header className="compact-heading">
        <p className="eyebrow">A FEW SHARED EXPECTATIONS</p>
        <h1>Terms of Service</h1>
        <p>Last updated 25 November 2026</p>
      </header>
      <section>
        <h2>The service</h2>
        <p>
          SceneStack is operated by {site.operator}, an independent developer.
          It helps you discover entertainment, privately track titles, and
          create and share collections with members. Launch access is free and
          non-commercial, without advertisements or paid subscriptions.
          SceneStack does not host or stream the entertainment titles listed in
          its catalog.
        </p>
      </section>
      <section>
        <h2>Your account</h2>
        <p>
          Use your own Google account to sign in and provide accurate account
          information. Keep your account secure and tell us if you suspect
          unauthorized access. You must be legally able to use the service in
          your location; where required, a parent or guardian must authorize
          your use.
        </p>
      </section>
      <section>
        <h2>Your content & visibility</h2>
        <p>
          You retain rights to the original profile text, collection
          descriptions, notes, and images you contribute. You permit SceneStack
          to store, display, and process that content to provide the features
          you select. Upload only material you have the right to use.
        </p>
        <p>
          Collections are private by default. Publishing makes a collection
          available to members. Saving follows the original; importing creates a
          separate editable private copy. Unpublishing removes access to the
          original and its saved references; an independent imported copy may
          remain with its owner. Do not publish personal information about
          others without permission.
        </p>
      </section>
      <section>
        <h2>Community conduct</h2>
        <p>
          Do not harass or impersonate others; publish unlawful, infringing, or
          abusive material; manipulate community ratings; misuse automation;
          evade access controls; or interfere with the service. Use available
          report and block controls for community concerns. Authorized
          moderators may remove content or restrict accounts to protect members
          and the service.
        </p>
      </section>
      <section>
        <h2>Catalog data & third-party services</h2>
        <p>
          Entertainment metadata, posters, trademarks, and trailers belong to
          their respective rights holders. Catalog availability depends on
          provider permissions and availability. Provider-sourced integrations
          can be disabled independently while their permitted use is reviewed.
          Possession of API credentials does not mean a provider endorses or has
          approved SceneStack’s public release.
        </p>
        <p>
          Catalog information can be incomplete or outdated. External links are
          governed by the destination’s terms. SceneStack community scores come
          from eligible SceneStack ratings, rather than external provider
          ratings. See{" "}
          <Link className="text-link" href="/credits">
            Credits
          </Link>{" "}
          for provider attribution.
        </p>
      </section>
      <section>
        <h2>Availability & account closure</h2>
        <p>
          Features may change or be temporarily unavailable. We do not guarantee
          uninterrupted availability or complete catalog accuracy. You can
          request an export and initiate account deletion from Settings.
          Deletion hides your account immediately and offers a 30-day recovery
          window; irreversible cleanup is a separate operator process.
        </p>
        <p>
          Nothing in these terms removes rights or remedies that cannot lawfully
          be excluded. Questions about service restrictions, rights complaints,
          or account closure can be sent to the contact below.
        </p>
      </section>
      <section>
        <h2>Contact & changes</h2>
        <p>
          Email{" "}
          <a className="text-link" href={`mailto:${site.supportEmail}`}>
            {site.supportEmail}
          </a>{" "}
          for support, privacy, rights, or terms questions. Changes to these
          terms will appear here with an updated date. Read our{" "}
          <Link className="text-link" href="/privacy">
            Privacy Policy
          </Link>{" "}
          for details of data processing.
        </p>
      </section>
    </PageContainer>
  );
}
