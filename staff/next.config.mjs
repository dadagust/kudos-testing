import * as sass from 'sass';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  sassOptions: {
    implementation: sass,
  },
};
export default nextConfig;
