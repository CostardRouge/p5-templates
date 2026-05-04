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
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME
} from "@/lib/seo";
import {
  getDevThumbnailStatus
} from "@/utils/getDevThumbnailStatus";

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
      name: "Steeve Pommier"
    }
  ],
  creator: "Steeve Pommier",
  publisher: "Steeve Pommier",
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
    locale: "en_US",
    url: baseUrl,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/assets/images/icon-512x512.png",
        width: 512,
        height: 512,
        alt: `${ SITE_NAME } - Create social media videos from code templates`
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [
      "/assets/images/icon-512x512.png"
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
    icon: "/icon.png",
    apple: "/assets/images/icon-192x192.png"
  },
  category: "technology"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: "#ffffff"
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: "#000000"
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
          dangerouslySetInnerHTML={{
            __html: JSON.stringify( jsonLd )
          }}
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
          <div className="flex flex-col h-[100svh] bg-hover/50">
            <main className="flex-1 overflow-auto relative">{children}</main>

            <Suspense>
              <MenuBar
                showRecordings={process.env.BACKEND_RECORDING === "true"}
                hasMissingThumbnails={hasMissingThumbnails}
              />
            </Suspense>
          </div>

          <ServiceWorkerUpdateNotifier />
        </ThemeProvider>
      </body>
    </html>
  );
}
