import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import '@fontsource-variable/manrope';
import '@daypicker/react/style.css';
import '../styles/global.css';
import '../styles/demo.css';
import '../styles/dashboard.css';
import '../styles/directory.css';
import '../styles/profile.css';
import '../styles/case-detail.css';
import '../styles/operations.css';
import '../styles/admin.css';
import '../styles/login.css';
import '../styles/account.css';
import '../styles/admin-center.css';
export const metadata: Metadata = {
  title: "Bufete Popular UMG · Petén",
  description: "Gestión interna del Bufete Popular UMG, sede Petén.",
  robots: { index: false, follow: false },
  icons: { icon: "/umg.png", apple: "/umg.png" },
};
export const viewport: Viewport = { themeColor: "#01274f" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="es-GT"><body><Providers>{children}</Providers></body></html>;
}
