import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Film Contact Sheet",
  description:
    "Build, mark up and share photographic contact sheets — film strips, grease pencil, tape and print-ready export.",
  applicationName: "Film Contact Sheet",
  openGraph: {
    title: "Film Contact Sheet",
    description:
      "Build, mark up and share photographic contact sheets — film strips, grease pencil, tape and print-ready export.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-grease focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-noir"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
