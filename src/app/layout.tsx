import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import Banner from "@/components/Banner";
import HeaderButtons from "@/components/HeaderButtons";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
    title: "七零十 -- 挑战测评10000款零食",
    description: "零食评测记录 - 挑战测评10000款零食，发现你的下一口美味",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // The chosen theme is stored in a cookie so the server can render the
    // right mode directly — no scripts, no flash. Without a cookie the
    // data-theme attribute is omitted and CSS falls back to the system setting.
    const cookieStore = await cookies();
    const saved = cookieStore.get('llq-theme')?.value;
    const theme = saved === 'dark' || saved === 'light' ? saved : undefined;

    return (
        <html lang="zh-CN" className="h-full antialiased" data-theme={theme} suppressHydrationWarning>
            <body className="min-h-full flex flex-col bg-gray-50">
                <div className="relative">
                    <Banner />
                    <HeaderButtons />
                </div>
                <main className="flex-1">
                    {children}
                </main>
                <Footer />
            </body>
        </html>
    );
}
