import "./globals.css";
import type {
  Metadata, Viewport
} from "next";
import {
  ThemeProvider
} from "next-themes";

import MenuBar from "@/components/MenuBar";
import {
  Suspense
} from "react";

export const metadata: Metadata = {
  title: "Social-pipeline",
  description: "Generate social-templates with HTML and JavaScript (p5*js)",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout( {
  children
}: {
 children: React.ReactNode
} ) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div
            className="flex flex-col"
            style={ {
              height: "100svh",
            } }
          >
            <Suspense>
              <MenuBar />
            </Suspense>

            <main className="flex-1 overflow-auto relative w-full bg-background-100">
              {children}
            </main>
          </div>
        </ThemeProvider>

      </body>
    </html>
  );
}
