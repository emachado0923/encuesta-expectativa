/**
 * Íconos de trazo en SVG, escritos aquí para no cargar la fuente Material
 * Symbols del kit (450 KB) por una docena de íconos.
 */

import type { ReactNode } from 'react'

const TRAZOS = {
  'flecha-der': <path d="M5 12h14M13 6l6 6-6 6" />,
  'flecha-izq': <path d="M19 12H5M11 6l-6 6 6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  lista: (
    <>
      <path d="M9.5 6H20M9.5 12H20M9.5 18H20" />
      <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth={3} />
    </>
  ),
  candado: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  enviar: (
    <>
      <path d="M21 3L10.5 13.5" />
      <path d="M21 3l-6.5 18-4-7.5L3 9.5 21 3z" />
    </>
  ),
  listo: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.8 2.8L16.5 9.5" />
    </>
  ),
  alerta: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </>
  ),
  recargar: (
    <>
      <path d="M20 12a8 8 0 1 1-2.35-5.65" />
      <path d="M20 4.5v5h-5" />
    </>
  ),
  externo: (
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type NombreIcono = keyof typeof TRAZOS

export function Icono({ nombre, clase = '' }: { nombre: NombreIcono; clase?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`icono ${clase}`.trim()}
    >
      {TRAZOS[nombre]}
    </svg>
  )
}
