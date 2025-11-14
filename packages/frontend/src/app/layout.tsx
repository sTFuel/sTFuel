import type { Metadata, Viewport } from "next";
import { ClientProviders } from '@/providers/ClientProviders';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import FloatingActionButton from '@/components/FloatingActionButton';
import MobileNavBar from '@/components/MobileNavBar';
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://stfuel.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "sTFuel - Liquid Staking for TFuel",
  description: "The Liquid Staking Solution for TFuel. Instantly mint sTFuel by staking your TFuel, earning rewards while maintaining liquidity in the Theta ecosystem.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  openGraph: {
    title: "sTFuel - Liquid Staking for TFuel",
    description: "The Liquid Staking Solution for TFuel. Instantly mint sTFuel by staking your TFuel, earning rewards while maintaining liquidity in the Theta ecosystem.",
    type: "website",
    images: [
      {
        url: "/sTFuel_Logo_Transparent.png",
        width: 512,
        height: 512,
        alt: "sTFuel Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "sTFuel - Liquid Staking for TFuel",
    description: "The Liquid Staking Solution for TFuel. Instantly mint sTFuel by staking your TFuel, earning rewards while maintaining liquidity in the Theta ecosystem.",
    images: ["/sTFuel_Logo_Transparent.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4D5BFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-display bg-background-dark text-white">
        <ClientProviders>
          <div className="relative flex min-h-screen w-full flex-col">
            <div className="layout-container flex h-full grow flex-col items-center">
              <div className="w-full max-w-5xl px-4 sm:px-6 lg:px-8">
                <Header />
              </div>
              <main className="w-full max-w-5xl flex-1 px-4 py-8 pb-20 sm:px-6 lg:px-8 md:pb-8">
                {children}
              </main>
              <Footer />
            </div>
            <FloatingActionButton />
          </div>
          <MobileNavBar />
        </ClientProviders>
      </body>
    </html>
  );
}
