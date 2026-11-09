import Link from "next/link";
import { ArrowRight, Calculator, FileText, Home } from "lucide-react";

import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Button } from "@/components/ui/button";

// `app/not-found.tsx` renders inside the root layout only (not the (site)
// group), so bring the Navbar/Footer in for consistent branding. Next serves
// this with a 404 status for crawlers, so it's never mistaken for real content.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-7xl font-extrabold tracking-tight text-primary sm:text-8xl">
            404
          </p>
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            Halaman tidak dijumpai
          </h1>
          <p className="mt-3 text-muted-foreground">
            Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan.
            Mungkin pautannya sudah lapuk atau tersilap taip. Cuba salah satu
            daripada pautan di bawah.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/">
                <Home /> Laman Utama
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/#kira">
                <Calculator /> Kira Fidyah
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/blog">
                <FileText /> Baca Blog
              </Link>
            </Button>
          </div>

          <div className="mt-10 border-t border-border/60 pt-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Pautan berguna</p>
            <ul className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2">
              <li>
                <Link
                  href="/#hukum"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  Hukum Fidyah <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </li>
              <li>
                <Link
                  href="/#cara-kira"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  Cara Kira <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </li>
              <li>
                <Link
                  href="/#faq"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  Soalan Lazim <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
