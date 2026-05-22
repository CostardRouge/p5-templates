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
import GoogleAnalytics from "@/components/GoogleAnalytics";
import MenuBar from "@/components/MenuBar";
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

const baseUrl = getBaseUrl();

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
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link
          rel="preconnect"
          href="https://www.googletagmanager.com"
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={ {
            __html: JSON.stringify( jsonLd )
          } }
        />
      </head>
      <body>
        <GoogleAnalytics />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="h-[100svh] bg-hover/50">
            <main className="h-full overflow-auto overscroll-contain relative">{children}</main>

            <Suspense>
              <MenuBar
                showRecordings={ process.env.BACKEND_RECORDING === "true" }
                hasMissingThumbnails={ hasMissingThumbnails }
                hasMissingPreviews={ hasMissingPreviews }
              />
            </Suspense>
          </div>

          <ServiceWorkerUpdateNotifier />
        </ThemeProvider>
      </body>
    </html>
  );
}
