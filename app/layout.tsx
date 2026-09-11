import type { Metadata } from "next";
import "./globals.css";
import "./product.css";

export const metadata: Metadata = {
  title: "卡彭团队｜女性吸睛 · 私人定制",
  description: "卡彭｜Mr. Capone。面向成年女性的私人定制与一对一咨询。先评估，后承接；守规矩，重隐私，不妄言。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
