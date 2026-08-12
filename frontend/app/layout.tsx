import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var m = localStorage.getItem('theme_mode') || localStorage.getItem('theme');
                  var isDark = false;
                  if (m === 'dark') {
                    isDark = true;
                  } else if (m === 'system') {
                    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  } else {
                    isDark = false;
                  }
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen selection:bg-amber-800/20 selection:text-amber-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
