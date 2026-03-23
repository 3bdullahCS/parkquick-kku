// src/data/zones.ts
export type ZoneId = "F-A" | "F-B" | "F-C" | "F-D" | "B-A" | "B-B" | "B-C" | "B-D";
export type Congestion = "green" | "orange" | "red" | "unknown";
export type Report = { score: number; timestamp: number; userId: string; };
export type ZoneStatus = { reports: Report[]; congestion: Congestion; avgScore: number; lastUpdate: number | null; };
export type ZoneDef = { id: ZoneId; label: string; labelAr: string; bounds: [number, number][]; };

export const FRONT_ZONES: ZoneDef[] = [
  { id: "F-A", label: "Zone A", labelAr: "المنطقة أ", bounds: [[18.090876,42.719158],[18.090767,42.719177],[18.090683,42.718710],[18.090792,42.718690]] },
  { id: "F-B", label: "Zone B", labelAr: "المنطقة ب", bounds: [[18.090706,42.719188],[18.090597,42.719207],[18.090513,42.718740],[18.090622,42.718720]] },
  { id: "F-C", label: "Zone C", labelAr: "المنطقة ج", bounds: [[18.090536,42.719218],[18.090427,42.719237],[18.090343,42.718770],[18.090452,42.718750]] },
  { id: "F-D", label: "Zone D", labelAr: "المنطقة د", bounds: [[18.090366,42.719248],[18.090257,42.719267],[18.090173,42.718800],[18.090282,42.718780]] },
];

export const BACK_ZONES: ZoneDef[] = [
  { id: "B-A", label: "Zone A", labelAr: "المنطقة أ", bounds: [[18.093387,42.719142],[18.093496,42.719495],[18.093062,42.719704],[18.092944,42.719342]] },
  { id: "B-B", label: "Zone B", labelAr: "المنطقة ب", bounds: [[18.093166,42.720134],[18.093299,42.720708],[18.093211,42.720756],[18.093054,42.720147]] },
  { id: "B-C", label: "Zone C", labelAr: "المنطقة ج", bounds: [[18.093232,42.721116],[18.093137,42.721145],[18.092871,42.720169],[18.092976,42.720137]] },
  { id: "B-D", label: "Zone D", labelAr: "المنطقة د", bounds: [[18.093152,42.721524],[18.093064,42.721551],[18.092752,42.720409],[18.092848,42.720387]] },
];

export const FRONT_CENTER: [number, number] = [18.09050, 42.71893];
export const BACK_CENTER: [number, number] = [18.093100, 42.720400];
export const REPORT_TTL_MS = 15 * 60 * 1000;
export const RATE_LIMIT_MS = 2 * 60 * 1000;

export function scoreToCongestion(score: number): Congestion {
  if (score >= 67) return "red"; if (score >= 34) return "orange"; return "green";
}
export function congestionColor(c: Congestion): string {
  if (c === "green") return "#22c55e"; if (c === "orange") return "#f97316"; if (c === "red") return "#ef4444"; return "#64748b";
}
export function congestionLabel(c: Congestion): string {
  if (c === "green") return "متاح"; if (c === "orange") return "متوسط"; if (c === "red") return "ممتلئ"; return "لا بيانات";
}
export function calculateZoneStatus(reports: Report[]): ZoneStatus {
  const now = Date.now();
  const active = reports.filter(r => now - r.timestamp < REPORT_TTL_MS);
  if (active.length === 0) return { reports: [], congestion: "unknown", avgScore: 0, lastUpdate: null };
  const FRESH = 5 * 60 * 1000;
  let tw = 0, ws = 0;
  for (const r of active) { const w = (now - r.timestamp) < FRESH ? 1.0 : 0.5; ws += r.score * w; tw += w; }
  const avgScore = Math.round(ws / tw);
  return { reports: active, congestion: scoreToCongestion(avgScore), avgScore, lastUpdate: Math.max(...active.map(r => r.timestamp)) };
}
export function findBestZone(statuses: Record<string, ZoneStatus>, side?: "front" | "back"): ZoneId | null {
  const zones = side === "front" ? FRONT_ZONES : side === "back" ? BACK_ZONES : [...FRONT_ZONES, ...BACK_ZONES];
  let bestId: ZoneId | null = null, bestScore = Infinity;
  for (const z of zones) { const s = statuses[z.id]; const score = s && s.reports.length > 0 ? s.avgScore : -1; if (score < bestScore) { bestScore = score; bestId = z.id; } }
  return bestId;
}
