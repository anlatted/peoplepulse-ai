import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  Users, UserPlus, UserMinus, Activity, ShieldAlert, PieChart as PieIcon,
  LayoutGrid, Search, Sparkles, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Minus,
} from "lucide-react";

import rawEmployees from "./data/employees.json";

/* -------------------------------------------------------------------- */
/*  Data layer — built from the public HRDataset_v14 dataset            */
/* -------------------------------------------------------------------- */

// The dataset's last recorded events fall in Nov 2018, so we treat that
// as "now" for every tenure / headcount-over-time calculation below.
const AS_OF = new Date(2018, 11, 1);

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const monthsBetween = (a, b) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

function computeRisk(e) {
  if (e.terminated) return null;
  const hire = new Date(e.hireDate);
  const tenureMonths = monthsBetween(hire, AS_OF);
  let score = 0;
  score += clamp((3.6 - e.engagementSurvey) * 16, 0, 42);
  score += clamp((3.2 - e.empSatisfaction) * 9, 0, 26);
  if (e.performanceScore === "PIP") score += 24;
  else if (e.performanceScore === "Needs Improvement") score += 14;
  else if (e.performanceScore === "Exceeds") score -= 6;
  if (e.absences >= 15) score += 10;
  if (e.daysLateLast30 > 0) score += 8;
  if (tenureMonths < 6) score += 10;
  if (tenureMonths > 60 && e.performanceScore !== "Exceeds") score += 8;
  score = clamp(Math.round(score), 0, 100);
  const band = score >= 55 ? "High" : score >= 30 ? "Medium" : "Low";
  return { score, band, tenureMonths };
}

function buildDataset() {
  const employees = rawEmployees.map((e) => {
    const hire = new Date(e.hireDate);
    const term = e.termDate ? new Date(e.termDate) : null;
    const tenureMonths = monthsBetween(hire, term || AS_OF);
    return { ...e, hireDateObj: hire, termDateObj: term, tenureMonths };
  }).map((e) => ({ ...e, risk: computeRisk(e) }));

  const years = [];
  for (let y = 2006; y <= 2018; y++) years.push(y);

  const yearlyTrend = years.map((y) => {
    const yearEnd = new Date(y, 11, 31);
    const hires = employees.filter((e) => e.hireDateObj.getFullYear() === y).length;
    const departures = employees.filter((e) => e.termDateObj && e.termDateObj.getFullYear() === y).length;
    const headcount = employees.filter((e) => e.hireDateObj <= yearEnd && (!e.termDateObj || e.termDateObj > yearEnd)).length;
    const activeAtYear = employees.filter((e) => e.hireDateObj <= yearEnd && (!e.termDateObj || e.termDateObj > yearEnd));
    const avgEngagement = activeAtYear.length ? activeAtYear.reduce((s, e) => s + e.engagementSurvey, 0) / activeAtYear.length : null;
    return {
      year: String(y), hires, departures: -departures, departuresAbs: departures,
      headcount, engagement: avgEngagement ? Math.round(avgEngagement * 100) / 100 : null,
    };
  });

  return { employees, yearlyTrend };
}

/* -------------------------------------------------------------------- */
/*  Design tokens & small visual atoms                                  */
/* -------------------------------------------------------------------- */

const COLORS = {
  ink: "#1B2430", paper: "#F4F3EF", paperDim: "#EAE8E1", slate: "#5B6472",
  moss: "#3F6657", mossLight: "#7FA491", amber: "#C97A3B", amberLight: "#E7B98A",
  sky: "#4C7A96", skyLight: "#9CC0D2", danger: "#B24B3C", line: "#D8D5CB",
};
const PIE_COLORS = [COLORS.moss, COLORS.sky, COLORS.amber, COLORS.slate, COLORS.mossLight, COLORS.skyLight];

function PulseDivider({ tone = COLORS.moss, height = 28 }) {
  return (
    <svg viewBox="0 0 400 28" width="100%" height={height} preserveAspectRatio="none" style={{ display: "block" }}>
      <path d="M0 14 L120 14 L138 4 L154 24 L170 14 L400 14" fill="none" stroke={tone}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pp-pulse-path" />
    </svg>
  );
}

function PulseMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="19" fill={COLORS.ink} />
      <path d="M6 20 L14 20 L17 12 L21 28 L24 20 L34 20" fill="none" stroke={COLORS.mossLight}
        strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="pp-pulse-path" />
    </svg>
  );
}

function KpiCard({ icon: Icon, label, value, delta, deltaGood = "up", suffix, deltaLabel = "vs. prior year" }) {
  const positive = delta > 0;
  const isGood = deltaGood === "up" ? positive : !positive;
  const DeltaIcon = delta === 0 ? Minus : positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="pp-kpi">
      <div className="pp-kpi-top">
        <span className="pp-kpi-icon"><Icon size={16} strokeWidth={2} /></span>
        <span className="pp-kpi-label">{label}</span>
      </div>
      <div className="pp-kpi-value">{value}<span className="pp-kpi-suffix">{suffix}</span></div>
      {delta !== undefined && (
        <div className={`pp-kpi-delta ${isGood ? "good" : "bad"}`}>
          <DeltaIcon size={13} /><span>{Math.abs(delta)} {deltaLabel}</span>
        </div>
      )}
    </div>
  );
}

function RiskPill({ band }) {
  const cls = band === "High" ? "high" : band === "Medium" ? "medium" : "low";
  return <span className={`pp-risk-pill ${cls}`}>{band}</span>;
}

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "hiring", label: "Hiring & Attrition", icon: UserPlus },
  { id: "retention", label: "Retention Risk", icon: ShieldAlert },
  { id: "diversity", label: "Diversity & Pay", icon: PieIcon },
  { id: "directory", label: "Directory", icon: Users },
  { id: "reports", label: "Insights Report", icon: Sparkles },
];

/* -------------------------------------------------------------------- */
/*  Main App                                                             */
/* -------------------------------------------------------------------- */

export default function App() {
  const { employees, yearlyTrend } = useMemo(buildDataset, []);
  const [tab, setTab] = useState("overview");

  const active = employees.filter((e) => !e.terminated);
  const headcount = active.length;

  const lastYear = yearlyTrend[yearlyTrend.length - 1];   // 2018 (through Nov)
  const prevYear = yearlyTrend[yearlyTrend.length - 2];   // 2017 (full year)

  const totalDepartures = employees.filter((e) => e.terminated).length;
  const overallAttritionRate = Math.round((totalDepartures / employees.length) * 1000) / 10;
  const prevFullYearAttrition = Math.round((prevYear.departuresAbs / (prevYear.headcount || 1)) * 1000) / 10;
  const lastFullYearAttrition = Math.round((lastYear.departuresAbs / (lastYear.headcount || 1)) * 1000) / 10;

  const avgEngagement = Math.round((active.reduce((s, e) => s + e.engagementSurvey, 0) / headcount) * 100) / 100;
  const avgSatisfaction = Math.round((active.reduce((s, e) => s + e.empSatisfaction, 0) / headcount) * 100) / 100;

  const highRiskCount = active.filter((e) => e.risk.band === "High").length;
  const mediumRiskCount = active.filter((e) => e.risk.band === "Medium").length;
  const lowRiskCount = active.filter((e) => e.risk.band === "Low").length;

  const DEPARTMENTS = [...new Set(employees.map((e) => e.department))];
  const deptCounts = DEPARTMENTS.map((d) => ({
    department: d,
    headcount: active.filter((e) => e.department === d).length,
    highRisk: active.filter((e) => e.department === d && e.risk.band === "High").length,
    femalePct: (() => {
      const grp = active.filter((e) => e.department === d);
      const f = grp.filter((e) => e.sex === "F").length;
      return grp.length ? Math.round((f / grp.length) * 100) : 0;
    })(),
  })).sort((a, b) => b.headcount - a.headcount);

  const genderBreakdown = ["F", "M"].map((g) => ({
    name: g === "F" ? "Female" : "Male",
    value: active.filter((e) => e.sex === g).length,
  }));
  const RACES = [...new Set(employees.map((e) => e.race))];
  const raceBreakdown = RACES.map((r) => ({ name: r, value: active.filter((e) => e.race === r).length })).filter((x) => x.value > 0);

  const femaleAvgSalary = active.filter((e) => e.sex === "F").reduce((s, e) => s + e.salary, 0) / (active.filter((e) => e.sex === "F").length || 1);
  const maleAvgSalary = active.filter((e) => e.sex === "M").reduce((s, e) => s + e.salary, 0) / (active.filter((e) => e.sex === "M").length || 1);
  const payEquityRatio = [
    { name: "Female", avgSalary: Math.round(femaleAvgSalary), ratio: Math.round((femaleAvgSalary / maleAvgSalary) * 1000) / 10 },
    { name: "Male", avgSalary: Math.round(maleAvgSalary), ratio: 100 },
  ];

  const riskiestEmployees = [...active].sort((a, b) => b.risk.score - a.risk.score).slice(0, 12);

  return (
    <div className="pp-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        .pp-app {
          --ink: ${COLORS.ink}; --paper: ${COLORS.paper}; --paper-dim: ${COLORS.paperDim};
          --slate: ${COLORS.slate}; --moss: ${COLORS.moss}; --moss-light: ${COLORS.mossLight};
          --amber: ${COLORS.amber}; --amber-light: ${COLORS.amberLight};
          --sky: ${COLORS.sky}; --sky-light: ${COLORS.skyLight};
          --danger: ${COLORS.danger}; --line: ${COLORS.line};
          font-family: 'Inter', system-ui, sans-serif;
          background: var(--paper); color: var(--ink);
          min-height: 100vh; display: flex; box-sizing: border-box;
        }
        .pp-app *, .pp-app *::before, .pp-app *::after { box-sizing: border-box; }
        .pp-app .mono { font-family: 'IBM Plex Mono', monospace; }
        .pp-app h1, .pp-app h2, .pp-app h3 { font-family: 'Fraunces', serif; margin: 0; letter-spacing: -0.01em; }

        @media (prefers-reduced-motion: no-preference) {
          .pp-pulse-path { stroke-dasharray: 340; stroke-dashoffset: 340; animation: pp-draw 2.6s ease-out forwards; }
        }
        @keyframes pp-draw { to { stroke-dashoffset: 0; } }

        .pp-sidebar { width: 226px; flex-shrink: 0; background: var(--ink); color: var(--paper); display: flex; flex-direction: column; padding: 20px 14px; }
        .pp-brand { display: flex; align-items: center; gap: 10px; padding: 6px 8px 20px; }
        .pp-brand-text { font-family: 'Fraunces', serif; font-weight: 600; font-size: 16.5px; line-height: 1.15; }
        .pp-brand-sub { font-size: 10.5px; color: var(--moss-light); letter-spacing: 0.06em; text-transform: uppercase; margin-top: 2px; }
        .pp-nav { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; }
        .pp-nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; background: transparent; border: none; color: #C7CCD3; font-size: 13.5px; font-weight: 500; cursor: pointer; text-align: left; font-family: inherit; transition: background .15s, color .15s; }
        .pp-nav-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
        .pp-nav-item.active { background: var(--moss); color: #fff; }
        .pp-nav-footer { margin-top: auto; padding: 14px 10px 4px; font-size: 11px; color: #7C8592; border-top: 1px solid rgba(255,255,255,0.08); }
        .pp-nav-footer a { color: #9CC0D2; text-decoration: none; }
        .pp-nav-footer a:hover { text-decoration: underline; }

        .pp-main { flex: 1; min-width: 0; padding: 26px 34px 60px; }
        .pp-topbar { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 18px; flex-wrap: wrap; gap: 12px; }
        .pp-eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--slate); font-weight: 600; margin-bottom: 4px; }
        .pp-title { font-size: 26px; font-weight: 600; }
        .pp-subtext { color: var(--slate); font-size: 13px; margin-top: 6px; max-width: 640px; }
        .pp-range { font-size: 12px; color: var(--slate); background: #fff; border: 1px solid var(--line); padding: 7px 12px; border-radius: 8px; white-space: nowrap; }

        .pp-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 22px; }
        .pp-kpi { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; }
        .pp-kpi-top { display: flex; align-items: center; gap: 7px; color: var(--slate); margin-bottom: 10px; }
        .pp-kpi-icon { display: inline-flex; color: var(--moss); }
        .pp-kpi-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
        .pp-kpi-value { font-family: 'IBM Plex Mono', monospace; font-size: 27px; font-weight: 600; }
        .pp-kpi-suffix { font-size: 15px; color: var(--slate); margin-left: 2px; }
        .pp-kpi-delta { display: flex; align-items: center; gap: 3px; font-size: 11.5px; margin-top: 8px; color: var(--slate); }
        .pp-kpi-delta.good { color: var(--moss); }
        .pp-kpi-delta.bad { color: var(--danger); }

        .pp-panel { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px 12px; margin-bottom: 18px; }
        .pp-panel-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
        .pp-panel-title { font-size: 14.5px; font-weight: 600; font-family: 'Fraunces', serif; }
        .pp-panel-note { font-size: 11.5px; color: var(--slate); }

        .pp-grid-2 { display: grid; grid-template-columns: 1.4fr 1fr; gap: 18px; }
        .pp-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }

        .pp-risk-pill { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 99px; text-transform: uppercase; letter-spacing: .02em; }
        .pp-risk-pill.high { background: #F4E1DB; color: var(--danger); }
        .pp-risk-pill.medium { background: #F3E7D3; color: #97621F; }
        .pp-risk-pill.low { background: #E1EBE4; color: var(--moss); }

        table.pp-table { width: 100%; border-collapse: collapse; font-size: 12.8px; }
        table.pp-table th { text-align: left; font-size: 10.8px; text-transform: uppercase; letter-spacing: .04em; color: var(--slate); padding: 8px 10px; border-bottom: 1px solid var(--line); font-weight: 600; }
        table.pp-table td { padding: 9px 10px; border-bottom: 1px solid var(--paper-dim); }
        table.pp-table tr:hover td { background: var(--paper-dim); }

        .pp-search { display: flex; align-items: center; gap: 8px; background: var(--paper); border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; }
        .pp-search input { border: none; background: transparent; outline: none; font-size: 13px; font-family: inherit; width: 100%; }
        .pp-select { border: 1px solid var(--line); background: #fff; border-radius: 8px; padding: 7px 10px; font-size: 12.5px; font-family: inherit; color: var(--ink); }
        .pp-filters { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }

        .pp-btn { display: inline-flex; align-items: center; gap: 8px; background: var(--ink); color: #fff; border: none; padding: 11px 18px; border-radius: 9px; font-size: 13.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .pp-btn:disabled { opacity: 0.55; cursor: default; }
        .pp-btn:hover:not(:disabled) { background: var(--moss); }

        .pp-report { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 26px 30px; line-height: 1.65; font-size: 14px; }
        .pp-report h4 { font-family: 'Fraunces', serif; font-size: 16px; margin: 18px 0 8px; color: var(--ink); }
        .pp-report h4:first-child { margin-top: 0; }
        .pp-report ul { margin: 6px 0 14px; padding-left: 20px; }
        .pp-report li { margin-bottom: 5px; }
        .pp-report p { margin: 0 0 12px; color: #333; }
        .pp-empty { text-align: center; padding: 50px 20px; color: var(--slate); }
        .pp-note-box { display: flex; gap: 10px; align-items: flex-start; background: var(--paper-dim); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; font-size: 12px; color: var(--slate); margin-bottom: 16px; }

        @media (max-width: 980px) {
          .pp-app { flex-direction: column; }
          .pp-sidebar { width: 100%; flex-direction: row; overflow-x: auto; padding: 12px; }
          .pp-nav { flex-direction: row; }
          .pp-nav-footer { display: none; }
          .pp-brand { padding-bottom: 0; }
          .pp-kpi-grid, .pp-grid-3 { grid-template-columns: repeat(2, 1fr); }
          .pp-grid-2 { grid-template-columns: 1fr; }
          .pp-main { padding: 18px; }
        }
        @media (max-width: 560px) {
          .pp-kpi-grid, .pp-grid-3 { grid-template-columns: 1fr; }
        }
      `}</style>

      <aside className="pp-sidebar">
        <div className="pp-brand">
          <PulseMark />
          <div>
            <div className="pp-brand-text">PeoplePulse AI</div>
            <div className="pp-brand-sub">People Analytics</div>
          </div>
        </div>
        <nav className="pp-nav">
          {NAV.map((item) => (
            <button key={item.id} className={`pp-nav-item ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}>
              <item.icon size={16} />{item.label}
            </button>
          ))}
        </nav>
        <div className="pp-nav-footer">
          <div>{employees.length} employee records · HRDataset_v14</div>
          <div style={{ marginTop: 4 }}>Data as of Nov 2018</div>
        </div>
      </aside>

      <main className="pp-main">
        {tab === "overview" && (
          <OverviewTab
            headcount={headcount} lastYear={lastYear} prevYear={prevYear}
            overallAttritionRate={overallAttritionRate}
            lastFullYearAttrition={lastFullYearAttrition} prevFullYearAttrition={prevFullYearAttrition}
            avgEngagement={avgEngagement} highRiskCount={highRiskCount}
            yearlyTrend={yearlyTrend} deptCounts={deptCounts}
          />
        )}
        {tab === "hiring" && <HiringTab yearlyTrend={yearlyTrend} deptCounts={deptCounts} />}
        {tab === "retention" && (
          <RetentionTab
            highRiskCount={highRiskCount} mediumRiskCount={mediumRiskCount} lowRiskCount={lowRiskCount}
            riskiestEmployees={riskiestEmployees} deptCounts={deptCounts}
          />
        )}
        {tab === "diversity" && (
          <DiversityTab
            genderBreakdown={genderBreakdown} raceBreakdown={raceBreakdown}
            payEquityRatio={payEquityRatio} deptCounts={deptCounts}
          />
        )}
        {tab === "directory" && <DirectoryTab employees={employees} departments={DEPARTMENTS} />}
        {tab === "reports" && (
          <ReportsTab
            stats={{
              headcount, totalEmployees: employees.length, totalDepartures, overallAttritionRate,
              lastFullYearAttrition, avgEngagement, avgSatisfaction,
              highRiskCount, mediumRiskCount, lowRiskCount, deptCounts, payEquityRatio,
              riskiestEmployees,
            }}
          />
        )}
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  Tabs                                                                 */
/* -------------------------------------------------------------------- */

function PageHeader({ eyebrow, title, sub }) {
  return (
    <div className="pp-topbar">
      <div>
        <div className="pp-eyebrow">{eyebrow}</div>
        <h1 className="pp-title">{title}</h1>
        {sub && <div className="pp-subtext">{sub}</div>}
      </div>
      <div className="pp-range mono">2006 – Nov 2018</div>
    </div>
  );
}

function OverviewTab({ headcount, lastYear, prevYear, overallAttritionRate, lastFullYearAttrition, prevFullYearAttrition, avgEngagement, highRiskCount, yearlyTrend, deptCounts }) {
  return (
    <>
      <PageHeader eyebrow="Workforce Overview" title="How the organization is doing, at a glance"
        sub="Built on the public HRDataset_v14 dataset (311 employees, 2006–2018). Headcount, hiring, attrition, and engagement over the full history on record." />
      <PulseDivider />
      <div className="pp-kpi-grid" style={{ marginTop: 18 }}>
        <KpiCard icon={Users} label="Active Headcount" value={headcount} />
        <KpiCard icon={UserPlus} label="Hires (2018 YTD)" value={lastYear.hires} delta={lastYear.hires - prevYear.hires} deltaGood="up" deltaLabel="vs. 2017" />
        <KpiCard icon={UserMinus} label="Attrition Rate (all-time)" value={overallAttritionRate} suffix="%" delta={Math.round((lastFullYearAttrition - prevFullYearAttrition) * 10) / 10} deltaGood="down" deltaLabel="YoY (2018 vs 2017)" />
        <KpiCard icon={Activity} label="Avg. Engagement" value={avgEngagement} suffix="/5" delta={Math.round((lastYear.engagement - prevYear.engagement) * 100) / 100} deltaGood="up" deltaLabel="vs. 2017" />
      </div>

      <div className="pp-grid-2">
        <div className="pp-panel">
          <div className="pp-panel-head">
            <span className="pp-panel-title">Headcount over time</span>
            <span className="pp-panel-note">year-end active headcount, 2006–2018</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={yearlyTrend} margin={{ left: -18, right: 8, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="hc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.moss} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={COLORS.moss} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
              <YAxis tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={false} tickLine={false} width={34} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
              <Area type="monotone" dataKey="headcount" stroke={COLORS.moss} strokeWidth={2} fill="url(#hc)" name="Headcount" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="pp-panel">
          <div className="pp-panel-head"><span className="pp-panel-title">Headcount by department</span></div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={deptCounts} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.line} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="department" tick={{ fontSize: 10.8, fill: COLORS.ink }} width={110} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
              <Bar dataKey="headcount" fill={COLORS.sky} radius={[0, 5, 5, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="pp-panel">
        <div className="pp-panel-head">
          <span className="pp-panel-title">Engagement over time</span>
          <span className="pp-panel-note">org-wide average survey score, 1–5</span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={yearlyTrend} margin={{ left: -18, right: 8, top: 4, bottom: 0 }}>
            <CartesianGrid stroke={COLORS.line} vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
            <YAxis domain={[1, 5]} tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={false} tickLine={false} width={26} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
            <Line type="monotone" dataKey="engagement" stroke={COLORS.amber} strokeWidth={2.4} dot={false} name="Engagement" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {highRiskCount > 0 && (
        <div className="pp-panel" style={{ display: "flex", alignItems: "center", gap: 12, borderColor: COLORS.amber }}>
          <AlertTriangle size={20} color={COLORS.danger} />
          <div style={{ fontSize: 13.5 }}>
            <strong>{highRiskCount} employees</strong> currently sit in the high attrition-risk band. Open the <strong>Retention Risk</strong> tab to see who, and why.
          </div>
        </div>
      )}
    </>
  );
}

function HiringTab({ yearlyTrend, deptCounts }) {
  return (
    <>
      <PageHeader eyebrow="Hiring & Attrition" title="Flow of people in and out of the org" sub="Yearly hires versus departures across the full 2006–2018 history, and where attrition concentrates by department." />
      <PulseDivider tone={COLORS.sky} />
      <div className="pp-panel" style={{ marginTop: 18 }}>
        <div className="pp-panel-head">
          <span className="pp-panel-title">Hires vs. departures</span>
          <span className="pp-panel-note">by year</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={yearlyTrend} margin={{ left: -18, right: 8, top: 4, bottom: 0 }} stackOffset="sign">
            <CartesianGrid stroke={COLORS.line} vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
            <YAxis tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="hires" name="Hires" fill={COLORS.moss} radius={[3, 3, 0, 0]} />
            <Bar dataKey="departures" name="Departures" fill={COLORS.danger} radius={[0, 0, 3, 3]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="pp-panel">
        <div className="pp-panel-head"><span className="pp-panel-title">Headcount &amp; risk concentration by department</span></div>
        <table className="pp-table">
          <thead><tr><th>Department</th><th>Active headcount</th><th>High-risk employees</th><th>Share at risk</th></tr></thead>
          <tbody>
            {deptCounts.map((d) => (
              <tr key={d.department}>
                <td>{d.department}</td>
                <td className="mono">{d.headcount}</td>
                <td className="mono">{d.highRisk}</td>
                <td className="mono">{d.headcount ? Math.round((d.highRisk / d.headcount) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RetentionTab({ highRiskCount, mediumRiskCount, lowRiskCount, riskiestEmployees, deptCounts }) {
  const pieData = [{ name: "High", value: highRiskCount }, { name: "Medium", value: mediumRiskCount }, { name: "Low", value: lowRiskCount }];
  const riskColors = { High: COLORS.danger, Medium: COLORS.amber, Low: COLORS.moss };
  return (
    <>
      <PageHeader eyebrow="Predictive Analytics" title="Who's most likely to leave next" sub="A transparent, rule-based risk score built from engagement survey results, satisfaction, performance rating, attendance, and tenure." />
      <PulseDivider tone={COLORS.amber} />
      <div className="pp-grid-2" style={{ marginTop: 18 }}>
        <div className="pp-panel">
          <div className="pp-panel-head"><span className="pp-panel-title">Highest-risk employees</span></div>
          <table className="pp-table">
            <thead><tr><th>Employee</th><th>Dept.</th><th>Tenure</th><th>Engagement</th><th>Risk</th></tr></thead>
            <tbody>
              {riskiestEmployees.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}<span style={{ color: COLORS.slate }}> · {e.position}</span></td>
                  <td>{e.department}</td>
                  <td className="mono">{e.tenureMonths}mo</td>
                  <td className="mono">{e.engagementSurvey}</td>
                  <td><RiskPill band={e.risk.band} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pp-panel">
          <div className="pp-panel-head"><span className="pp-panel-title">Risk distribution</span></div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3}>
                {pieData.map((entry) => <Cell key={entry.name} fill={riskColors[entry.name]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 10 }}>
            <div className="pp-panel-title" style={{ fontSize: 13, marginBottom: 8 }}>High-risk concentration by department</div>
            {deptCounts.filter((d) => d.highRisk > 0).sort((a, b) => b.highRisk - a.highRisk).map((d) => (
              <div key={d.department} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0", borderBottom: `1px solid ${COLORS.paperDim}` }}>
                <span>{d.department}</span><span className="mono">{d.highRisk}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function DiversityTab({ genderBreakdown, raceBreakdown, payEquityRatio, deptCounts }) {
  return (
    <>
      <PageHeader eyebrow="Diversity, Inclusion & Pay" title="Composition and pay equity across the workforce" sub="Demographic mix and average-salary ratios, computed directly from HR records." />
      <PulseDivider tone={COLORS.slate} />
      <div className="pp-grid-3" style={{ marginTop: 18 }}>
        <div className="pp-panel">
          <div className="pp-panel-head"><span className="pp-panel-title">Gender mix</span></div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={genderBreakdown} dataKey="value" nameKey="name" innerRadius={44} outerRadius={76} paddingAngle={3}>
                {genderBreakdown.map((e, i) => <Cell key={e.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
              <Legend wrapperStyle={{ fontSize: 11.5 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="pp-panel">
          <div className="pp-panel-head"><span className="pp-panel-title">Race / ethnicity mix</span></div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={raceBreakdown} dataKey="value" nameKey="name" innerRadius={44} outerRadius={76} paddingAngle={3}>
                {raceBreakdown.map((e, i) => <Cell key={e.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="pp-panel">
          <div className="pp-panel-head"><span className="pp-panel-title">Pay equity ratio</span></div>
          <span className="pp-panel-note">avg. salary as % of male average</span>
          <div style={{ marginTop: 14 }}>
            {payEquityRatio.map((g) => (
              <div key={g.name} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                  <span>{g.name}</span><span className="mono">{g.ratio}%</span>
                </div>
                <div style={{ background: COLORS.paperDim, borderRadius: 6, height: 8 }}>
                  <div style={{ width: `${Math.min(g.ratio, 100)}%`, background: g.ratio >= 98 ? COLORS.moss : COLORS.amber, height: 8, borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pp-panel">
        <div className="pp-panel-head">
          <span className="pp-panel-title">Female representation by department</span>
          <span className="pp-panel-note">a common lens for spotting concentration in the workforce mix</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={deptCounts} margin={{ left: -18, right: 8, top: 4, bottom: 0 }}>
            <CartesianGrid stroke={COLORS.line} vertical={false} />
            <XAxis dataKey="department" tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={50} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={false} tickLine={false} width={32} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} formatter={(v) => `${v}%`} />
            <Bar dataKey="femalePct" fill={COLORS.moss} radius={[4, 4, 0, 0]} name="% Female" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function DirectoryTab({ employees, departments }) {
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("All");
  const [status, setStatus] = useState("Active");

  const filtered = employees.filter((e) => {
    if (dept !== "All" && e.department !== dept) return false;
    if (status === "Active" && e.terminated) return false;
    if (status === "Departed" && !e.terminated) return false;
    if (query && !e.name.toLowerCase().includes(query.toLowerCase()) && !e.id.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }).slice(0, 60);

  return (
    <>
      <PageHeader eyebrow="Employee Directory" title="Search and filter the workforce" sub="Showing up to 60 matching records." />
      <PulseDivider tone={COLORS.moss} />
      <div className="pp-filters" style={{ marginTop: 18 }}>
        <div className="pp-search" style={{ maxWidth: 260 }}>
          <Search size={15} color={COLORS.slate} />
          <input placeholder="Search name or ID…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="pp-select" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option>All</option>
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select className="pp-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option>Active</option><option>Departed</option><option>All</option>
        </select>
      </div>
      <div className="pp-panel" style={{ padding: 0, overflowX: "auto" }}>
        <table className="pp-table">
          <thead>
            <tr>
              <th>ID</th><th>Name</th><th>Department</th><th>Position</th><th>Tenure</th>
              <th>Engagement</th><th>Salary</th><th>Status</th><th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}>
                <td className="mono" style={{ color: COLORS.slate }}>{e.id}</td>
                <td>{e.name}</td>
                <td>{e.department}</td>
                <td>{e.position}</td>
                <td className="mono">{e.tenureMonths}mo</td>
                <td className="mono">{e.engagementSurvey}</td>
                <td className="mono">${e.salary.toLocaleString()}</td>
                <td>{e.terminated ? `Departed (${e.termReason})` : "Active"}</td>
                <td>{e.risk ? <RiskPill band={e.risk.band} /> : <span style={{ color: COLORS.slate }}>—</span>}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={9} className="pp-empty">No employees match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------- */
/*  Insights Report tab — local, rule-based NLG                         */
/*  (No external API calls, so this works on static hosting like        */
/*  GitHub Pages with zero configuration. See README for wiring up a    */
/*  live LLM call via your own serverless function instead.)            */
/* -------------------------------------------------------------------- */

function renderReport(text) {
  const lines = text.split("\n");
  const blocks = [];
  let listBuf = [];
  const flushList = () => {
    if (listBuf.length) { blocks.push(<ul key={blocks.length}>{listBuf.map((li, i) => <li key={i}>{li}</li>)}</ul>); listBuf = []; }
  };
  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) { flushList(); return; }
    if (/^#{1,4}\s/.test(line)) { flushList(); blocks.push(<h4 key={blocks.length}>{line.replace(/^#{1,4}\s/, "")}</h4>); return; }
    if (/^[-*]\s/.test(line)) { listBuf.push(line.replace(/^[-*]\s/, "")); return; }
    flushList();
    blocks.push(<p key={blocks.length}>{line}</p>);
  });
  flushList();
  return blocks;
}

function generateLocalReport(stats, focus) {
  const s = stats;
  const topRiskDept = [...s.deptCounts].sort((a, b) => b.highRisk - a.highRisk)[0];
  const biggestDept = [...s.deptCounts].sort((a, b) => b.headcount - a.headcount)[0];
  const payGap = s.payEquityRatio.find((g) => g.name === "Female");
  const pieces = { summary: "", findings: [], recommendations: [] };

  if (focus === "Attrition risk") {
    pieces.summary = `${s.highRiskCount} of ${s.headcount} active employees (${Math.round((s.highRiskCount / s.headcount) * 100)}%) currently sit in the high attrition-risk band, driven primarily by low engagement and satisfaction scores rather than performance issues.`;
    pieces.findings = [
      `${s.highRiskCount} employees are High risk, ${s.mediumRiskCount} Medium, and ${s.lowRiskCount} Low, out of ${s.headcount} active employees.`,
      `${topRiskDept.department} carries the largest concentration of high-risk employees (${topRiskDept.highRisk} of ${topRiskDept.headcount} active staff).`,
      `Average engagement across the active workforce is ${s.avgEngagement}/5 and average satisfaction is ${s.avgSatisfaction}/5.`,
      `The all-time attrition rate across the full dataset is ${s.overallAttritionRate}% (${s.totalDepartures} departures out of ${s.totalEmployees} employees ever recorded).`,
    ];
    pieces.recommendations = [
      `Prioritize stay conversations with the ${s.highRiskCount} employees flagged High risk, starting in ${topRiskDept.department}.`,
      "Run a focused pulse survey in low-engagement pockets to diagnose root causes before they convert to resignations.",
      "Review workload and recognition practices for tenured employees flagged at risk despite solid performance ratings.",
    ];
  } else if (focus === "Diversity & pay equity") {
    pieces.summary = `Women earn an average of ${payGap.ratio}% of what men earn across the organization, and representation varies notably by department.`;
    pieces.findings = [
      `Average female salary is ${payGap.ratio}% of the average male salary company-wide.`,
      `${s.deptCounts.slice().sort((a, b) => a.femalePct - b.femalePct)[0].department} has the lowest female representation at ${s.deptCounts.slice().sort((a, b) => a.femalePct - b.femalePct)[0].femalePct}%.`,
      `${s.deptCounts.slice().sort((a, b) => b.femalePct - a.femalePct)[0].department} has the highest female representation at ${s.deptCounts.slice().sort((a, b) => b.femalePct - a.femalePct)[0].femalePct}%.`,
    ];
    pieces.recommendations = [
      "Audit compensation bands by role and level to identify whether the pay gap persists after controlling for tenure and title.",
      "Set representation targets for departments with the widest gender imbalance and track them quarterly.",
      "Include pay equity as a standing line item in the next compensation review cycle.",
    ];
  } else if (focus === "Hiring momentum") {
    pieces.summary = `${biggestDept.department} is the largest department at ${biggestDept.headcount} active employees, and hiring activity has varied significantly year over year across the dataset's 2006–2018 span.`;
    pieces.findings = [
      `${biggestDept.department} accounts for the largest share of active headcount (${biggestDept.headcount} employees).`,
      `The overall attrition rate across the dataset's full history is ${s.overallAttritionRate}%.`,
      `Active headcount currently stands at ${s.headcount} employees.`,
    ];
    pieces.recommendations = [
      "Build department-level hiring plans informed by historical attrition rather than headcount targets alone.",
      "Track time-to-fill against past hiring waves to catch slowdowns earlier.",
      "Pair new hiring pushes with onboarding support, since early tenure is one of the strongest risk signals in this data.",
    ];
  } else {
    pieces.summary = `The organization has ${s.headcount} active employees with an all-time attrition rate of ${s.overallAttritionRate}%. Engagement sits at ${s.avgEngagement}/5, and ${s.highRiskCount} employees currently show elevated attrition risk.`;
    pieces.findings = [
      `Active headcount: ${s.headcount}, out of ${s.totalEmployees} employees ever recorded in the dataset.`,
      `All-time attrition rate: ${s.overallAttritionRate}% (${s.totalDepartures} total departures).`,
      `Average engagement: ${s.avgEngagement}/5; average satisfaction: ${s.avgSatisfaction}/5.`,
      `${s.highRiskCount} employees (${Math.round((s.highRiskCount / s.headcount) * 100)}%) are flagged High risk for attrition, concentrated most heavily in ${topRiskDept.department}.`,
      `Average female salary sits at ${payGap.ratio}% of the average male salary.`,
    ];
    pieces.recommendations = [
      `Address retention in ${topRiskDept.department} first — it holds the largest share of high-risk employees.`,
      "Investigate the drivers behind the current pay equity ratio before the next compensation cycle.",
      "Keep monitoring engagement trends over time; it's the strongest single signal in the current risk model.",
    ];
  }

  return `## Summary\n${pieces.summary}\n\n## Key Findings\n${pieces.findings.map((f) => `- ${f}`).join("\n")}\n\n## Recommendations\n${pieces.recommendations.map((r) => `- ${r}`).join("\n")}`;
}

function ReportsTab({ stats }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState("");
  const [focus, setFocus] = useState("General health check");
  const focusOptions = ["General health check", "Attrition risk", "Diversity & pay equity", "Hiring momentum"];

  function generateReport() {
    setLoading(true);
    setReport("");
    // Small delay purely for a smoother UI transition — generation itself is instant.
    setTimeout(() => {
      setReport(generateLocalReport(stats, focus));
      setLoading(false);
    }, 400);
  }

  return (
    <>
      <PageHeader eyebrow="Insights Report" title="Turn this dataset into a written brief" sub="A rule-based insight engine reads the current dashboard numbers and drafts an executive summary — no external API calls, so it works anywhere this site is hosted." />
      <PulseDivider tone={COLORS.amber} />

      <div className="pp-note-box" style={{ marginTop: 18 }}>
        <Sparkles size={15} style={{ marginTop: 2, flexShrink: 0 }} />
        <span>This report is generated locally in your browser from the numbers already on this dashboard — it isn't calling an external AI model. See the README for how to wire this tab up to a live Claude API call via your own serverless function.</span>
      </div>

      <div className="pp-panel" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Report focus:</div>
        <select className="pp-select" value={focus} onChange={(e) => setFocus(e.target.value)}>
          {focusOptions.map((o) => <option key={o}>{o}</option>)}
        </select>
        <button className="pp-btn" onClick={generateReport} disabled={loading}>
          <Sparkles size={15} />{loading ? "Generating…" : "Generate report"}
        </button>
      </div>

      {!report && !loading && (
        <div className="pp-report pp-empty">
          <Sparkles size={22} color={COLORS.slate} />
          <div style={{ marginTop: 10 }}>Pick a focus area and generate your first report.</div>
        </div>
      )}
      {loading && <div className="pp-report pp-empty">Reading the current dashboard snapshot…</div>}
      {report && !loading && <div className="pp-report">{renderReport(report)}</div>}
    </>
  );
}
