import "./p5.css";

import type { Metadata } from "next";
import Script from 'next/script';

export const metadata: Metadata = {
    title: "Social-templates-renderer | p5js",
    description: "Generate social-templates with 5js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
    <body>
        <div id="sketch-ui-drawer"></div>
        <span id="sketch-ui-icon"></span>
        <Script src="/assets/librairies/p5.min.js"/>
        <Script src="/assets/librairies/CCapture.all.min.js"/>
        {children}
    </body>
    </html>
  );
}
