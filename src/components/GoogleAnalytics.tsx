import Script from "next/script";

const GA_MEASUREMENT_ID = "G-CXPSS8NM77";

export default function GoogleAnalytics() {
  if ( process.env.NODE_ENV !== "production" ) {
    return null;
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${ GA_MEASUREMENT_ID }`}
      />

      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${ GA_MEASUREMENT_ID }');
          `,
        }}
      />
    </>
  );
}
