/** @type {import('next').NextConfig} */
const nextConfig = {
  // Builds a small self-contained server for the Docker image (see Dockerfile).
  output: "standalone",
};
export default nextConfig;
