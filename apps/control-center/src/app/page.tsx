import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Shield, Radio } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <nav className="flex items-center justify-between border-b border-border/70 px-8 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <span className="text-xs font-bold">V</span>
          </div>
          <span className="font-semibold text-[15px] tracking-tight">
            Vintrack
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <Link href="/login">
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-24">
        <div className="text-center max-w-2xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/75 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            <Zap className="w-3 h-3" /> High-Performance Monitoring
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
            Find deals
            <br />
            <span className="text-muted-foreground">before anyone else</span>
          </h1>

          <p className="mx-auto max-w-md text-lg leading-relaxed text-muted-foreground">
            The fastest Vinted monitor for resellers. Real-time alerts,
            multi-region scraping, and instant Discord notifications.
          </p>

          <div className="flex gap-3 justify-center pt-2">
            <Link href="/login">
              <Button size="lg" className="gap-2">
                Get Started <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-20">
          <div className="space-y-2 rounded-2xl border border-border/75 bg-card/80 p-6 text-center shadow-sm backdrop-blur">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              Sub-Second Speed
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Optimized Go worker with proxy rotation and Cloudflare bypass.
            </p>
          </div>
          <div className="space-y-2 rounded-2xl border border-border/75 bg-card/80 p-6 text-center shadow-sm backdrop-blur">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <Radio className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              Real-Time Feed
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Instant SSE updates. See items the moment they&apos;re listed.
            </p>
          </div>
          <div className="space-y-2 rounded-2xl border border-border/75 bg-card/80 p-6 text-center shadow-sm backdrop-blur">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              Discord Alerts
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Webhook notifications with seller ratings and region data.
            </p>
          </div>
        </div>
      </div>

      <footer className="border-t border-border/70 px-8 py-6 text-center text-xs text-muted-foreground">
        Vintrack &mdash; Built for speed.
      </footer>
    </div>
  );
}
