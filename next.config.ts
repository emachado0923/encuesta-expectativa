import type { NextConfig } from 'next'

const enDesarrollo = process.env.NODE_ENV !== 'production'

// Todo sale del mismo sitio; solo el sitio de Sapiencia puede incrustar la encuesta.
// Los scripts en línea los pone Next.js para arrancar la página: se reemplazarán
// por un nonce cuando se migre la interfaz (ver el README).
const politicaDeContenido = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${enDesarrollo ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self' https://sapiencia.gov.co https://*.sapiencia.gov.co",
].join('; ')

const nextConfig: NextConfig = {
  // Un servidor de Node autónomo en .next/standalone, para la máquina virtual.
  output: 'standalone',
  poweredByHeader: false,
  // El controlador de MySQL se usa tal cual desde node_modules, sin empaquetar.
  serverExternalPackages: ['mysql2'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: politicaDeContenido },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/fonts/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

export default nextConfig
