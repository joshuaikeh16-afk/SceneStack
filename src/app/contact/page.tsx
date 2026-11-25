import Link from "next/link";
import { Mail, ShieldCheck } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { site, siteOrigin } from "@/config/site";
export const metadata = {
  title: "Contact",
  description:
    "Contact SceneStack for support, privacy requests, and rights enquiries.",
  alternates: { canonical: "/contact" },
};
export default function Contact() {
  return (
    <PageContainer className="account-page legal-page">
      <header className="compact-heading">
        <p className="eyebrow">LET’S TALK</p>
        <h1>
          Behind every good story,
          <br />
          there’s a person.
        </h1>
        <p>
          SceneStack is built and operated by {site.operator}, an independent
          developer.
        </p>
      </header>
      <section className="contact-surface">
        <Mail size={24} strokeWidth={1.5} />
        <h2>Support & privacy</h2>
        <p>
          For account help, a privacy request, a bug report, or questions about
          metadata and artwork rights, email us.
        </p>
        <a
          className="text-link contact-email"
          href={`mailto:${site.supportEmail}`}
        >
          {site.supportEmail}
        </a>
        <p className="contact-note">
          Include the relevant page address and a short description. Please
          never send passwords, sign-in codes, or API credentials.
        </p>
      </section>
      <section>
        <h2>A little about SceneStack</h2>
        <p>
          A free, non-commercial entertainment discovery and tracking platform,
          without advertisements or paid subscriptions at launch. Our planned
          production home is{" "}
          <a className="text-link" href={siteOrigin()}>
            {new URL(siteOrigin()).hostname}
          </a>
          .
        </p>
      </section>
      <section className="legal-contact">
        <ShieldCheck size={20} />
        <p>
          Read how your data is handled in our{" "}
          <Link className="text-link" href="/privacy">
            Privacy Policy
          </Link>{" "}
          and how the service works in our{" "}
          <Link className="text-link" href="/terms">
            Terms of Service
          </Link>
          .
        </p>
      </section>
    </PageContainer>
  );
}
