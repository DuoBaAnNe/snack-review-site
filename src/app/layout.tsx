import type { Metadata } from "next";
import "./globals.css";
import Banner from "@/components/Banner";
import HeaderButtons from "@/components/HeaderButtons";
import Footer from "@/components/Footer";
import BackToTopButton from "@/components/BackToTopButton";

export const metadata: Metadata = {
    title: "七零十 -- 挑战测评10000款零食",
    description: "零食评测记录 - 挑战测评10000款零食，发现你的下一口美味",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-CN" className="h-full antialiased">
            <body className="min-h-full flex flex-col bg-gray-50">
                <header className="sticky top-0 z-50 flex items-center justify-between gap-3 pl-12 pr-3 md:pr-5 h-14 bg-white/90 backdrop-blur-md border-b border-gray-200/70">
                    <Banner />
                    <HeaderButtons />
                </header>
                <main className="flex-1">
                    {children}
                </main>
                <Footer />
                <BackToTopButton />
            </body>
        </html>
    );
}
