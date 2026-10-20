/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL;
    // If running on Vercel and no internal backend proxy URL is configured,
    // do not rewrite /api to an unresolvable 127.0.0.1:8000.
    if (process.env.VERCEL && !backendUrl) {
      return [];
    }
    const targetUrl = backendUrl || 'http://127.0.0.1:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${targetUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
