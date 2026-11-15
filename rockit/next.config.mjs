const upstream = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() { return [{ source: "/backend/:path*", destination: `${upstream}/:path*` }]; },
};
export default nextConfig;
