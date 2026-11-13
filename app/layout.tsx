import type { Metadata } from "next";
import { AppProviders } from "../components/app-providers";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = { title: "JVerse AI", description: "The intelligent workspace." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AppProviders>{children}</AppProviders></body></html>;
}

