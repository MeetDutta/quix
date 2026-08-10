import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers/Providers";

export const metadata: Metadata = {
  title: "EduQuizX - AI Dynamic Examination & Student Management System",
  description: "EduQuizX Enterprise SaaS Examination platform for schools, colleges, and corporations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#FAF7F2] text-[#1C1917] antialiased min-h-screen selection:bg-amber-800/20 selection:text-amber-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
