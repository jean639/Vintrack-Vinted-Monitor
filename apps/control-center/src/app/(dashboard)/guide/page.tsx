import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    LayoutDashboard,
    Globe,
    PlusCircle,
    Search,
    Bell,
    Zap,
    Heart,
    ExternalLink,
    Settings,
    Link as LinkIcon,
    CheckCircle2,
    Info,
    MessageSquare,
    Tag,
    Sparkles,
    Smartphone,
    User,
    Download,
} from "lucide-react";
import Link from "next/link";

const CHROME_EXTENSION_DOWNLOAD_URL =
    "https://github.com/JakobAIOdev/Vintrack-Vinted-Monitor/releases/latest/download/vintrack-browser-sync-extension.zip";
const FIREFOX_EXTENSION_DOWNLOAD_URL =
    "https://github.com/JakobAIOdev/Vintrack-Vinted-Monitor/releases/latest/download/vintrack-browser-sync-extension-firefox.xpi";

export default function GuidePage() {
    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div className="border-border flex flex-col gap-4 border-b pb-10">
                <div className="flex items-center gap-2 text-sm font-bold tracking-wide text-blue-600 uppercase dark:text-blue-400">
                    <Sparkles className="h-4 w-4" />
                    Documentation
                </div>
                <h1 className="text-foreground text-4xl font-extrabold tracking-tight">
                    Getting Started with Vintrack
                </h1>
                <p className="text-muted-foreground max-w-3xl text-[17px] leading-relaxed">
                    Set up proxies, monitors, alerts, and the browser extension
                    for linked Vinted actions.
                </p>
            </div>

            <div className="space-y-16">
                <section className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700 shadow-sm dark:bg-emerald-500/20 dark:text-emerald-400">
                            1
                        </div>
                        <h2 className="text-foreground text-2xl font-bold">
                            Configuring Proxies (IPv4 & IPv6)
                        </h2>
                    </div>

                    <Card className="overflow-hidden shadow-sm">
                        <CardContent className="space-y-8 p-8">
                            <div className="grid gap-12 md:grid-cols-2">
                                <div className="space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="shrink-0 rounded-xl bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                                            <Globe className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-foreground text-lg font-bold">
                                            The Basics
                                        </h3>
                                    </div>
                                    <p className="text-muted-foreground text-[15px] leading-relaxed">
                                        Vinted has strict limits on requests
                                        from a single IP. Proxies rotate traffic
                                        through multiple identities to keep
                                        monitoring stable.
                                    </p>
                                    <div className="space-y-3 pt-2">
                                        <div className="text-muted-foreground flex items-start gap-3 text-[14px]">
                                            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
                                            <span>
                                                <strong>IPv4 Support:</strong>{" "}
                                                Stable and universal.
                                            </span>
                                        </div>
                                        <div className="text-muted-foreground flex items-start gap-3 text-[14px]">
                                            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
                                            <span>
                                                <strong>IPv6 Support:</strong>{" "}
                                                Fast and cost-efficient.
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-muted/50 border-border/50 space-y-5 rounded-2xl border p-6">
                                    <h3 className="text-md text-foreground flex items-center gap-2 font-bold">
                                        <Settings className="text-muted-foreground h-5 w-5" />
                                        How to Setup
                                    </h3>
                                    <ol className="text-muted-foreground list-decimal space-y-4 pl-5 text-[15px]">
                                        <li>
                                            Go to{" "}
                                            <Link
                                                href="/proxies"
                                                className="font-bold text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
                                            >
                                                Proxy Groups
                                            </Link>
                                            .
                                        </li>
                                        <li>
                                            Click <strong>New Group</strong> and
                                            give it a name.
                                        </li>
                                        <li>
                                            Paste your proxies in the format:
                                            <br />
                                            <code className="bg-background border-border mt-2 inline-block rounded border px-2 py-1 font-mono text-xs text-emerald-700 dark:text-emerald-400">
                                                ip:port:user:pass
                                            </code>
                                        </li>
                                        <li>
                                            Vintrack automatically detects both
                                            formats.
                                        </li>
                                    </ol>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <section className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700 shadow-sm dark:bg-blue-500/20 dark:text-blue-400">
                            2
                        </div>
                        <h2 className="text-foreground text-2xl font-bold">
                            Setting Up Monitors
                        </h2>
                    </div>

                    <Card className="overflow-hidden shadow-sm">
                        <CardContent className="space-y-8 p-8">
                            <div className="grid gap-12 md:grid-cols-2">
                                <div className="space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="shrink-0 rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                                            <LayoutDashboard className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-foreground text-lg font-bold">
                                            Create Search Tasks
                                        </h3>
                                    </div>
                                    <p className="text-muted-foreground text-[15px] leading-relaxed">
                                        A monitor is your personal search agent.
                                        Define exactly what you want to find,
                                        and Vintrack will notify you the moment
                                        it hits Vinted.
                                    </p>
                                    <div className="space-y-3 pt-2">
                                        <div className="text-muted-foreground flex items-start gap-3 text-[14px]">
                                            <Search className="mt-1 h-4 w-4 shrink-0 text-blue-500" />
                                            <span>
                                                <strong>Queries:</strong> Use
                                                specific keywords for better
                                                results.
                                            </span>
                                        </div>
                                        <div className="text-muted-foreground flex items-start gap-3 text-[14px]">
                                            <Zap className="mt-1 h-4 w-4 shrink-0 text-amber-500" />
                                            <span>
                                                <strong>Filters:</strong> Set
                                                price, brand, and size limits.
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-muted/50 border-border/50 space-y-5 rounded-2xl border p-6">
                                    <h3 className="text-md text-foreground flex items-center gap-2 font-bold">
                                        <PlusCircle className="text-muted-foreground h-5 w-5" />
                                        How to Setup
                                    </h3>
                                    <ol className="text-muted-foreground list-decimal space-y-4 pl-5 text-[15px]">
                                        <li>
                                            Go to{" "}
                                            <Link
                                                href="/monitors/new"
                                                className="font-bold text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
                                            >
                                                New Monitor
                                            </Link>
                                            .
                                        </li>
                                        <li>
                                            Enter your <strong>Keywords</strong>
                                            , for example Stone Island.
                                        </li>
                                        <li>
                                            Select the <strong>Region</strong>{" "}
                                            (e.g., FR, UK, DE).
                                        </li>
                                        <li>
                                            Assign your{" "}
                                            <strong>Proxy Group</strong> and
                                            save.
                                        </li>
                                    </ol>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <section className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-100 text-lg font-bold text-purple-700 shadow-sm dark:bg-purple-500/20 dark:text-purple-400">
                            3
                        </div>
                        <h2 className="text-foreground text-2xl font-bold">
                            Discord and Telegram Notifications
                        </h2>
                    </div>

                    <Card className="overflow-hidden shadow-sm">
                        <CardContent className="space-y-8 p-8">
                            <div className="grid gap-12 md:grid-cols-2">
                                <div className="space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="shrink-0 rounded-xl bg-purple-50 p-2.5 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
                                            <Bell className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-foreground text-lg font-bold">
                                            Stay Alert
                                        </h3>
                                    </div>
                                    <p className="text-muted-foreground text-[15px] leading-relaxed">
                                        Use Discord webhooks or connect the
                                        Vintrack Telegram bot to receive instant
                                        item cards.
                                    </p>
                                    <div className="flex items-center gap-3 rounded-xl border border-purple-100 bg-purple-50 p-4 dark:border-purple-500/20 dark:bg-purple-500/10">
                                        <Smartphone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                        <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                                            Perfect for push notifications on
                                            your phone!
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-muted/50 border-border/50 space-y-5 rounded-2xl border p-6">
                                    <h3 className="text-md text-foreground flex items-center gap-2 font-bold">
                                        <LinkIcon className="text-muted-foreground h-5 w-5" />
                                        How to Setup
                                    </h3>
                                    <ol className="text-muted-foreground list-decimal space-y-4 pl-5 text-[15px]">
                                        <li>
                                            In Discord:{" "}
                                            <strong>Channel Settings</strong>{" "}
                                            &gt; <strong>Integrations</strong>.
                                        </li>
                                        <li>
                                            Click{" "}
                                            <strong>Create Webhook</strong> and
                                            copy the URL.
                                        </li>
                                        <li>
                                            Paste the URL into your monitor
                                            notification settings.
                                        </li>
                                        <li>
                                            For Telegram: open the monitor
                                            notification dialog and click{" "}
                                            <strong>Connect Telegram</strong>.
                                        </li>
                                        <li>
                                            Send the generated code to the bot,
                                            then enable Telegram for the
                                            monitor.
                                        </li>
                                    </ol>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <section className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-lg font-bold text-amber-700 shadow-sm dark:bg-amber-500/20 dark:text-amber-400">
                            4
                        </div>
                        <h2 className="text-foreground text-2xl font-bold">
                            Vinted Account Integration
                        </h2>
                    </div>

                    <Card className="overflow-hidden shadow-sm">
                        <CardContent className="space-y-8 p-8">
                            <div className="grid gap-12 md:grid-cols-2">
                                <div className="space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="shrink-0 rounded-xl bg-amber-50 p-2.5 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                                            <User className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-foreground text-lg font-bold">
                                            Account Actions
                                        </h3>
                                    </div>
                                    <p className="text-muted-foreground text-[15px] leading-relaxed">
                                        Link your Vinted account with the
                                        Vintrack extension. It keeps the browser
                                        session fresh without making you copy
                                        tokens manually.
                                    </p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-card border-border space-y-2 rounded-xl border p-3 text-center shadow-sm">
                                            <Heart className="mx-auto h-4 w-4 fill-red-500 text-red-500" />
                                            <span className="text-foreground block text-[11px] font-bold">
                                                Like
                                            </span>
                                        </div>
                                        <div className="bg-card border-border space-y-2 rounded-xl border p-3 text-center shadow-sm">
                                            <MessageSquare className="mx-auto h-4 w-4 text-blue-500" />
                                            <span className="text-foreground block text-[11px] font-bold">
                                                Message
                                            </span>
                                        </div>
                                        <div className="bg-card border-border space-y-2 rounded-xl border p-3 text-center shadow-sm">
                                            <Tag className="mx-auto h-4 w-4 text-emerald-500" />
                                            <span className="text-foreground block text-[11px] font-bold">
                                                Offer
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-muted-foreground text-[13px] leading-relaxed">
                                        The extension syncs only the Vinted
                                        session tokens, domain, browser user
                                        agent, and Vintrack theme. It does not
                                        send a full cookie header.
                                    </p>
                                </div>
                                <div className="bg-muted/50 border-border/50 space-y-5 rounded-2xl border p-6">
                                    <h3 className="text-md text-foreground flex items-center gap-2 font-bold">
                                        <Settings className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                        How to Setup
                                    </h3>
                                    <ol className="text-muted-foreground list-decimal space-y-4 pl-5 text-[15px]">
                                        <li>
                                            Download the Vintrack extension for
                                            Chrome or Firefox.
                                        </li>
                                        <li>
                                            Chrome: unzip the package, open{" "}
                                            <strong>chrome://extensions</strong>
                                            , enable{" "}
                                            <strong>Developer mode</strong>,
                                            then click{" "}
                                            <strong>Load unpacked</strong>.
                                        </li>
                                        <li>
                                            Firefox: install the signed XPI, or
                                            use <strong>about:debugging</strong>{" "}
                                            for a temporary development install.
                                        </li>
                                        <li>
                                            Sign in to Vinted in the same
                                            browser.
                                        </li>
                                        <li>
                                            Go to{" "}
                                            <Link
                                                href="/account"
                                                className="font-bold text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
                                            >
                                                Account
                                            </Link>{" "}
                                            and click{" "}
                                            <strong>
                                                Link With Installed Extension
                                            </strong>
                                            .
                                        </li>
                                    </ol>
                                    <div className="grid gap-2 pt-1 sm:grid-cols-2">
                                        <Button
                                            asChild
                                            variant="outline"
                                            size="sm"
                                            className="justify-start gap-2 border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
                                        >
                                            <a
                                                href={
                                                    CHROME_EXTENSION_DOWNLOAD_URL
                                                }
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                                Chrome Extension
                                            </a>
                                        </Button>
                                        <Button
                                            asChild
                                            variant="outline"
                                            size="sm"
                                            className="justify-start gap-2 border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
                                        >
                                            <a
                                                href={
                                                    FIREFOX_EXTENSION_DOWNLOAD_URL
                                                }
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                                Firefox Extension
                                            </a>
                                        </Button>
                                        <Button
                                            asChild
                                            size="sm"
                                            className="justify-start gap-2 sm:col-span-2"
                                        >
                                            <Link href="/account">
                                                <LinkIcon className="h-3.5 w-3.5" />
                                                Connect on Account page
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </div>

            <div className="flex flex-col items-center gap-8 rounded-[2rem] bg-slate-900 p-10 shadow-xl md:flex-row">
                <div className="bg-background/10 rounded-2xl border border-white/10 p-5 backdrop-blur-sm">
                    <Info className="h-9 w-9 text-blue-400" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white">
                        Still have questions?
                    </h3>
                    <p className="text-[15px] text-slate-400">
                        Check out our community or visit the GitHub repository
                        for technical support, feature requests, and updates.
                    </p>
                </div>
                <a
                    href="https://github.com/JakobAIOdev/Vintrack-Vinted-Monitor"
                    target="_blank"
                    className="bg-background text-foreground hover:bg-muted ml-auto flex items-center gap-2.5 rounded-2xl px-8 py-3.5 font-bold shadow-lg transition-all active:scale-95"
                >
                    View GitHub <ExternalLink className="h-5 w-5" />
                </a>
            </div>
        </div>
    );
}
