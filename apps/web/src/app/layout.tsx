import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { ChatProvider } from "@/features/chat/context/chat-provider";
import { PageContextProvider } from "@/features/chat/context/page-context-provider";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Nasty Plot",
  description: "Competitive Pokemon team builder for Scarlet/Violet",
  icons: {
    icon: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1025.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <Providers>
          <ChatProvider>
            <PageContextProvider>
              <AppShell>{children}</AppShell>
            </PageContextProvider>
          </ChatProvider>
        </Providers>
      </body>
    </html>
  );
}
