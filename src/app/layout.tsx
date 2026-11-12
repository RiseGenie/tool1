import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";

const grotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], weight: ["400", "500", "700"] });
const mono = Space_Mono({ variable: "--font-space-mono", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "RiseGenie | Digital Marketing & Business Growth Solutions",
  description:
    "Grow your business with RiseGenie's GoHighLevel experts. SEO, sales funnels, CRM automation and AI systems that generate leads and increase revenue.",
  metadataBase: new URL("https://risegenie.com"),
  openGraph: { title: "RiseGenie | Digital Marketing & Business Growth Solutions", url: "https://risegenie.com/", siteName: "RiseGenie", type: "website" },
};

export const viewport: Viewport = { themeColor: "#35ed81" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
