import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "SQL Builder Planner",
  description: "ChatGPT destekli report planlama"
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
