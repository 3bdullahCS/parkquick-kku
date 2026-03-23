// src/components/ParkingMap.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Polygon, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./ParkingMap.css";
import { FRONT_ZONES, BACK_ZONES, FRONT_CENTER, BACK_CENTER, calculateZoneStatus, congestionColor, congestionLabel, findBestZone, RATE_LIMIT_MS, type ZoneDef, type ZoneId, type ZoneStatus, type Report } from "../data/zones";

function timeAgo(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return "الآن";
  if (d < 3600) return `قبل ${Math.floor(d / 60)} د`;
  if (d < 86400) return `قبل ${Math.floor(d / 3600)} س`;
  return `قبل ${Math.floor(d / 86400)} يوم`;
}

function FlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, zoom, { duration: 0.8 }); }, [center, zoom, map]);
  return null;
}

function ResetButton({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  return (
    <button onClick={() => map.flyTo(center, zoom, { duration: 0.5 })} style={{ position: "absolute", bottom: 10, right: 10, zIndex: 1000, width: 40, height: 40, borderRadius: 10, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)", boxShadow: "0 2px 10px rgba(0,0,0,0.3)" }} title="إعادة ضبط الخريطة">⌖</button>
  );
}

type Props = { allReports: Record<string, Report[]>; onReport: (zoneId: ZoneId, score: number) => void; lastReportTime: number | null; theme: "dark" | "light"; onToggleTheme: () => void; };

export default function ParkingMap({ allReports, onReport, lastReportTime, theme, onToggleTheme }: Props) {
  const [side, setSide] = useState<"front" | "back">("front");
  const [selectedZone, setSelectedZone] = useState<ZoneId | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [shakingZones, setShakingZones] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const prevStatuses = useRef<Record<string, string>>({});

  const zones = useMemo(() => (side === "front" ? FRONT_ZONES : BACK_ZONES), [side]);
  const center = side === "front" ? FRONT_CENTER : BACK_CENTER;
  const allZoneIds = side === "front" ? (["F-A","F-B","F-C","F-D"] as ZoneId[]) : (["B-A","B-B","B-C","B-D"] as ZoneId[]);

  const statuses = useMemo(() => {
    const r: Record<string, ZoneStatus> = {};
    for (const id of allZoneIds) r[id] = calculateZoneStatus(allReports[id] || []);
    return r;
  }, [allReports, side]);

  useEffect(() => {
    const newShaking = new Set<string>();
    for (const id of allZoneIds) {
      const current = statuses[id]?.congestion || "unknown";
      const prev = prevStatuses.current[id];
      if (prev && prev !== current) newShaking.add(id);
      prevStatuses.current[id] = current;
    }
    if (newShaking.size > 0) { setShakingZones(newShaking); setTimeout(() => setShakingZones(new Set()), 600); }
  }, [statuses, allZoneIds]);

  const bestZone = useMemo(() => findBestZone(statuses, side), [statuses, side]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!lastReportTime) { setCooldown(0); return; }
    const update = () => { const left = Math.max(0, Math.ceil((RATE_LIMIT_MS - (Date.now() - lastReportTime)) / 1000)); setCooldown(left); if (left <= 0 && timerRef.current) clearInterval(timerRef.current); };
    update(); timerRef.current = setInterval(update, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [lastReportTime]);

  const canReport = cooldown <= 0;
  const handleReport = useCallback((score: number) => {
    if (!selectedZone || !canReport) return;
    onReport(selectedZone, score); setShowReportModal(false); setSelectedZone(null);
    if (navigator.vibrate) navigator.vibrate(50);
  }, [selectedZone, canReport, onReport]);

  return (
    <div className="pk-page"><div className="pk-shell">
      <header className="pk-header">
        <div className="pk-header-row">
          <div className="pk-brand"><div className="pk-logo">🅿</div><div className="pk-title">ParkQuick</div></div>
          <button className="pk-theme-btn" onClick={onToggleTheme} title="تغيير المظهر">{theme === "dark" ? "☀️" : "🌙"}</button>
        </div>
        <p className="pk-subtitle">جامعة الملك خالد — مواقف الطلاب</p>
      </header>

      <div className="pk-segment">
        {([{ key: "front" as const, label: "🏫 الأمامية" }, { key: "back" as const, label: "🏗 الخلفية" }]).map(s => (
          <button key={s.key} className={`pk-seg-btn ${side === s.key ? "active" : ""}`} onClick={() => { setSide(s.key); setSelectedZone(null); setShowReportModal(false); }}>{s.label}</button>
        ))}
      </div>

      <div className="pk-legend">
        {[{ c: "var(--green)", l: "متاح" }, { c: "var(--orange)", l: "متوسط" }, { c: "var(--red)", l: "ممتلئ" }, { c: "var(--muted)", l: "لا بيانات" }].map(i => (
          <span className="pk-chip" key={i.l}><span className="pk-dot" style={{ background: i.c }} />{i.l}</span>
        ))}
      </div>

      <div className="pk-map-wrap">
        <MapContainer center={center} zoom={18} maxZoom={20} minZoom={18} zoomControl={false} attributionControl={false} style={{ width: "100%", height: "100%" }}>
          <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" maxZoom={21} subdomains={["mt0","mt1","mt2","mt3"]} />
          <TileLayer url="https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}" maxZoom={21} opacity={0.5} />
          <FlyTo center={center} zoom={18} />
          <ResetButton center={center} zoom={18} />
          {zones.map((z: ZoneDef) => {
            const st = statuses[z.id] || { congestion: "unknown", avgScore: 0 };
            const color = congestionColor(st.congestion); const isSelected = selectedZone === z.id; const isBest = bestZone === z.id;
            return (
              <Polygon key={z.id} positions={z.bounds} pathOptions={{ color, fillColor: color, fillOpacity: isSelected ? 0.45 : 0.25, weight: isSelected ? 4 : isBest ? 3 : 2, dashArray: isBest && !isSelected ? "6 4" : undefined }}
                eventHandlers={{ click: () => { setSelectedZone(z.id); setShowReportModal(false); } }}>
                <Tooltip direction="center" permanent className="pk-zone-tooltip">
                  <span style={{ fontWeight: 800, fontSize: 13 }}>{z.id}</span><br />
                  <span style={{ fontSize: 10 }}>{congestionLabel(st.congestion)}</span>
                </Tooltip>
              </Polygon>
            );
          })}
        </MapContainer>
      </div>

      <button className="pk-navigate-btn" onClick={() => { if (bestZone) setSelectedZone(bestZone); }}>🧭 وجهني لأفضل موقف</button>

      {bestZone && selectedZone === bestZone && (
        <div className="pk-best-banner"><span style={{ fontSize: 20 }}>✨</span><p>أفضل منطقة حاليًا: <strong>{bestZone}</strong> — {congestionLabel(statuses[bestZone]?.congestion || "unknown")}</p></div>
      )}

      {selectedZone && (() => {
        const st = statuses[selectedZone] || { congestion: "unknown", avgScore: 0, reports: [], lastUpdate: null };
        const color = congestionColor(st.congestion); const zd = zones.find(z => z.id === selectedZone); const isShaking = shakingZones.has(selectedZone);
        return (
          <div className={`pk-detail ${isShaking ? "shake" : ""}`} style={{ borderColor: `${color}40` }}>
            <div className="pk-detail-top">
              <div className="pk-detail-left">
                <div className="pk-detail-icon" style={{ background: `${color}20`, borderColor: color }}>{selectedZone}</div>
                <div><h3>{zd?.labelAr || selectedZone} — {side === "front" ? "أمامي" : "خلفي"}</h3><p>{st.reports.length} تقرير{st.lastUpdate ? ` · ${timeAgo(st.lastUpdate)}` : ""}</p></div>
              </div>
              <span className="pk-badge" style={{ background: `${color}18`, color }}>{congestionLabel(st.congestion)}</span>
            </div>
            <div className="pk-bar"><div className="pk-bar-fill" style={{ width: `${st.avgScore}%`, background: color }} /></div>
            <button className="pk-report-btn" disabled={!canReport} onClick={() => setShowReportModal(true)}>
              {canReport ? "📝 أرسل تقرير عن هذه المنطقة" : `⏳ انتظر ${cooldown} ثانية`}
            </button>
            {showReportModal && canReport && (
              <div className="pk-report-modal">
                <p className="pk-report-q">كيف حالة المواقف في {selectedZone}؟</p>
                <div className="pk-report-opts">
                  {[{ s: 15, l: "متاح 🟢", c: "#22c55e", d: "فيه مواقف كثير" }, { s: 50, l: "متوسط 🟠", c: "#f97316", d: "فيه بس قليلة" }, { s: 90, l: "ممتلئ 🔴", c: "#ef4444", d: "ما فيه مواقف" }].map(o => (
                    <button key={o.s} className="pk-report-opt" style={{ borderColor: `${o.c}50`, background: `${o.c}10`, color: o.c }} onClick={() => handleReport(o.s)}>
                      <span>{o.l}</span><small>{o.d}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div className="pk-summary">
        <p className="pk-summary-title">ملخص — {side === "front" ? "الأمامية" : "الخلفية"}</p>
        <div className="pk-summary-grid">
          {allZoneIds.map(id => {
            const st = statuses[id] || { congestion: "unknown", avgScore: 0, reports: [] };
            const color = congestionColor(st.congestion); const isShaking = shakingZones.has(id);
            return (
              <div key={id} className={`pk-summary-item ${selectedZone === id ? "active" : ""} ${isShaking ? "shake" : ""}`} onClick={() => { setSelectedZone(id); setShowReportModal(false); }}>
                <span className="pk-dot" style={{ background: color, boxShadow: `0 0 8px ${color}50` }} />
                <div><strong>{id}</strong><p>{congestionLabel(st.congestion)} · {st.reports.length} تقرير</p></div>
              </div>
            );
          })}
        </div>
      </div>

      <footer className="pk-footer">ParkQuick KKU · بيانات من تقارير الطلاب</footer>
    </div></div>
  );
}
