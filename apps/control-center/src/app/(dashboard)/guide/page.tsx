import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  User
} from "lucide-react";
import Link from "next/link";

export default function GuidePage() {
  return (
    <div className="space-y-6 mx-auto max-w-4xl">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-10">
        <div className="flex items-center gap-2 text-blue-600 font-bold text-sm tracking-wide uppercase">
          <Sparkles className="w-4 h-4" />
          Documentation
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
          Getting Started with Vintrack
        </h1>
        <p className="text-slate-500 text-[17px] max-w-3xl leading-relaxed">
          This comprehensive guide will walk you through setting up your Vintrack account for maximum efficiency. 
          Follow these steps to start monitoring Vinted like a pro.
        </p>
      </div>

      <div className="space-y-16">
        
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold shadow-sm text-lg">
              1
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Configuring Proxies (IPv4 & IPv6)</h2>
          </div>
          
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardContent className="p-8 space-y-8">
              <div className="grid md:grid-cols-2 gap-12">
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                      <Globe className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">The Basics</h3>
                  </div>
                  <p className="text-[15px] text-slate-600 leading-relaxed">
                    Vinted has strict limits on requests from a single IP. Proxies act as a "middleman," allowing Vintrack to rotate through multiple identities to keep you scanning 24/7.
                  </p>
                  <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-3 text-[14px] text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
                      <span><strong>IPv4 Support:</strong> Stable and universal.</span>
                    </div>
                    <div className="flex items-start gap-3 text-[14px] text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
                      <span><strong>IPv6 Support:</strong> Fast and cost-efficient.</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-5 p-6 rounded-2xl bg-slate-50/50 border border-slate-100">
                  <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-slate-500" />
                    How to Setup
                  </h3>
                  <ol className="text-[15px] text-slate-600 space-y-4 list-decimal pl-5">
                    <li>Go to <Link href="/proxies" className="text-blue-600 font-bold hover:underline underline-offset-4">Proxy Groups</Link>.</li>
                    <li>Click <strong>"New Group"</strong> and give it a name.</li>
                    <li>Paste your proxies in the format:<br/>
                      <code className="inline-block mt-2 bg-white px-2 py-1 rounded border border-slate-200 text-emerald-700 font-mono text-xs">ip:port:user:pass</code>
                    </li>
                    <li>Vintrack automatically detects both formats.</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold shadow-sm text-lg">
              2
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Setting Up Monitors</h2>
          </div>
          
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardContent className="p-8 space-y-8">
              <div className="grid md:grid-cols-2 gap-12">
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                      <LayoutDashboard className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Create Search Tasks</h3>
                  </div>
                  <p className="text-[15px] text-slate-600 leading-relaxed">
                    A monitor is your personal search agent. Define exactly what you want to find, and Vintrack will notify you the moment it hits Vinted.
                  </p>
                  <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-3 text-[14px] text-slate-600">
                      <Search className="w-4 h-4 text-blue-500 mt-1 shrink-0" />
                      <span><strong>Queries:</strong> Use specific keywords for better results.</span>
                    </div>
                    <div className="flex items-start gap-3 text-[14px] text-slate-600">
                      <Zap className="w-4 h-4 text-amber-500 mt-1 shrink-0" />
                      <span><strong>Filters:</strong> Set price, brand, and size limits.</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-5 p-6 rounded-2xl bg-slate-50/50 border border-slate-100">
                  <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-slate-500" />
                    How to Setup
                  </h3>
                  <ol className="text-[15px] text-slate-600 space-y-4 list-decimal pl-5">
                    <li>Go to <Link href="/monitors/new" className="text-blue-600 font-bold hover:underline underline-offset-4">New Monitor</Link>.</li>
                    <li>Enter your <strong>Keywords</strong> (e.g., "Stone Island").</li>
                    <li>Select the <strong>Region</strong> (e.g., FR, UK, DE).</li>
                    <li>Assign your <strong>Proxy Group</strong> and save.</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-100 text-purple-700 font-bold shadow-sm text-lg">
              3
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Discord Notifications</h2>
          </div>
          
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardContent className="p-8 space-y-8">
              <div className="grid md:grid-cols-2 gap-12">
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 shrink-0">
                      <Bell className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Stay Alert</h3>
                  </div>
                  <p className="text-[15px] text-slate-600 leading-relaxed">
                    Don't stay glued to the dashboard. Use Webhooks to receive instant, beautiful item cards directly in your Discord server.
                  </p>
                  <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-purple-600" />
                    <span className="text-xs font-medium text-purple-700">Perfect for push notifications on your phone!</span>
                  </div>
                </div>
                <div className="space-y-5 p-6 rounded-2xl bg-slate-50/50 border border-slate-100">
                  <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                    <LinkIcon className="w-5 h-5 text-slate-500" />
                    How to Setup
                  </h3>
                  <ol className="text-[15px] text-slate-600 space-y-4 list-decimal pl-5">
                    <li>In Discord: <strong>Channel Settings</strong> &gt; <strong>Integrations</strong>.</li>
                    <li>Click <strong>"Create Webhook"</strong> and copy the URL.</li>
                    <li>Paste the URL into your monitor settings.</li>
                    <li>Toggle <strong>"Webhook Active"</strong> to ON.</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold shadow-sm text-lg">
              4
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Vinted Account Integration</h2>
          </div>
          
          <Card className="border-slate-200 shadow-sm overflow-hidden bg-amber-50/5">
            <CardContent className="p-8 space-y-8">
              <div className="grid md:grid-cols-2 gap-12">
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                      <User className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Pro Power Tools</h3>
                  </div>
                  <p className="text-[15px] text-slate-600 leading-relaxed">
                    Linking your account unlocks direct interactions with Vinted sellers, saving you the time of manual browsing.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-white border border-slate-100 shadow-sm text-center space-y-2">
                      <Heart className="w-4 h-4 mx-auto text-red-500 fill-red-500" />
                      <span className="text-[11px] font-bold block">Like</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-100 shadow-sm text-center space-y-2">
                      <MessageSquare className="w-4 h-4 mx-auto text-blue-500" />
                      <span className="text-[11px] font-bold block">Message</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-100 shadow-sm text-center space-y-2">
                      <Tag className="w-4 h-4 mx-auto text-emerald-500" />
                      <span className="text-[11px] font-bold block">Offer</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-5 p-6 rounded-2xl bg-amber-50/50 border border-amber-100">
                  <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-amber-600" />
                    How to Setup
                  </h3>
                  <p className="text-[15px] text-slate-600 leading-relaxed">
                    Go to the <Link href="/account" className="text-blue-600 font-bold hover:underline underline-offset-4">Account</Link> tab and follow the instructions to link your Vinted session using a web token.
                  </p>
                  <Link href="/account">
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 cursor-pointer px-4 py-1.5 font-bold">
                      Connect Account
                    </Badge>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

      </div>

      <div className="rounded-[2rem] bg-slate-900 p-10 flex flex-col md:flex-row items-center gap-8 shadow-xl">
        <div className="p-5 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
          <Info className="w-9 h-9 text-blue-400" />
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-white text-xl">Still have questions?</h3>
          <p className="text-slate-400 text-[15px]">
            Check out our community or visit the GitHub repository for technical support, feature requests, and updates.
          </p>
        </div>
        <a 
          href="https://github.com/JakobAIOdev/Vintrack-Vinted-Monitor" 
          target="_blank" 
          className="ml-auto flex items-center gap-2.5 bg-white text-slate-900 px-8 py-3.5 rounded-2xl font-bold hover:bg-slate-100 transition-all shadow-lg active:scale-95"
        >
          View GitHub <ExternalLink className="w-5 h-5" />
        </a>
      </div>
    </div>
  );
}
