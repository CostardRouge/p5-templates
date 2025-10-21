import "./globals.css";
import type {
  Metadata, Viewport
} from "next";

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
    <html lang="en">
      <body>
        <div
          className="flex flex-col bg-gray-900 text-gray-100"
          style={ {
            height: "100svh",
          } }
        >
          {/* <MenuBar />*/}

          <main className="flex-1 overflow-auto p-2 relative w-full">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
