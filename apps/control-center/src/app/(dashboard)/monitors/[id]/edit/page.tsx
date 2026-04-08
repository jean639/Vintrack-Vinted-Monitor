"use client";

import { deleteMonitorAndReturn, updateMonitorAndReturn, testDiscordWebhook } from "@/actions/monitor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryPicker } from "@/components/monitors/category-picker";
import { BrandPicker } from "@/components/monitors/brand-picker";
import { SizePicker } from "@/components/monitors/size-picker";
import { RegionPicker } from "@/components/monitors/region-picker";
import { CountryFilterPicker } from "@/components/monitors/country-filter-picker";
import { ColorPicker } from "@/components/monitors/color-picker";
import { StatusPicker } from "@/components/monitors/status-picker";
import { getStatusLocaleForRegionCodes } from "@/lib/regions";
import { buildVintedMonitorUrl } from "@/lib/vinted-url";
import { ArrowLeft, Copy, ExternalLink, Loader2, Save, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

type ProxyGroupOption = {
  id: number;
  name: string;
  proxyCount: number;
};

type MonitorData = {
  id: number;
  name: string;
  query: string;
  price_min: number | null;
  price_max: number | null;
  size_id: string | null;
  catalog_ids: string | null;
  brand_ids: string | null;
  color_ids: string | null;
  status_ids: string | null;
  region: string;
  allowed_countries: string | null;
  discord_webhook: string | null;
  proxy_group_id: number | null;
};

export default function EditMonitorPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const monitorId = Number(params.id);
  const returnTo = searchParams.get("from") === "dashboard" ? "dashboard" : "detail";

  const [monitor, setMonitor] = useState<MonitorData | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCategoryLabels, setSelectedCategoryLabels] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("de");
  const [selectedAllowedCountries, setSelectedAllowedCountries] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [proxyGroups, setProxyGroups] = useState<ProxyGroupOption[]>([]);
  const [userRole, setUserRole] = useState<string>("free");
  const [selectedProxyGroup, setSelectedProxyGroup] = useState<string>("");
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleTestWebhook = async () => {
    if (!webhookUrl) {
      toast.error("Please enter a webhook URL first");
      return;
    }
    setIsTestingWebhook(true);
    const result = await testDiscordWebhook(webhookUrl);
    setIsTestingWebhook(false);
    
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Test webhook sent successfully!");
    }
  };

  const handleCopyPreviewUrl = async () => {
    try {
      await navigator.clipboard.writeText(previewUrl);
      toast.success("Preview URL copied");
    } catch {
      toast.error("Failed to copy preview URL");
    }
  };

  useEffect(() => {
    Promise.all([
      fetch(`/api/monitors/${monitorId}`).then((r) => r.json()),
      fetch("/api/proxy-groups").then((r) => r.json()),
    ])
      .then(([monitorData, proxyData]) => {
        const m = monitorData.monitor;
        if (m) {
          setMonitor(m);
          setQuery(m.query || "");
          setPriceMin(m.price_min != null ? String(m.price_min) : "");
          setPriceMax(m.price_max != null ? String(m.price_max) : "");
          setSelectedSizes(m.size_id ? m.size_id.split(",").filter(Boolean) : []);
          setSelectedCategories(m.catalog_ids ? m.catalog_ids.split(",").filter(Boolean) : []);
          setSelectedBrands(m.brand_ids ? m.brand_ids.split(",").filter(Boolean) : []);
          setSelectedColors(m.color_ids ? m.color_ids.split(",").filter(Boolean) : []);
          setSelectedStatuses(m.status_ids ? m.status_ids.split(",").filter(Boolean) : []);
          setSelectedRegion(m.region || "de");
          setSelectedAllowedCountries(m.allowed_countries ? m.allowed_countries.split(",").filter(Boolean) : []);
          setSelectedProxyGroup(
            m.proxy_group_id ? m.proxy_group_id.toString() : "server"
          );
          setWebhookUrl(m.discord_webhook || "");
        }
        setProxyGroups(proxyData.groups || []);
        setUserRole(proxyData.role || "free");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [monitorId]);

  const previewUrl = useMemo(
    () =>
      buildVintedMonitorUrl({
        region: selectedRegion,
        query,
        priceMin,
        priceMax,
        sizeIds: selectedSizes,
        catalogIds: selectedCategories,
        brandIds: selectedBrands,
        colorIds: selectedColors,
        statusIds: selectedStatuses,
      }),
    [
      selectedRegion,
      query,
      priceMin,
      priceMax,
      selectedSizes,
      selectedCategories,
      selectedBrands,
      selectedColors,
      selectedStatuses,
    ]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!monitor) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Monitor not found.
      </div>
    );
  }

  const handleDelete = async () => {
    await toast.promise(deleteMonitorAndReturn(monitorId), {
      loading: "Deleting monitor...",
      success: "Monitor deleted",
      error: "Failed to delete monitor",
    });

    router.push("/dashboard");
    router.refresh();
  };

  const handleSave = async (formData: FormData) => {
    const savePromise = updateMonitorAndReturn(monitorId, formData);

    await toast.promise(savePromise, {
      loading: "Saving changes...",
      success: "Saved successfully",
      error: "Failed to save changes",
    });

    const result = await savePromise;
    router.push(result.redirectTo);
    router.refresh();
  };

  return (
    <div className="space-y-6 mx-auto max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href={`/monitors/${monitorId}`}>
          <Button variant="outline" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Monitor</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Update settings for &quot;{monitor.name}&quot;.
          </p>
        </div>
      </div>

      <Card className="border-input/60">
        <CardContent className="p-6">
          <form action={handleSave} className="space-y-6">
            <input type="hidden" name="return_to" value={returnTo} />
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[13px]">
                Monitor Name
              </Label>
              <Input
                name="name"
                id="name"
                placeholder="e.g. Nike Jackets DE"
                defaultValue={monitor.name}
                required
              />
              <p className="text-[12px] text-muted-foreground">
                Internal name for this monitor in the dashboard and notifications.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="query" className="text-[13px]">
                Keywords{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                name="query"
                id="query"
                placeholder="e.g. Nike Dunk Low Grey"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <p className="text-[12px] text-muted-foreground">
                Optional Vinted text search. Leave empty if you only want to filter by category, brand, price, size, etc.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px]">Country / Region</Label>
              <RegionPicker
                selected={selectedRegion}
                onChange={setSelectedRegion}
              />
              <input type="hidden" name="region" value={selectedRegion} />
              <p className="text-[12px] text-muted-foreground">
                Select which Vinted country to monitor.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px]">
                Strict Item Location Filter{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <CountryFilterPicker
                selected={selectedAllowedCountries}
                onChange={setSelectedAllowedCountries}
              />
              <input type="hidden" name="allowed_countries" value={selectedAllowedCountries.join(",")} />
              <p className="text-[12px] text-muted-foreground">
                Only items located in these countries will be sent/saved. Leave empty to allow all countries.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px]">
                Category Filter{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <CategoryPicker
                region={selectedRegion}
                selected={selectedCategories}
                onChange={setSelectedCategories}
                onSelectionMetaChange={({ selectedLabels }) =>
                  setSelectedCategoryLabels(selectedLabels)
                }
              />
              <input
                type="hidden"
                name="catalog_ids"
                value={selectedCategories.join(",")}
              />
              <p className="text-[12px] text-muted-foreground">
                Limit results to specific Vinted categories.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price_min" className="text-[13px]">
                  Min Price
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    €
                  </span>
                  <Input
                    type="number"
                    name="price_min"
                    placeholder="0"
                    className="pl-7"
                    value={priceMin}
                    onChange={(event) => setPriceMin(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_max" className="text-[13px]">
                  Max Price
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    €
                  </span>
                  <Input
                    type="number"
                    name="price_max"
                    placeholder="Any"
                    className="pl-7"
                    value={priceMax}
                    onChange={(event) => setPriceMax(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px]">
                Brand Filter{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <BrandPicker
                selected={selectedBrands}
                onChange={setSelectedBrands}
              />
              <input
                type="hidden"
                name="brand_ids"
                value={selectedBrands.join(",")}
              />
              <p className="text-[12px] text-muted-foreground">
                Limit results to specific brands.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px]">
                Color Filter{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <ColorPicker
                selected={selectedColors}
                onChange={setSelectedColors}
              />
              <input
                type="hidden"
                name="color_ids"
                value={selectedColors.join(",")}
              />
              <p className="text-[12px] text-muted-foreground">
                Limit results to specific colors.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px]">
                Condition Filter{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <StatusPicker
                selected={selectedStatuses}
                onChange={setSelectedStatuses}
                locale={getStatusLocaleForRegionCodes(selectedAllowedCountries.join(","), selectedRegion)}
              />
              <input
                type="hidden"
                name="status_ids"
                value={selectedStatuses.join(",")}
              />
              <p className="text-[12px] text-muted-foreground">
                Pick one or more item conditions. Leave empty to allow all conditions.
              </p>
            </div>

            <div className="space-y-2.5">
              <Label className="text-[13px]">
                Size Filter{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <SizePicker
                selected={selectedSizes}
                onChange={setSelectedSizes}
              />
              <input
                type="hidden"
                name="size_id"
                value={selectedSizes.join(",")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discord_webhook" className="text-[13px]">
                Discord Webhook{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <div className="flex gap-2">
                <Input
                  name="discord_webhook"
                  id="discord_webhook"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestWebhook}
                  disabled={isTestingWebhook || !webhookUrl}
                  className="gap-2 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  {isTestingWebhook ? "Testing..." : "Test"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px]">Proxy Group</Label>
              {loading ? (
                <div className="h-10 bg-muted rounded-md animate-pulse" />
              ) : (
                <>
                  <select
                    name="proxy_group_id"
                    value={selectedProxyGroup}
                    onChange={(e) => setSelectedProxyGroup(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
                    required={userRole === "free"}
                  >
                    {(userRole === "premium" || userRole === "admin") && (
                      <option value="server">⚡ Server Proxies (Premium)</option>
                    )}
                    {proxyGroups.length === 0 && userRole === "free" && (
                      <option value="" disabled>
                        No proxy groups — create one first
                      </option>
                    )}
                    {proxyGroups.map((g) => (
                      <option key={g.id} value={g.id.toString()}>
                        {g.name} ({g.proxyCount} proxies)
                      </option>
                    ))}
                  </select>
                  {userRole === "free" && proxyGroups.length === 0 && (
                    <p className="text-[12px] text-amber-600">
                      You need to{" "}
                      <Link href="/proxies" className="underline font-medium">
                        create a proxy group
                      </Link>{" "}
                      before using a monitor.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[13px]">Monitor URL Preview</Label>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] text-muted-foreground">
                    This is the exact Vinted catalog URL for the current filter setup.
                  </p>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Test URL
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                <div className="relative mt-3">
                  <div className="overflow-x-auto rounded-lg border border-border/70 bg-background px-3 py-3 pr-12">
                    <code className="block whitespace-pre-wrap break-all text-[11px] text-foreground/90">
                      {previewUrl}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPreviewUrl}
                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Copy preview URL"
                    title="Copy URL"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                {selectedCategoryLabels.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedCategoryLabels.map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center rounded-full border border-border/70 bg-background px-2 py-1 text-[11px] text-muted-foreground"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                onClick={handleDelete}
                variant="outline"
                className="w-full gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 sm:w-auto"
              >
                <Trash2 className="w-4 h-4" /> Delete Monitor
              </Button>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href={returnTo === "dashboard" ? "/dashboard" : `/monitors/${monitorId}`}>
                  <Button type="button" variant="outline" className="w-full sm:w-auto">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" className="w-full gap-1.5 sm:w-auto">
                  <Save className="w-4 h-4" /> Save Changes
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
