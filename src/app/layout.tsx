import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Banner from "@/components/Banner";
import UserStatus from "@/components/UserStatus";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "零食奇计划 -- 挑战测评10000款零食",
    description: "零食评测记录 - 挑战测评10000款零食，发现你的下一口美味",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="zh-CN"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
            <body className="min-h-full flex flex-col bg-gray-50">
                <div className="relative">
                    <Banner />
                    <UserStatus />
                </div>
                <main className="flex-1">
                    {children}
                </main>
            </body>
        </html>
    );
}
