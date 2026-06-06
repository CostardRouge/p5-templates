import Script from "next/script";
import {
  GA_MEASUREMENT_ID, isAnalyticsEnabled
} from "@/lib/analytics/gtag";

export default function GoogleAnalytics() {
  if ( !isAnalyticsEnabled ) {
    return null;
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={ `https://www.googletagmanager.com/gtag/js?id=${ GA_MEASUREMENT_ID }` }
      />

      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={ {
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${ GA_MEASUREMENT_ID }', { send_page_view: false });
          `
        } }
      />
    </>
  );
}
