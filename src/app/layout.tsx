import type { Metadata, Viewport } from 'next'
import Image from 'next/image'
import { preload } from 'react-dom'

import './globals.css'

export const metadata: Metadata = {
  title: 'Encuesta de expectativas · Sapiencia',
  description: 'Encuesta de expectativas de estudiantes de grado 11 de Medellín.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#9b48a4',
}

/** Cabecera y pie institucionales de la plantilla Sapiencia, alrededor de cada vista. */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // La tipografía de casi todo el texto: se pide antes que el CSS para que no parpadee.
  preload('/fonts/Rubik-latin-normal.woff2', { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' })

  return (
    <html lang="es-CO">
      <body>
        <a className="saltar" href="#contenido">
          Saltar al contenido
        </a>

        <header className="cabecera">
          <div className="cabecera__logo">
            <Image
              src="/logo-observatorio.png"
              alt="Observatorio de Sapiencia"
              width={600}
              height={177}
              loading="eager"
              unoptimized
            />
          </div>
          <div className="cabecera__franja" />
          <div className="cabecera__barra">
            <p className="cabecera__nombre">Encuesta de expectativas</p>
          </div>
        </header>

        <main id="contenido" className="principal" tabIndex={-1}>
          {children}
        </main>

        {/* La pata en blanco de Sapiencia y la Alcaldía de Medellín, en un arco morado */}
        <footer className="pie">
          <div className="pie__arco">
            <Image
              className="pie__pata"
              src="/logo-sapiencia-alcaldia.png"
              alt="Sapiencia, Agencia de Educación Postsecundaria de Medellín · Alcaldía de Medellín"
              width={720}
              height={255}
              // En las vistas cortas el pie se ve apenas abre la página.
              loading="eager"
              unoptimized
            />
          </div>
        </footer>
      </body>
    </html>
  )
}
