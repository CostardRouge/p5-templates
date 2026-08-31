import "./globals.css";
import type {
  Metadata, Viewport
} from "next";
import {
  ThemeProvider
} from "next-themes";
import {
  Suspense
} from "react";
import MenuBarGate from "@/components/MenuBarGate";
import UmamiAnalytics from "@/components/UmamiAnalytics";
import UmamiTracker from "@/components/UmamiTracker";
import {
  MenuBarSlotProvider
} from "@/components/MenuBarPortal";
import ServiceWorkerUpdateNotifier from "@/components/ServiceWorkerUpdateNotifier";
import {
  getBaseUrl,
  getWebApplicationJsonLd,
  OG_IMAGE,
  SITE_AUTHOR,
  SITE_CATEGORY,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_LOCALE,
  SITE_NAME,
  THEME_COLOR_DARK,
  THEME_COLOR_LIGHT
} from "@/lib/seo";
import {
  getDevThumbnailStatus
} from "@/utils/getDevThumbnailStatus";
import {
  getDevPreviewStatus
} from "@/utils/getDevPreviewStatus";
import {
  isAnalyticsEnabled, UMAMI_SRC
} from "@/lib/analytics/umami";

const baseUrl = getBaseUrl();

/**
 * Origin of the tracker, for the connection hints below. Derived rather than
 * hardcoded so overriding NEXT_PUBLIC_UMAMI_SRC cannot leave the page
 * preconnecting to the wrong host. A malformed override yields no hint instead
 * of failing the build.
 */
const umamiOrigin = ( () => {
  if ( !isAnalyticsEnabled ) {
    return null;
  }

  try {
    return new URL( UMAMI_SRC ).origin;
  } catch {
    return null;
  }
} )();

export const metadata: Metadata = {
  metadataBase: new URL( baseUrl ),
  title: {
    default: SITE_NAME,
    template: `%s | ${ SITE_NAME }`
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  authors: [
    {
      name: SITE_AUTHOR
    }
  ],
  creator: SITE_AUTHOR,
  publisher: SITE_AUTHOR,
  formatDetection: {
    email: false,
    address: false,
    telephone: false
  },
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    locale: SITE_LOCALE,
    url: baseUrl,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE.path,
        width: OG_IMAGE.width,
        height: OG_IMAGE.height,
        alt: OG_IMAGE.alt
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [
      OG_IMAGE.path
    ]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png"
  },
  category: SITE_CATEGORY
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: THEME_COLOR_LIGHT
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: THEME_COLOR_DARK
    }
  ]
};

export default function RootLayout( {
  children
}: {
  children: React.ReactNode;
} ) {
  const jsonLd = getWebApplicationJsonLd();
  const {
    hasMissingThumbnails
  } = getDevThumbnailStatus();
  const {
    hasMissingPreviews
  } = getDevPreviewStatus();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        { umamiOrigin && (
          <>
            <link rel="dns-prefetch" href={ umamiOrigin } />
            <link
              rel="preconnect"
              href={ umamiOrigin }
              crossOrigin="anonymous"
            />
          </>
        ) }
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={ {
            __html: JSON.stringify( jsonLd )
          } }
        />
      </head>
      <body>
        <UmamiAnalytics />
        <Suspense>
          <UmamiTracker />
        </Suspense>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <MenuBarSlotProvider>
            <div className="h-[100svh] bg-hover/50">
              <main className="h-full overflow-auto overscroll-contain relative">{children}</main>

              <Suspense>
                <MenuBarGate
                  hasMissingThumbnails={ hasMissingThumbnails }
                  hasMissingPreviews={ hasMissingPreviews }
                />
              </Suspense>
            </div>
          </MenuBarSlotProvider>

          <ServiceWorkerUpdateNotifier />
        </ThemeProvider>
      </body>
    </html>
  );
}
