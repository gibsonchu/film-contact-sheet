import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // /projects was the library's URL before it became /binder — keep old
  // links and bookmarks working.
  async redirects() {
    return [{ source: "/projects", destination: "/binder", permanent: true }];
  },
};

export default nextConfig;
