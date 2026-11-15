import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";
import { AppDataProvider } from "@/components/AppData";
import Footer from "@/components/Footer";
import TopBar from "@/components/TopBar";

export const metadata: Metadata = {
  title: "RockIT: Earth trend detective",
  description:
    "Explore 24 years of land-surface change in 21 regions, from NASA GLDAS model estimates: trends with uncertainty, region comparisons and Earth Twins.",
};

export const viewport: Viewport = {
  themeColor: "#04070d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppDataProvider>
          <div className="flex min-h-screen flex-col">
            <TopBar />
            {children}
            <Footer />
          </div>
        </AppDataProvider>
      </body>
    </html>
  );
}
