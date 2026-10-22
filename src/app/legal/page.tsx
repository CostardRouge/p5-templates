import type {
  Metadata
} from "next";
import Link from "next/link";

import BreadcrumbJsonLd from "@/components/BreadcrumbJsonLd/BreadcrumbJsonLd";
import {
  SOURCE_URL
} from "@/config/site";
import {
  isAnalyticsEnabled, UMAMI_SRC
} from "@/lib/analytics/umami";
import {
  buildOgTitle, getBaseUrl, SITE_AUTHOR, SITE_NAME, SITE_URL
} from "@/lib/seo";

const TITLE = "Legal notice and privacy";
const DESCRIPTION =
  "Who publishes and hosts Sketchbook, what stays in your browser, what a recording handed to the server sends, and what the audience measurement counts.";
const UPDATED = "19 October 2026";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/legal"
  },
  openGraph: {
    title: buildOgTitle( TITLE ),
    description: DESCRIPTION,
    url: "/legal",
    siteName: SITE_NAME,
    type: "website"
  }
};

/**
 * The legal notice (COMMON-PROJECT-SPEC C17): facts only, every one of them
 * read from the code where the code holds it, so the page cannot describe a
 * site other than the one it is on — the measured site's host comes from
 * `SITE_URL`, the tracker's host from `UMAMI_SRC` (and a build with analytics
 * off says it counts nothing), the source link from `SOURCE_URL`. What a
 * recording handed to the server stores is `api/recordings/enqueue`'s doing;
 * what a pageview carries is `UmamiTracker`'s. Change those, change this page
 * in the same commit.
 *
 * No e-mail address: none is published anywhere in this repository, so the
 * contact is the repository's issue tracker rather than an invented mailbox.
 */

const SECTIONS = [
  {
    id: "publisher",
    title: "Publisher"
  },
  {
    id: "hosting",
    title: "Hosting"
  },
  {
    id: "privacy",
    title: "Privacy"
  },
  {
    id: "device",
    title: "On your device"
  },
  {
    id: "recordings",
    title: "Recordings handed to the server"
  },
  {
    id: "measurement",
    title: "Audience measurement"
  },
  {
    id: "cookies",
    title: "Cookies"
  },
  {
    id: "rights",
    title: "Your rights"
  },
  {
    id: "licence",
    title: "Licence and content"
  },
  {
    id: "liability",
    title: "Liability"
  }
] as const;

const LINK_CLASS =
  "underline underline-offset-2 hover:text-foreground transition-colors";

const P_CLASS =
  "max-w-[70ch] text-sm sm:text-base text-label leading-relaxed text-pretty";

/** The tracker's host, for the measurement section; null when a malformed
 * override makes it unreadable (the layout's connection hints do the same). */
function umamiHost(): string | null {
  try {
    return new URL( UMAMI_SRC ).host;
  } catch {
    return null;
  }
}

function Strong( {
  children
}: {
  children: React.ReactNode;
} ) {
  return <strong className="font-medium text-foreground">{ children }</strong>;
}

function Section( {
  id,
  title,
  children
}: {
  id: string;
  title: string;
  children: React.ReactNode;
} ) {
  return (
    <section id={ id } className="flex flex-col gap-3 scroll-mt-6">
      <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
        { title }
      </h2>
      { children }
    </section>
  );
}

export default function LegalPage() {
  const baseUrl = getBaseUrl();
  const siteHost = new URL( SITE_URL ).host;
  const trackerHost = isAnalyticsEnabled ? umamiHost() : null;

  const breadcrumbItems = [
    {
      name: "Home",
      url: baseUrl
    },
    {
      name: TITLE,
      url: `${ baseUrl }/legal`
    }
  ];

  return (
    <div className="p-3 sm:p-6">
      <BreadcrumbJsonLd items={ breadcrumbItems } />

      {/* `pt-14`: the menu-bar button is fixed at the top-left corner of the
          viewport, so the heading starts below it on a phone (same as the
          site map page). */ }
      <div className="mx-auto w-full max-w-3xl flex flex-col gap-8 sm:gap-10 pt-14 pb-6 sm:py-10">
        <header className="flex flex-col gap-3">
          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-foreground">
            { TITLE }
          </h1>
          <p className="max-w-[60ch] text-sm sm:text-base text-label leading-relaxed">
            Who publishes { SITE_NAME }, who hosts it, and what it knows about
            you: very little. What you make here stays in your browser unless
            you hand a recording to the server.
          </p>
          <p className="text-xs text-label">Last updated on { UPDATED }.</p>
          <nav aria-label="On this page">
            <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.2em] text-label">
              { SECTIONS.map( ( section ) => (
                <li key={ section.id }>
                  <a
                    href={ `#${ section.id }` }
                    className="hover:text-foreground transition-colors"
                  >
                    { section.title }
                  </a>
                </li>
              ) ) }
            </ul>
          </nav>
        </header>

        <Section id="publisher" title="Publisher">
          <p className={ P_CLASS }>
            { SITE_NAME } is published by <Strong>{ SITE_AUTHOR }</Strong>, a
            private individual, on a non-commercial basis: it is free, shows no
            ads and sells nothing.
          </p>
          <p className={ P_CLASS }>
            Contact: open an issue on the{ " " }
            <a href={ `${ SOURCE_URL }/issues` } className={ LINK_CLASS }>
              source repository
            </a>
            .
          </p>
        </Section>

        <Section id="hosting" title="Hosting">
          <p className={ P_CLASS }>
            <Strong>{ siteHost }</Strong> runs on a server the publisher
            operates himself. The pages reach you through Cloudflare’s network
            (Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107,
            United States,{ " " }
            <a href="https://www.cloudflare.com" className={ LINK_CLASS }>
              cloudflare.com
            </a>
            ), which delivers them and protects the site; like any host, it
            processes your IP address to do so — see{ " " }
            <a
              href="https://www.cloudflare.com/privacypolicy/"
              className={ LINK_CLASS }
            >
              Cloudflare’s privacy policy
            </a>
            .
          </p>
          <p className={ P_CLASS }>
            Audience measurement runs on the publisher’s own server too (see
            below).
          </p>
        </Section>

        <Section id="privacy" title="Privacy">
          <p className={ P_CLASS }>
            In short: { SITE_NAME } doesn’t know who you are and doesn’t try to.
            No account, no cookie, no advertising.
          </p>
        </Section>

        <Section id="device" title="On your device">
          <p className={ P_CLASS }>
            The studio saves the sketch you are editing as you go, the{ " " }
            <Link href="/gallery" className={ LINK_CLASS }>
              gallery
            </Link>{ " " }
            keeps the pieces you chose to keep (their settings and a small
            thumbnail), and your display preferences are remembered — all in
            your browser’s storage (local storage and IndexedDB), on this device
            only. Opening the app also stores some of its files and thumbnails
            in the browser’s cache so pages load faster. None of this is sent
            anywhere, except what you upload yourself (next section). To erase
            it, clear this site’s data in your browser’s settings.
          </p>
        </Section>

        <Section id="recordings" title="Recordings handed to the server">
          <p className={ P_CLASS }>
            Exporting an image or a video in the browser sends nothing: the
            file is made on your device. If instead you hand a recording to the
            server’s queue — a feature the site can turn off — the sketch’s
            settings and the media you dropped into it (images, videos, sounds)
            are uploaded to the publisher’s server, rendered there, and kept
            with the resulting files until the job is deleted.
          </p>
          <p className={ P_CLASS }>
            There is no account, so nothing ties a job to you — and nothing
            protects it either: jobs are listed on the Recordings page, and
            anyone who opens it can see, download or delete them. Don’t hand the
            server anything private.
          </p>
          <p className={ P_CLASS }>
            If you ask to be notified when a recording ends, your browser gives
            the server an address at its push service (Google, Mozilla, Apple or
            Microsoft, depending on the browser) and two keys; the server keeps
            them until you turn notifications off or the push service reports
            them gone, and sends nothing but the job’s status.
          </p>
        </Section>

        <Section id="measurement" title="Audience measurement">
          { trackerHost ? (
            <>
              <p className={ P_CLASS }>
                Visits are counted with{ " " }
                <a href="https://umami.is" className={ LINK_CLASS }>
                  Umami
                </a>
                , self-hosted on the publisher’s own server at{ " " }
                <code className="font-mono text-foreground">{ trackerHost }</code>:
                no third party receives the data, and none of it serves
                advertising.
              </p>
              <p className={ P_CLASS }>
                <Strong>Counted:</Strong> the pages viewed (their address — a
                search keyword included when the address carries one — and
                title), the page you came from, your browser, system, type of
                device, screen size, language and country. A sketch embedded on
                another site is a page of this site shown inside theirs, counted
                the same way.
              </p>
              <p className={ P_CLASS }>
                <Strong>Never counted:</Strong> what you draw, edit or export,
                the media you drop into a sketch, or anything that could follow
                you from one site to another. Your IP address is never stored:
                it gives the country and a one-day anonymous visitor id, then is
                discarded. No cookie is set.
              </p>
              <p className={ P_CLASS }>
                The counter honours your browser’s <em>Do Not Track</em>{ " " }
                setting. There is no switch on the site itself yet.
              </p>
            </>
          ) : (
            <p className={ P_CLASS }>
              This copy of { SITE_NAME } doesn’t count visits.
            </p>
          ) }
        </Section>

        <Section id="cookies" title="Cookies">
          <p className={ P_CLASS }>
            { SITE_NAME } sets no cookie, so there is no consent banner: there is
            nothing to consent to.
          </p>
        </Section>

        <Section id="rights" title="Your rights">
          <p className={ P_CLASS }>
            Under the GDPR you may ask to access or erase data about you.{ " " }
            { SITE_NAME } keeps none that names you: your work is on your
            device, a recording handed to the server carries only what you put
            in it, and a visit is an anonymous count. For any question or
            request, open an issue on the{ " " }
            <a href={ `${ SOURCE_URL }/issues` } className={ LINK_CLASS }>
              repository
            </a>
            ; you may also lodge a complaint with your data-protection
            authority (in France, the{ " " }
            <a href="https://www.cnil.fr" className={ LINK_CLASS }>
              CNIL
            </a>
            ).
          </p>
        </Section>

        <Section id="licence" title="Licence and content">
          <p className={ P_CLASS }>
            { SITE_NAME } is free software: its{ " " }
            <a href={ SOURCE_URL } className={ LINK_CLASS }>
              source code
            </a>
            , the sketches included, is published under the{ " " }
            <a href={ `${ SOURCE_URL }/blob/main/LICENSE` } className={ LINK_CLASS }>
              MIT licence
            </a>
            . What you render or export with it is yours to use.
          </p>
        </Section>

        <Section id="liability" title="Liability">
          <p className={ P_CLASS }>
            { SITE_NAME } is provided as is, in good faith, with no warranty of
            any kind. Links to other sites are given for convenience; their
            content is theirs.
          </p>
        </Section>
      </div>
    </div>
  );
}
