import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { site, siteOrigin } from "@/config/site";
export const metadata = {
  title: "Privacy Policy",
  description:
    "How SceneStack handles account information, private tracking, and public collections.",
  alternates: { canonical: "/privacy" },
};
export default function Privacy() {
  return (
    <PageContainer className="account-page legal-page">
      <header className="compact-heading">
        <p className="eyebrow">YOUR STORIES. YOUR PRIVACY.</p>
        <h1>Privacy Policy</h1>
        <p>Last updated 25 November 2026</p>
      </header>
      <section>
        <h2>Who operates SceneStack</h2>
        <p>
          SceneStack, whose planned production address is {siteOrigin()}, is
          operated by {site.operator}, an independent developer. For privacy
          requests, contact{" "}
          <a className="text-link" href={`mailto:${site.supportEmail}`}>
            {site.supportEmail}
          </a>
          .
        </p>
      </section>
      <section>
        <h2>Information we use</h2>
        <p>
          You can browse the public title catalog without signing in. Google is
          the only sign-in method. Authentication supplies an account
          identifier, email address, and available profile information. We do
          not receive your Google password.
        </p>
        <p>
          If you create an account, we store your username, display name, bio,
          uploaded images, category and genre preferences, tracking status,
          ratings, favorites, collections, follows, and notifications. Search
          and viewing history can be stored for signed-in discovery features.
          Settings includes history controls.
        </p>
      </section>
      <section>
        <h2>What stays private</h2>
        <p>
          Your personal tracking, title favorites, individual ratings,
          preferences, and private collections are visible only to your account
          through normal product access. Profiles, follower counts, published
          collections, and public collection interactions are visible to other
          signed-in members under the service’s visibility rules. Collections
          start private; you decide whether to publish them.
        </p>
        <p>
          SceneStack community scores are aggregates, displayed only after at
          least five eligible ratings. Your individual rating is not published
          with your identity. Authorized technical operators may need to access
          service data to maintain security, handle support requests, or meet
          legal obligations.
        </p>
      </section>
      <section>
        <h2>Why we process information</h2>
        <p>
          We use this information to authenticate you, maintain your library,
          personalize discovery, display your profile and published collections,
          support social interactions, prevent abuse, and operate the service.
          Launch access is free and non-commercial, without advertisements or
          paid subscriptions.
        </p>
      </section>
      <section>
        <h2>Service providers & external links</h2>
        <p>
          Google provides sign-in. Supabase provides authentication, database,
          and file storage. Vercel is the intended application host. These
          providers process service information under their own terms and
          privacy policies; processing may take place outside your country.
        </p>
        <p>
          When enabled after usage review, TMDB and MyAnimeList supply
          entertainment metadata and artwork. Artwork requests may reach the
          relevant provider’s image host, or the application’s image proxy.
          External trailer and provider links open third-party services with
          their own privacy practices. Having provider credentials does not
          establish public-release approval.
        </p>
      </section>
      <section>
        <h2>Cookies & device storage</h2>
        <p>
          Authentication uses cookies to maintain your session. Browser session
          storage can preserve an intended action across sign-in. Local storage
          supports preferences and product interactions. An installed service
          worker stores the offline shell and may store explicitly permitted
          public metadata. Private pages, account images, and personal APIs are
          excluded from that offline cache.
        </p>
      </section>
      <section>
        <h2>Retention, deletion & your choices</h2>
        <p>
          You can edit your profile, manage history, remove library entries, and
          request a data export in Settings. Deleting your account hides it
          immediately and starts a 30-day recovery window. Recovery requires a
          fresh Google sign-in.
        </p>
        <p>
          Irreversible cleanup is a separate operator process. Completion of the
          recovery window does not itself guarantee that every stored record or
          backup has already been erased. Some records may need to be retained
          for security or legal purposes. Email us to request access,
          correction, deletion, or information about retained data; applicable
          rights depend on your location.
        </p>
      </section>
      <section>
        <h2>Security & policy updates</h2>
        <p>
          We use authenticated access and database access controls to protect
          account information. No service can guarantee absolute security.
          Report suspected exposure to the privacy contact above. Material
          policy updates will be reflected on this page with a revised date.
        </p>
      </section>
      <p className="legal-contact">
        <Link className="text-link" href="/contact">
          Contact SceneStack
        </Link>
      </p>
    </PageContainer>
  );
}
