import "./globals.css";
import type {
  Metadata
} from "next";
import {
  Sidebar
} from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Social-pipeline",
  description: "Generate social-templates with HTML and JavaScript (p5*js)",
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
          className="flex bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
          style={ {
            height: "100svh",
          } }
        >
          <Sidebar />

          <main className="flex-1 overflow-auto p-6 relative">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
