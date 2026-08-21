import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://filmcontactsheets.com"),
  title: "Film Contact Sheet",
  description:
    "Build, mark up and share photographic contact sheets — film strips, grease pencil, tape and print-ready export.",
  applicationName: "Film Contact Sheet",
  openGraph: {
    title: "Film Contact Sheet",
    description:
      "Build, mark up and share photographic contact sheets — film strips, grease pencil, tape and print-ready export.",
    type: "website",
    url: "https://filmcontactsheets.com",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Runs before anything paints, so a saved "light" preference never
          shows a flash of the dark theme first. Dark needs no script — it's
          what the CSS already assumes with no data-theme attribute at all.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('fcs-theme')==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full antialiased">
        <a
          href="#main"
          // bg-grease and text-black are both fixed, not theme tokens — the skip
          // link needs to stay legible before the theme is even known.
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-grease focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-black"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
