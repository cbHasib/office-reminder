import "./globals.css";
import type { Metadata } from "next";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Office Reminder",
  description: "Time-based reminders that pop up on your team's screens.",
};

// Inline script: applies theme before paint to avoid FOUC.
const setInitialTheme = `
(function(){try{
  var t = localStorage.getItem('or.theme') || 'system';
  document.documentElement.classList.remove('light','dark','system');
  document.documentElement.classList.add(t);
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="system" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: setInitialTheme }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
