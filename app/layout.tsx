import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Faizan-e-deyar-e-Madinah | Mosque Screen Administration", template: "%s | Faizan-e-deyar-e-Madinah" },
  description: "Manage mosque display accounts and administrator access.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
