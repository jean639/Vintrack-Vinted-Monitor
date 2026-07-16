export const DEMO_MONITOR_DURATION_MINUTES = 30;
export const DEMO_MONITOR_DURATION_MS =
    DEMO_MONITOR_DURATION_MINUTES * 60 * 1000;

export function getNextDemoMonitorExpiry(now = new Date()) {
    return new Date(now.getTime() + DEMO_MONITOR_DURATION_MS);
}
