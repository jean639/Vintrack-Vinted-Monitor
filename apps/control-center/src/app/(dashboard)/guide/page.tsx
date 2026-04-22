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
        <div className="space-y-6 mx-auto max-w-4xl">
            <div className="flex flex-col gap-4 border-b border-border pb-10">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm tracking-wide uppercase">
                    <Sparkles className="w-4 h-4" />
                    Documentation
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
                    Getting Started with Vintrack
                </h1>
                <p className="text-muted-foreground text-[17px] max-w-3xl leading-relaxed">
                    Set up proxies, monitors, alerts, and the browser extension
                    for linked Vinted actions.
                </p>
            </div>

            <div className="space-y-16">
                <section className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold shadow-sm text-lg">
                            1
                        </div>
                        <h2 className="text-2xl font-bold text-foreground">
                            Configuring Proxies (IPv4 & IPv6)
                        </h2>
                    </div>

                    <Card className="shadow-sm overflow-hidden">
                        <CardContent className="p-8 space-y-8">
                            <div className="grid md:grid-cols-2 gap-12">
                                <div className="space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                                            <Globe className="w-6 h-6" />
                                        </div>
                                        <h3 className="text-lg font-bold text-foreground">
                                            The Basics
                                        </h3>
                                    </div>
                                    <p className="text-[15px] text-muted-foreground leading-relaxed">
                                        Vinted has strict limits on requests
                                        from a single IP. Proxies rotate traffic
                                        through multiple identities to keep
                                        monitoring stable.
                                    </p>
                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-start gap-3 text-[14px] text-muted-foreground">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
                                            <span>
                                                <strong>IPv4 Support:</strong>{" "}
                                                Stable and universal.
                                            </span>
                                        </div>
                                        <div className="flex items-start gap-3 text-[14px] text-muted-foreground">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
                                            <span>
                                                <strong>IPv6 Support:</strong>{" "}
                                                Fast and cost-efficient.
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-5 p-6 rounded-2xl bg-muted/50 border border-border/50">
                                    <h3 className="text-md font-bold text-foreground flex items-center gap-2">
                                        <Settings className="w-5 h-5 text-muted-foreground" />
                                        How to Setup
                                    </h3>
                                    <ol className="text-[15px] text-muted-foreground space-y-4 list-decimal pl-5">
                                        <li>
                                            Go to{" "}
                                            <Link
                                                href="/proxies"
                                                className="text-blue-600 dark:text-blue-400 font-bold hover:underline underline-offset-4"
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
                                            <code className="inline-block mt-2 bg-background px-2 py-1 rounded border border-border text-emerald-700 dark:text-emerald-400 font-mono text-xs">
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
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 font-bold shadow-sm text-lg">
                            2
                        </div>
                        <h2 className="text-2xl font-bold text-foreground">
                            Setting Up Monitors
                        </h2>
                    </div>

                    <Card className="shadow-sm overflow-hidden">
                        <CardContent className="p-8 space-y-8">
                            <div className="grid md:grid-cols-2 gap-12">
                                <div className="space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                                            <LayoutDashboard className="w-6 h-6" />
                                        </div>
                                        <h3 className="text-lg font-bold text-foreground">
                                            Create Search Tasks
                                        </h3>
                                    </div>
                                    <p className="text-[15px] text-muted-foreground leading-relaxed">
                                        A monitor is your personal search agent.
                                        Define exactly what you want to find,
                                        and Vintrack will notify you the moment
                                        it hits Vinted.
                                    </p>
                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-start gap-3 text-[14px] text-muted-foreground">
                                            <Search className="w-4 h-4 text-blue-500 mt-1 shrink-0" />
                                            <span>
                                                <strong>Queries:</strong> Use
                                                specific keywords for better
                                                results.
                                            </span>
                                        </div>
                                        <div className="flex items-start gap-3 text-[14px] text-muted-foreground">
                                            <Zap className="w-4 h-4 text-amber-500 mt-1 shrink-0" />
                                            <span>
                                                <strong>Filters:</strong> Set
                                                price, brand, and size limits.
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-5 p-6 rounded-2xl bg-muted/50 border border-border/50">
                                    <h3 className="text-md font-bold text-foreground flex items-center gap-2">
                                        <PlusCircle className="w-5 h-5 text-muted-foreground" />
                                        How to Setup
                                    </h3>
                                    <ol className="text-[15px] text-muted-foreground space-y-4 list-decimal pl-5">
                                        <li>
                                            Go to{" "}
                                            <Link
                                                href="/monitors/new"
                                                className="text-blue-600 dark:text-blue-400 font-bold hover:underline underline-offset-4"
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
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 font-bold shadow-sm text-lg">
                            3
                        </div>
                        <h2 className="text-2xl font-bold text-foreground">
                            Discord and Telegram Notifications
                        </h2>
                    </div>

                    <Card className="shadow-sm overflow-hidden">
                        <CardContent className="p-8 space-y-8">
                            <div className="grid md:grid-cols-2 gap-12">
                                <div className="space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                                            <Bell className="w-6 h-6" />
                                        </div>
                                        <h3 className="text-lg font-bold text-foreground">
                                            Stay Alert
                                        </h3>
                                    </div>
                                    <p className="text-[15px] text-muted-foreground leading-relaxed">
                                        Use Discord webhooks or connect the
                                        Vintrack Telegram bot to receive instant
                                        item cards.
                                    </p>
                                    <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 flex items-center gap-3">
                                        <Smartphone className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                        <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                                            Perfect for push notifications on
                                            your phone!
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-5 p-6 rounded-2xl bg-muted/50 border border-border/50">
                                    <h3 className="text-md font-bold text-foreground flex items-center gap-2">
                                        <LinkIcon className="w-5 h-5 text-muted-foreground" />
                                        How to Setup
                                    </h3>
                                    <ol className="text-[15px] text-muted-foreground space-y-4 list-decimal pl-5">
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
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold shadow-sm text-lg">
                            4
                        </div>
                        <h2 className="text-2xl font-bold text-foreground">
                            Vinted Account Integration
                        </h2>
                    </div>

                    <Card className="shadow-sm overflow-hidden">
                        <CardContent className="p-8 space-y-8">
                            <div className="grid md:grid-cols-2 gap-12">
                                <div className="space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                                            <User className="w-6 h-6" />
                                        </div>
                                        <h3 className="text-lg font-bold text-foreground">
                                            Account Actions
                                        </h3>
                                    </div>
                                    <p className="text-[15px] text-muted-foreground leading-relaxed">
                                        Link your Vinted account with the
                                        Vintrack extension. It keeps the browser
                                        session fresh without making you copy
                                        tokens manually.
                                    </p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="p-3 rounded-xl bg-card border border-border shadow-sm text-center space-y-2">
                                            <Heart className="w-4 h-4 mx-auto text-red-500 fill-red-500" />
                                            <span className="text-[11px] font-bold block text-foreground">
                                                Like
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-xl bg-card border border-border shadow-sm text-center space-y-2">
                                            <MessageSquare className="w-4 h-4 mx-auto text-blue-500" />
                                            <span className="text-[11px] font-bold block text-foreground">
                                                Message
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-xl bg-card border border-border shadow-sm text-center space-y-2">
                                            <Tag className="w-4 h-4 mx-auto text-emerald-500" />
                                            <span className="text-[11px] font-bold block text-foreground">
                                                Offer
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                                        The extension syncs only the Vinted
                                        session tokens, domain, browser user
                                        agent, and Vintrack theme. It does not
                                        send a full cookie header.
                                    </p>
                                </div>
                                <div className="space-y-5 p-6 rounded-2xl bg-muted/50 border border-border/50">
                                    <h3 className="text-md font-bold text-foreground flex items-center gap-2">
                                        <Settings className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                        How to Setup
                                    </h3>
                                    <ol className="text-[15px] text-muted-foreground space-y-4 list-decimal pl-5">
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
                                                className="text-blue-600 dark:text-blue-400 font-bold hover:underline underline-offset-4"
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

            <div className="rounded-[2rem] bg-slate-900 p-10 flex flex-col md:flex-row items-center gap-8 shadow-xl">
                <div className="p-5 rounded-2xl bg-background/10 backdrop-blur-sm border border-white/10">
                    <Info className="w-9 h-9 text-blue-400" />
                </div>
                <div className="space-y-2">
                    <h3 className="font-bold text-white text-xl">
                        Still have questions?
                    </h3>
                    <p className="text-slate-400 text-[15px]">
                        Check out our community or visit the GitHub repository
                        for technical support, feature requests, and updates.
                    </p>
                </div>
                <a
                    href="https://github.com/JakobAIOdev/Vintrack-Vinted-Monitor"
                    target="_blank"
                    className="ml-auto flex items-center gap-2.5 bg-background text-foreground px-8 py-3.5 rounded-2xl font-bold hover:bg-muted transition-all shadow-lg active:scale-95"
                >
                    View GitHub <ExternalLink className="w-5 h-5" />
                </a>
            </div>
        </div>
    );
}
