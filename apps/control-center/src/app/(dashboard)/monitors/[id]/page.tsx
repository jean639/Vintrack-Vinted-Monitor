import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { LiveFeed } from "@/components/monitors/live-feed";
import { Button } from "@/components/ui/button";
import { toggleMonitorStatus, deleteMonitor } from "@/actions/monitor";
import { ArrowLeft, PauseCircle, PlayCircle, Trash2, Tag, Globe, Zap, Pencil } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getCategoryLabels } from "@/lib/categories";
import { getBrandLabels } from "@/lib/brands";
import { getColorLabels } from "@/lib/colors";
import { getSizeLabels } from "@/lib/sizes";
import { getRegionLabel, getRegionFlags } from "@/lib/regions";
import { ProxyHealthCard } from "@/components/monitors/proxy-health";
import { MonitorLiveProvider } from "@/components/monitors/monitor-live-context";
import { MonitorItemCount } from "@/components/monitors/monitor-item-count";

export default async function MonitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const monitorId = parseInt(resolvedParams.id);

  if (isNaN(monitorId)) return notFound();

  const monitor = await db.monitors.findUnique({
    where: { id: monitorId },
    include: {
      _count: { select: { items: true } },
      proxy_group: { select: { name: true } },
    },
  });

  if (!monitor) return notFound();

  const toggleAction = toggleMonitorStatus.bind(
    null,
    monitor.id,
    monitor.status || "active"
  );
  const deleteAction = deleteMonitor.bind(null, monitor.id);

  return (
    <MonitorLiveProvider initialItemCount={monitor._count.items}>
      <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">
                {monitor.query}
              </h1>
              <Badge
                variant={
                  monitor.status === "active" ? "default" : "secondary"
                }
                className={`text-[10px] font-medium ${
                  monitor.status === "active"
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {monitor.status === "active" ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Running
                  </span>
                ) : (
                  (monitor.status?.charAt(0).toUpperCase() ?? "") +
                  (monitor.status?.slice(1) ?? "Paused")
                )}
              </Badge>
            </div>

            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span>ID: {monitor.id}</span>
              {monitor.price_max && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Max {monitor.price_max}€
                  </span>
                </>
              )}
              <span className="text-muted-foreground/50">·</span>
              <MonitorItemCount />
              <span className="text-muted-foreground/50">·</span>
              <span>{getRegionLabel(monitor.region)}</span>
              <span className="text-muted-foreground/50">·</span>
              {monitor.proxy_group ? (
                <span className="flex items-center gap-1">
                  <Globe className="h-3 w-3" /> {monitor.proxy_group.name}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                  <Zap className="h-3 w-3" /> Server Proxies
                </span>
              )}
            </div>

            {(monitor.catalog_ids || monitor.brand_ids || monitor.color_ids || monitor.size_id || monitor.allowed_countries) && (
              <div className="flex flex-wrap gap-1 mt-2">
                {monitor.allowed_countries && (
                  <span
                    className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                    title={`Only items from: ${monitor.allowed_countries}`}
                  >
                    {getRegionFlags(monitor.allowed_countries).join(" ")}
                  </span>
                )}
                {monitor.catalog_ids &&
                  getCategoryLabels(monitor.catalog_ids).map((label) => (
                    <span
                      key={`cat-${label}`}
                      className="inline-flex items-center rounded-md bg-violet-50 dark:bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20"
                    >
                      {label}
                    </span>
                  ))}
                {monitor.brand_ids &&
                  getBrandLabels(monitor.brand_ids).map((label) => (
                    <span
                      key={`brand-${label}`}
                      className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"
                    >
                      {label}
                    </span>
                  ))}
                {monitor.color_ids &&
                  getColorLabels(monitor.color_ids).map((label) => (
                    <span
                      key={`color-${label}`}
                      className="inline-flex items-center rounded-md bg-pink-50 dark:bg-pink-500/10 px-1.5 py-0.5 text-[10px] font-medium text-pink-700 dark:text-pink-400 border border-pink-200 dark:border-pink-500/20"
                    >
                      {label}
                    </span>
                  ))}
                {monitor.size_id &&
                  getSizeLabels(monitor.size_id).map((label) => (
                    <span
                      key={`size-${label}`}
                      className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20"
                    >
                      {label}
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/monitors/${monitor.id}/edit`}>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium text-muted-foreground border-border hover:bg-muted"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
          </Link>

          <form action={toggleAction}>
            <Button
              variant="outline"
              size="sm"
              className={`h-8 text-xs font-medium ${
                monitor.status === "active"
                  ? "text-amber-600 dark:text-amber-500 border-amber-200 dark:border-amber-500/20 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                  : "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
              }`}
            >
              {monitor.status === "active" ? (
                <>
                  <PauseCircle className="mr-1.5 h-3.5 w-3.5" /> Pause
                </>
              ) : (
                <>
                  <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> Resume
                </>
              )}
            </Button>
          </form>

          <form action={deleteAction}>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium text-red-500 dark:text-red-400 border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
            </Button>
          </form>
        </div>
      </div>

      {monitor.status === "active" && (
        <ProxyHealthCard monitorId={monitor.id} />
      )}

        <div>
          <h2 className="text-lg font-semibold mb-4">Latest Results</h2>
          <LiveFeed monitorId={monitor.id} />
        </div>
      </div>
    </MonitorLiveProvider>
  );
}
