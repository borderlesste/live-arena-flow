import { publicEnv } from "@/config/env";

const API_BASE = publicEnv.NEXT_PUBLIC_API_BASE_URL;

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string;
  role: string;
  accountStatus: string;
  provider: string;
  createdAt: string;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
}

export interface AdminMetricsOverview {
  total_activity_events?: number;
  total_sponsor_impressions?: number;
  total_sponsor_clicks?: number;
  unique_active_ids?: number;
  avg_watch_seconds?: number | null;
}

export interface AdminStreamMetric {
  streamId: string;
  view_starts: number;
  unique_users: number;
  peak_viewers: number;
  avg_viewers: number;
}

export type WebAnalyticsPeriod = "day" | "week" | "month" | "year";

export interface AdminWebAnalytics {
  period: WebAnalyticsPeriod;
  start: string;
  end: string;
  totals: { visits: number; pageViews: number; pagesPerVisit: number };
  previous: { visits: number; pageViews: number };
  changePercent: number | null;
  series: Array<{ date: string; visits: number; pageViews: number }>;
  lastSyncedAt: string | null;
  source: "cloudflare";
  configured: boolean;
  syncStatus: "ready" | "not_configured" | "error";
  syncErrorCode?: string;
}

export interface AdminAuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  result: "success" | "denied" | "failure";
  user_agent_summary: string | null;
  created_at: string;
}

export interface AdminChatReport {
  id: string;
  message_id: string;
  reporter_id: string;
  reason: string;
  created_at: string;
  reporterName: string;
  message: {
    id: string;
    user_id: string;
    body: string;
    channel: "community" | "official";
    created_at: string;
  } | null;
}

async function adminJson<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `El backend respondió ${response.status}`);
  }
  return response.json();
}

export function listAdminUsers(token: string) {
  return adminJson<AdminUserRow[]>(token, "/admin/users");
}

export function listAdminAudit(token: string) {
  return adminJson<AdminAuditLog[]>(token, "/admin/audit");
}

export function listAdminChatReports(token: string) {
  return adminJson<AdminChatReport[]>(token, "/admin/chat/reports");
}

export function getAdminMetricsOverview(token: string, start: string, end: string) {
  return adminJson<AdminMetricsOverview>(token, `/admin/metrics/overview?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
}

export function listAdminStreamMetrics(token: string, start: string, end: string) {
  return adminJson<AdminStreamMetric[]>(token, `/admin/metrics/streams?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
}

export function getAdminWebAnalytics(token: string, period: WebAnalyticsPeriod) {
  return adminJson<AdminWebAnalytics>(token, `/admin/web-analytics?period=${period}`);
}
