import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

/* Archivo es variable en anchura: la cabecera va en ancho expandido, como el
   grabado de una placa de datos de equipo. Plex Sans y Plex Mono vienen del
   mismo taller tipografico y comparten metricas, que es lo que permite alinear
   una cita monoespaciada contra prosa sin que se pelee. */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Engineering Copilot · Pfannenberg",
  description:
    "Del correo desordenado al brief PSS-ready. Cada dato con la frase que lo respalda, cada descarte con su pagina de catalogo.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body
        className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
