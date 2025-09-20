import "./globals.css";
import type {
  Metadata
} from "next";
import MenuBar from "@/components/MenuBar";

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
          className="flex flex-col bg-gray-900 text-gray-100"
          style={ {
            height: "100svh",
          } }
        >
          <main className="flex-1 overflow-auto p-2 relative w-full">
            {children}
          </main>

          <MenuBar />
        </div>
      </body>
    </html>
  );
}
