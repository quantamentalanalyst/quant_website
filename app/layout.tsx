import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import StatusBar from "@/components/site/StatusBar";
import Nav from "@/components/site/Nav";
import Footer from "@/components/site/Footer";
import { site } from "@/lib/site";
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${site.name} · ${site.role}`,
    template: `%s · ${site.name}`,
  },
  description: site.roleLong,
  metadataBase: new URL("https://example.com"), // EDIT when domain is known
  openGraph: {
    title: `${site.name} · ${site.role}`,
    description: site.roleLong,
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${mono.variable} ${serif.variable}`}
      suppressHydrationWarning
    >
      {/*
        Easter-egg signature for the curious view-source reader.
        Hidden route lives at /terminal — see Process step 7.
      */}
      <head>
        {/* prettier-ignore */}
        <meta name="x-signature" content="    __                        __                                __        __
   / /_  __  ______ _____  ____ / /_____ _____ ___  ___  ____  / /_____ _/ /
  / __ \/ / / / __ `/ __ \/ __ `/ __/ __ `/ __ `__ \/ _ \/ __ \/ __/ __ `/ /
 / / / / /_/ / /_/ / / / / /_/ / /_/ /_/ / / / / / /  __/ / / / /_/ /_/ / /
/_/ /_/\__,_/\__,_/_/ /_/\__,_/\__/\__,_/_/ /_/ /_/\___/_/ /_/\__/\__,_/_/
                                                              /terminal" />
      </head>
      <body className="flex min-h-screen flex-col bg-bg text-text">
        <StatusBar />
        <Nav />
        <main className="mx-auto w-full max-w-[1408px] flex-1 px-6 py-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
