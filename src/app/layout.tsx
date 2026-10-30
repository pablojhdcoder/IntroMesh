import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ThemeProvider } from "@/components/theme-switch";
import { readTheme } from "@/lib/theme-server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "IntroMesh",
  description: "In-person networking. Discover, understand, and connect.",
};

const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )intromesh-theme=(light|dark)(?:;|$)/);var dark=m&&m[1]==="dark";document.documentElement.classList.toggle("dark",Boolean(dark));}catch(e){}})();`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await readTheme();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}${theme === "dark" ? " dark" : ""} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Script id="intromesh-theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
