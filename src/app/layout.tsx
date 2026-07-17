import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "จาเหมง รายรับรายจ่าย",
  description: "บันทึกรายรับ-รายจ่ายผ่าน LINE ด้วยภาษาธรรมชาติ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The UI is Thai throughout; `lang` drives font fallback and line breaking.
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
