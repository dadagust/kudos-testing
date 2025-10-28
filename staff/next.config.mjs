const normalizeBaseUrl = (value) => value.replace(/\/$/, '');

const resolveApiRoot = (value) => {
  const normalized = normalizeBaseUrl(value);
  if (normalized.endsWith('/core')) {
    return normalized.slice(0, -'/core'.length);
  }
  if (normalized.endsWith('/api/v1')) {
    return normalized.slice(0, -'/api/v1'.length);
  }
  return normalized;
};

const DEFAULT_BACKEND_ORIGIN = 'http://localhost:8000';

const detectBackendOrigin = () => {
  const rawValue = process.env.KUDOS_BACKEND_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL;
  if (!rawValue) {
    return DEFAULT_BACKEND_ORIGIN;
  }

  const normalized = normalizeBaseUrl(rawValue);
  const isAbsolute = /^https?:\/\//i.test(normalized);

  if (!isAbsolute) {
    return DEFAULT_BACKEND_ORIGIN;
  }

  return resolveApiRoot(normalized);
};

const backendOrigin = detectBackendOrigin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/core',
        destination: `${backendOrigin}/core`,
      },
      {
        source: '/core/',
        destination: `${backendOrigin}/core/`,
      },
      {
        source: '/core/:path*/',
        destination: `${backendOrigin}/core/:path*/`,
      },
      {
        source: '/core/:path*',
        destination: `${backendOrigin}/core/:path*`,
      },
      {
        source: '/api/v1',
        destination: `${backendOrigin}/api/v1`,
      },
      {
        source: '/api/v1/',
        destination: `${backendOrigin}/api/v1/`,
      },
      {
        source: '/api/v1/:path*/',
        destination: `${backendOrigin}/api/v1/:path*/`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${backendOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
