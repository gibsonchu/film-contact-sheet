import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // /projects, then /binder, were the library's URL before it became
  // /sheets — keep old links and bookmarks working. /community became
  // /explore when publishing arrived.
  async redirects() {
    return [
      { source: "/projects", destination: "/sheets", permanent: true },
      { source: "/binder", destination: "/sheets", permanent: true },
      { source: "/community", destination: "/explore", permanent: true },
    ];
  },
};

export default nextConfig;
