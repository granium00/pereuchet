import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Онлайн таблица с синхронизацией",
  description: "Ввод и просмотр данных в реальном времени",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <div className="app-shell">
          <header className="app-header">
            <div className="brand">Переучет Онлайн</div>
            <div className="subtitle">Синхронизация в реальном времени</div>
          </header>
          <main className="app-main">{children}</main>
          <footer className="app-footer">
            <span>Railway-ready MVP</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
