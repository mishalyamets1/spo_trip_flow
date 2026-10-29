import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../providers/auth-provider";

export const metadata: Metadata = {
  title: "TripFlow — заявки на командировки",
  description: "Создание и согласование заявок на служебные командировки",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
