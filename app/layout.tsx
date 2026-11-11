import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "JVerse AI", description: "The intelligent workspace." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

