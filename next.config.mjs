/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // WalletConnect ships optional native deps that have no browser equivalent.
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    // wagmi's Base Account connector pulls in @coinbase/cdp-sdk, which statically
    // imports the optional @x402/* payment packages. They aren't installed and
    // this app never touches x402 payments, so resolve them to empty modules
    // rather than letting webpack fail the build.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@x402/core': false,
      '@x402/core/client': false,
      '@x402/evm': false,
      '@x402/evm/exact/client': false,
      '@x402/evm/upto/client': false,
      '@x402/svm': false,
      '@x402/svm/exact/client': false,
    };

    return config;
  },
};

export default nextConfig;
