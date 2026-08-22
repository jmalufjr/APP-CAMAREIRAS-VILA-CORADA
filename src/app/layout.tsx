import type { Metadata } from "next";
import { Montserrat, Playfair_Display, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/shared/theme-provider";
import "./globals.css";

// Fonte de texto oficial da marca (PRD): Montserrat.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

// "The Seasons" (fonte de títulos da marca) é uma fonte paga, sem arquivo
// disponível no projeto. Playfair Display é usada como substituta visual
// (serifada, alto contraste) até que os arquivos da fonte oficial sejam
// adicionados em src/app/fonts e referenciados aqui via next/font/local.
const seasonsFallback = Playfair_Display({
  variable: "--font-seasons",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vila Corada | Camareiras",
  description: "Gestão do serviço de camareiras da Vila Corada Suítes Beira Mar",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${montserrat.variable} ${seasonsFallback.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          themes={["light", "dark", "dark-blue"]}
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
