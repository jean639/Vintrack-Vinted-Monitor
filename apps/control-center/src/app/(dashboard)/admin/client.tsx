"use client";
import { useState } from "react";
import { toast } from "sonner";
import {
  Shield,
  Crown,
  User,
  Monitor,
  Globe,
  Search,
  Users,
  Sparkles,
  PauseCircle,
  Clock3,
  Boxes,
  Webhook,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  setUserRole,
  stopSingleUserMonitor,
  stopUserActiveMonitors,
} from "@/actions/admin";
import { getRegionLabel } from "@/lib/regions";

type UserMonitor = {
  id: number;
  query: string;
  status: string | null;
  region: string;
  created_at: Date | null;
  price_max: number | null;
  discord_webhook: string | null;
  webhook_active: boolean;
  proxy_group: { name: string } | null;
  _count: { items: number };
};

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  _count: { monitors: number; proxy_groups: number };
  monitors: UserMonitor[];
};

const ROLES = [
  { value: "free", label: "Free", icon: User, color: "bg-muted text-muted-foreground" },
  { value: "premium", label: "Premium", icon: Crown, color: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400" },
  { value: "admin", label: "Admin", icon: Shield, color: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400" },
] as const;

function getRoleBadge(role: string) {
  const r = ROLES.find((r) => r.value === role) ?? ROLES[0];
  return (
    <Badge className={`${r.color} text-[10px] font-semibold uppercase tracking-wide gap-1`}>
      <r.icon className="w-3 h-3" />
      {r.label}
    </Badge>
  );
}

function formatCreatedAt(value: Date | null) {
  if (!value) return "Unknown";

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminClient({
  users: initialUsers,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [pendingRole, setPendingRole] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isStoppingMonitors, setIsStoppingMonitors] = useState(false);
  const [stoppingMonitorId, setStoppingMonitorId] = useState<number | null>(null);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    if (!normalizedQuery) return true;

    const searchable = [
      user.name ?? "",
      user.email ?? "",
      user.role,
    ].join(" ").toLowerCase();

    return searchable.includes(normalizedQuery);
  });

  const totalUsers = users.length;
  const premiumUsers = users.filter((u) => u.role === "premium").length;
  const adminUsers = users.filter((u) => u.role === "admin").length;

  const openUserDetails = (user: UserRow) => {
    setSelected(user);
    setPendingRole(user.role);
    setIsDetailsOpen(true);
  };

  const openRoleDialog = (user: UserRow) => {
    setSelected(user);
    setPendingRole(user.role);
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!selected || pendingRole === selected.role) {
      setIsOpen(false);
      return;
    }

    const prevRole = selected.role;
    setUsers((prev) =>
      prev.map((u) => (u.id === selected.id ? { ...u, role: pendingRole } : u))
    );
    setSelected((prev) =>
      prev?.id === selected.id ? { ...prev, role: pendingRole } : prev
    );
    setIsOpen(false);

    toast.promise(setUserRole(selected.id, pendingRole), {
      loading: "Updating role...",
      success: `${selected.name ?? "User"} is now ${pendingRole}`,
      error: () => {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === selected.id ? { ...u, role: prevRole } : u
          )
        );
        setSelected((prev) =>
          prev?.id === selected.id ? { ...prev, role: prevRole } : prev
        );
        return "Failed to update role";
      },
    });
  };

  const handleStopUserMonitors = async () => {
    if (!selected) return;

    setIsStoppingMonitors(true);

    try {
      const result = await stopUserActiveMonitors(selected.id);

      setUsers((prev) =>
        prev.map((user) =>
          user.id === selected.id
            ? {
                ...user,
                monitors: user.monitors.map((monitor) =>
                  monitor.status === "active"
                    ? { ...monitor, status: "paused" }
                    : monitor
                ),
              }
            : user
        )
      );

      setSelected((prev) =>
        prev
          ? {
              ...prev,
              monitors: prev.monitors.map((monitor) =>
                monitor.status === "active"
                  ? { ...monitor, status: "paused" }
                  : monitor
              ),
            }
          : prev
      );

      toast.success(
        result.stoppedCount > 0
          ? `${result.stoppedCount} monitor${result.stoppedCount === 1 ? "" : "s"} stopped`
          : "No running monitors for this user"
      );
    } catch {
      toast.error("Failed to stop user monitors");
    } finally {
      setIsStoppingMonitors(false);
    }
  };

  const handleStopSingleMonitor = async (monitorId: number) => {
    if (!selected) return;

    setStoppingMonitorId(monitorId);

    try {
      const result = await stopSingleUserMonitor(selected.id, monitorId);

      if (result.stopped) {
        setUsers((prev) =>
          prev.map((user) =>
            user.id === selected.id
              ? {
                  ...user,
                  monitors: user.monitors.map((monitor) =>
                    monitor.id === monitorId
                      ? { ...monitor, status: "paused" }
                      : monitor
                  ),
                }
              : user
          )
        );

        setSelected((prev) =>
          prev
            ? {
                ...prev,
                monitors: prev.monitors.map((monitor) =>
                  monitor.id === monitorId
                    ? { ...monitor, status: "paused" }
                    : monitor
                ),
              }
            : prev
        );

        toast.success("Monitor stopped");
      } else {
        toast.success("Monitor is already stopped");
      }
    } catch {
      toast.error("Failed to stop monitor");
    } finally {
      setStoppingMonitorId(null);
    }
  };

  const selectedActiveMonitors =
    selected?.monitors.filter((monitor) => monitor.status === "active") ?? [];
  const selectedPausedMonitors =
    selected?.monitors.filter((monitor) => monitor.status !== "active") ?? [];
  const selectedItems =
    selected?.monitors.reduce((sum, monitor) => sum + monitor._count.items, 0) ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            User Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search users, review access levels, and update roles from one place.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, email or role..."
              className="h-10 rounded-xl border-border/60 bg-card pl-9"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60 bg-linear-to-br from-card to-muted/30 py-0">
          <CardHeader className="pb-3 pt-3">
            <div className="flex items-center justify-between">
              <CardDescription>Total Users</CardDescription>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-3xl">{totalUsers}</CardTitle>
          </CardHeader>
          <CardContent className="pb-6 text-xs text-muted-foreground">
            Active accounts visible in this workspace.
          </CardContent>
        </Card>

        <Card className="border-amber-200/70 bg-linear-to-br from-amber-50 to-card py-0 dark:border-amber-500/20 dark:from-amber-500/10">
          <CardHeader className="pb-3 pt-3">
            <div className="flex items-center justify-between">
              <CardDescription>Premium</CardDescription>
              <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
                <Crown className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-3xl text-amber-600 dark:text-amber-400">
              {premiumUsers}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-6 text-xs text-muted-foreground">
            Users with access to server proxy features.
          </CardContent>
        </Card>

        <Card className="border-red-200/70 bg-linear-to-br from-red-50 to-card py-0 dark:border-red-500/20 dark:from-red-500/10">
          <CardHeader className="pb-3 pt-3">
            <div className="flex items-center justify-between">
              <CardDescription>Admins</CardDescription>
              <div className="rounded-lg bg-red-500/10 p-2 text-red-600 dark:text-red-400">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-3xl text-red-600 dark:text-red-400">
              {adminUsers}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-6 text-xs text-muted-foreground">
            Full dashboard access including role management.
          </CardContent>
        </Card>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Team Members
            </p>
            <p className="text-xs text-muted-foreground">
              {filteredUsers.length} of {totalUsers} users shown
            </p>
          </div>
          {normalizedQuery ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 self-start px-2 text-xs sm:self-auto"
              onClick={() => setSearchQuery("")}
            >
              Clear search
            </Button>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30">
              <tr className="border-b border-border">
                <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                  User
                </th>
                <th className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                  Role
                </th>
                <th className="text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                  Monitors
                </th>
                <th className="text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                  Proxy Groups
                </th>
                <th className="text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="cursor-pointer transition-colors hover:bg-muted/40"
                  onClick={() => openUserDetails(user)}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                          {user.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {user.name ?? "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email ?? "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">{getRoleBadge(user.role)}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="inline-flex items-center gap-1 text-sm text-foreground">
                      <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                      {user._count.monitors}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="inline-flex items-center gap-1 text-sm text-foreground">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                      {user._count.proxy_groups}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {user.id === currentUserId ? (
                        <Badge
                          variant="outline"
                          className="rounded-full text-[10px] uppercase tracking-wide"
                        >
                          You
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-xs"
                          onClick={(event) => {
                            event.stopPropagation();
                            openRoleDialog(user);
                          }}
                        >
                          Change Role
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg px-2 text-xs text-muted-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          openUserDetails(user);
                        }}
                      >
                        Details
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                      <div className="rounded-full bg-muted p-3 text-muted-foreground">
                        <Search className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        No users match your search
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Try a different name, email address, or role.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Update role for <strong>{selected?.name ?? "User"}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-4">
            {ROLES.map((role) => (
              <button
                key={role.value}
                onClick={() => setPendingRole(role.value)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                  pendingRole === role.value
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-muted"
                }`}
              >
                <role.icon
                  className={`w-5 h-5 ${
                    pendingRole === role.value
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {role.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {role.value === "free" && "Standard access, must use own proxies"}
                    {role.value === "premium" && "Can use server proxies"}
                    {role.value === "admin" && "Full access + user management"}
                  </p>
                </div>
                {pendingRole === role.value && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Overview, monitor activity, and quick admin actions for{" "}
              <strong>{selected?.name ?? "User"}</strong>.
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  {selected.image ? (
                    <img
                      src={selected.image}
                      alt=""
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-base font-bold text-muted-foreground">
                      {selected.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-foreground">
                        {selected.name ?? "Unknown"}
                      </p>
                      {getRoleBadge(selected.role)}
                      {selected.id === currentUserId ? (
                        <Badge
                          variant="outline"
                          className="rounded-full text-[10px] uppercase tracking-wide"
                        >
                          You
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selected.email ?? "No email"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      User ID: {selected.id}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selected.id !== currentUserId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-lg text-xs"
                      onClick={() => openRoleDialog(selected)}
                    >
                      Change Role
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg text-xs text-amber-700 hover:text-amber-800"
                    onClick={handleStopUserMonitors}
                    disabled={selectedActiveMonitors.length === 0 || isStoppingMonitors}
                  >
                    <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
                    Stop Running Monitors
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <Card className="py-0">
                  <CardHeader className="pb-2 pt-3">
                    <CardDescription>Total Monitors</CardDescription>
                    <CardTitle className="text-2xl">{selected._count.monitors}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="py-0">
                  <CardHeader className="pb-2 pt-3">
                    <CardDescription>Running Now</CardDescription>
                    <CardTitle className="text-2xl text-emerald-600">
                      {selectedActiveMonitors.length}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="py-0">
                  <CardHeader className="pb-2 pt-3">
                    <CardDescription>Found Items</CardDescription>
                    <CardTitle className="text-2xl">{selectedItems}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="py-0">
                  <CardHeader className="pb-2 pt-3">
                    <CardDescription>Proxy Groups</CardDescription>
                    <CardTitle className="text-2xl">{selected._count.proxy_groups}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card">
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Running Monitors
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedActiveMonitors.length} currently active
                    </p>
                  </div>
                </div>
                <Separator />
                {selectedActiveMonitors.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {selectedActiveMonitors.map((monitor) => (
                      <div
                        key={monitor.id}
                        className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {monitor.query}
                            </p>
                            <Badge className="bg-emerald-50 text-emerald-700">
                              Running
                            </Badge>
                            <Badge variant="outline">#{monitor.id}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{getRegionLabel(monitor.region)}</span>
                            <span>{monitor._count.items} items</span>
                            <span>
                              {monitor.proxy_group?.name ?? "Server Proxies"}
                            </span>
                            {monitor.price_max ? (
                              <span>Max {monitor.price_max} EUR</span>
                            ) : null}
                            <span>
                              {monitor.discord_webhook && monitor.webhook_active
                                ? "Webhook active"
                                : "Webhook off"}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 text-xs text-amber-700 hover:text-amber-800"
                          onClick={() => handleStopSingleMonitor(monitor.id)}
                          disabled={stoppingMonitorId === monitor.id}
                        >
                          <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
                          Stop Monitor
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    This user has no running monitors.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border/60 bg-card">
                <div className="px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">
                    All Monitors
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Running and paused monitors with key details.
                  </p>
                </div>
                <Separator />
                {selected.monitors.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {[...selectedActiveMonitors, ...selectedPausedMonitors].map((monitor) => (
                      <div
                        key={monitor.id}
                        className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {monitor.query}
                            </p>
                            <Badge
                              variant={monitor.status === "active" ? "default" : "secondary"}
                              className={
                                monitor.status === "active"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : ""
                              }
                            >
                              {monitor.status === "active" ? "Running" : "Paused"}
                            </Badge>
                            <Badge variant="outline">#{monitor.id}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3.5 w-3.5" />
                              {formatCreatedAt(monitor.created_at)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Boxes className="h-3.5 w-3.5" />
                              {monitor._count.items} items
                            </span>
                            <span>{getRegionLabel(monitor.region)}</span>
                            <span>
                              {monitor.proxy_group?.name ?? "Server Proxies"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Webhook className="h-3.5 w-3.5" />
                              {monitor.discord_webhook && monitor.webhook_active
                                ? "Webhook active"
                                : monitor.discord_webhook
                                  ? "Webhook saved, paused"
                                  : "No webhook"}
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {monitor.status === "active" ? "Running" : "Paused"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    This user has not created any monitors yet.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
