// src/App.tsx
import { useState, useCallback, useEffect, useRef } from "react";
import ParkingMap from "./components/ParkingMap";
import type { ZoneId, Report, Congestion } from "./data/zones";
import { RATE_LIMIT_MS } from "./data/zones";

const API_URL = import.meta.env.VITE_API_URL || "";

function getVisitorId(): string {
  let id = localStorage.getItem("pk_visitor_id");
  if (!id) { id = "v_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem("pk_visitor_id", id); }
  return id;
}

function apiStatusToReports(zone: { congestion: Congestion; avgScore: number; reportCount: number; lastUpdate: number | null; }): Report[] {
  if (zone.reportCount === 0 || !zone.lastUpdate) return [];
  const reports: Report[] = [];
  for (let i = 0; i < zone.reportCount; i++) reports.push({ score: zone.avgScore, timestamp: zone.lastUpdate - i * 60000, userId: `api_${i}` });
  return reports;
}

export default function App() {
  const [allReports, setAllReports] = useState<Record<string, Report[]>>({});
  const [lastReportTime, setLastReportTime] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isLive, setIsLive] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  const toggleTheme = useCallback(() => { setTheme(prev => (prev === "dark" ? "light" : "dark")); }, []);

  const fetchStatuses = useCallback(async () => {
    if (!API_URL) return false;
    try {
      const res = await fetch(`${API_URL}/zones/status`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.zones) {
        const reports: Record<string, Report[]> = {};
        for (const [zoneId, status] of Object.entries(data.zones)) reports[zoneId] = apiStatusToReports(status as any);
        setAllReports(reports); setIsLive(true); return true;
      }
    } catch { /* API not available */ }
    return false;
  }, []);

  useEffect(() => {
    async function init() {
      const connected = await fetchStatuses();
      if (!connected) {
        const now = Date.now();
        setAllReports({
          "F-A": [{ score: 85, timestamp: now - 120000, userId: "d1" }, { score: 90, timestamp: now - 60000, userId: "d2" }, { score: 80, timestamp: now - 300000, userId: "d3" }],
          "F-B": [{ score: 50, timestamp: now - 180000, userId: "d4" }, { score: 55, timestamp: now - 90000, userId: "d5" }],
          "F-C": [{ score: 15, timestamp: now - 200000, userId: "d6" }, { score: 20, timestamp: now - 100000, userId: "d7" }, { score: 10, timestamp: now - 50000, userId: "d8" }],
          "F-D": [{ score: 45, timestamp: now - 150000, userId: "d9" }, { score: 50, timestamp: now - 80000, userId: "d10" }],
          "B-A": [{ score: 10, timestamp: now - 240000, userId: "d11" }, { score: 15, timestamp: now - 110000, userId: "d12" }],
          "B-B": [{ score: 40, timestamp: now - 300000, userId: "d13" }, { score: 35, timestamp: now - 200000, userId: "d14" }],
          "B-C": [{ score: 75, timestamp: now - 180000, userId: "d15" }, { score: 80, timestamp: now - 90000, userId: "d16" }],
          "B-D": [{ score: 5, timestamp: now - 400000, userId: "d17" }, { score: 10, timestamp: now - 250000, userId: "d18" }],
        });
        setIsLive(false);
      }
    }
    init();
  }, [fetchStatuses]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (isLive && API_URL) pollRef.current = setInterval(fetchStatuses, 15000);
    else pollRef.current = setInterval(() => setAllReports(prev => ({ ...prev })), 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isLive, fetchStatuses]);

  const handleReport = useCallback(async (zoneId: ZoneId, score: number) => {
    const now = Date.now();
    if (lastReportTime && now - lastReportTime < RATE_LIMIT_MS) { setToast("⏳ انتظر قبل إرسال تقرير جديد"); setTimeout(() => setToast(null), 2000); return; }
    if (isLive && API_URL) {
      try {
        const res = await fetch(`${API_URL}/zones/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zoneId, score, visitorId: getVisitorId() }) });
        const data = await res.json();
        if (res.status === 429) { setToast(`⏳ انتظر ${data.waitSeconds} ثانية`); setTimeout(() => setToast(null), 2000); return; }
        if (data.success) { setLastReportTime(now); setToast("تم إرسال تقريرك بنجاح ✓"); setTimeout(() => setToast(null), 2500); fetchStatuses(); return; }
        setToast("حدث خطأ — حاول مرة أخرى"); setTimeout(() => setToast(null), 2500); return;
      } catch { /* fall through */ }
    }
    setAllReports(prev => ({ ...prev, [zoneId]: [...(prev[zoneId] || []), { score, timestamp: now, userId: `u_${Math.random().toString(36).slice(2, 8)}` }] }));
    setLastReportTime(now); setToast("تم إرسال تقريرك بنجاح ✓"); setTimeout(() => setToast(null), 2500);
  }, [lastReportTime, isLive, fetchStatuses]);

  return (
    <>
      <ParkingMap allReports={allReports} onReport={handleReport} lastReportTime={lastReportTime} theme={theme} onToggleTheme={toggleTheme} />
      <div style={{ position: "fixed", top: 8, left: 8, padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, zIndex: 1000, background: isLive ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)", color: isLive ? "#22c55e" : "#f97316", border: `1px solid ${isLive ? "rgba(34,197,94,0.3)" : "rgba(249,115,22,0.3)"}` }}>
        {isLive ? "🟢 متصل" : "🟠 وضع تجريبي"}
      </div>
      {toast && (
        <div className="pk-toast" style={{ background: toast.includes("✓") ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)", border: `1px solid ${toast.includes("✓") ? "rgba(34,197,94,0.4)" : "rgba(249,115,22,0.4)"}`, color: toast.includes("✓") ? "#22c55e" : "#f97316" }}>{toast}</div>
      )}
    </>
  );
}
