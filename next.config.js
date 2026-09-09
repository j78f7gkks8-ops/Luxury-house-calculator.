/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  // playwright-core (used server-side only, to render export PDFs) pulls in
  // optional browser/recorder assets that the webpack bundler chokes on -
  // keep it (and the other Node-only export libs) out of the server bundle.
  experimental: {
    serverComponentsExternalPackages: ["playwright-core", "exceljs", "docx"],
  },
};

module.exports = nextConfig;
