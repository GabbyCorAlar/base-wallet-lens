/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // WalletConnect ships optional native deps that have no browser equivalent.
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
};

export default nextConfig;
