import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social-templates-renderer",
  description: "Generate social-templates with html and javascript",
};

export default async function RootLayout({
    children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
