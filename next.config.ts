import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // @react-pdf/renderer needs real node_modules (fonts, yoga wasm) — keep it out of the RSC bundle.
  serverExternalPackages: ["@react-pdf/renderer"],
}

export default nextConfig
