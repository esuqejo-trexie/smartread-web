"use client";

import { useEffect, useMemo, useState } from "react";
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

function IconUsers(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      {...props}
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconClasses(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      {...props}
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function IconInvite(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      {...props}
    >
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="16" y1="11" x2="22" y2="11" />
    </svg>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 shadow-xl rounded-xl px-4 py-2.5 text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function TeacherDashboardPage() {
  const [teacher, setTeacher] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [classList, setClassList] = useState<any[]>([]);
  const [allLearners, setAllLearners] = useState<any[]>([]);
  const [classData, setClassData] = useState<any[]>([]);
  const [sessionData, setSessionData] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState("ALL");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      setTeacher(snap.data());
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!teacher?.schoolId) return;
    const classesRef = query(
      collection(db, "schools", teacher.schoolId, "classes"),
      where("teacherId", "==", auth.currentUser?.uid),
    );

    const unsubscribe = onSnapshot(classesRef, async (classesSnap) => {
      let learnersAll: any[] = [];
      let learnersWithSessions: any[] = [];
      let allSessions: any[] = [];
      let classes: any[] = [];

      for (const classDoc of classesSnap.docs) {
        const classId = classDoc.id;
        const className = classDoc.data().name;
        classes.push({ id: classId, name: className });

        const learnersRef = collection(
          db,
          "schools",
          teacher.schoolId,
          "classes",
          classId,
          "learners",
        );
        const learnersSnap = await new Promise<any>((resolve) =>
          onSnapshot(learnersRef, resolve),
        );

        for (const learnerDoc of learnersSnap.docs) {
          learnersAll.push({
            classId,
            id: learnerDoc.id,
            ...learnerDoc.data(),
          });

          const sessionsRef = collection(
            db,
            "schools",
            teacher.schoolId,
            "classes",
            classId,
            "learners",
            learnerDoc.id,
            "readingSessions",
          );
          const sessionsSnap = await new Promise<any>((resolve) =>
            onSnapshot(
              query(sessionsRef, orderBy("createdAt", "desc"), limit(5)),
              resolve,
            ),
          );

          const sessions = sessionsSnap.docs.map((d: any) => d.data());
          if (sessions.length > 0) {
            learnersWithSessions.push({
              classId,
              profile: sessions[0].profile,
              finalScore: sessions[0].finalScore ?? 0,
            });
            sessions.forEach((s: any) => {
              allSessions.push({
                classId,
                createdAt: s.createdAt?.toDate?.() || new Date(),
                score: s.finalScore ?? 0,
                pronunciation: s.pronunciationScore || 0,
                fluency: s.fluencyScore || 0,
              });
            });
          }
        }
      }

      setClassList(classes);
      setAllLearners(learnersAll);
      setClassData(learnersWithSessions);
      setSessionData(allSessions);
    });

    return () => unsubscribe();
  }, [teacher]);

  const filteredAll =
    selectedClass === "ALL"
      ? allLearners
      : allLearners.filter((l) => l.classId === selectedClass);
  const filteredSessions =
    selectedClass === "ALL"
      ? sessionData
      : sessionData.filter((s) => s.classId === selectedClass);
  const filteredActive =
    selectedClass === "ALL"
      ? classData
      : classData.filter((l) => l.classId === selectedClass);

  const stats = useMemo(() => {
    const distribution = [
      { name: "Emerging - Spark", value: 0, color: "#fbbf24" },
      { name: "Developing - Ember", value: 0, color: "#f97316" },
    ];
    filteredActive.forEach((d) => {
      if (d.profile === "Emerging") distribution[0].value++;
      else if (d.profile === "Developing") distribution[1].value++;
    });

    const trendMap: Record<string, number[]> = {};
    filteredSessions.forEach((s) => {
      const date = s.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (!trendMap[date]) trendMap[date] = [];
      trendMap[date].push(s.score);
    });
    const trend = Object.entries(trendMap)
      .map(([date, scores]) => ({
        label: date,
        score: parseFloat(
          (scores.reduce((sum, v) => sum + v, 0) / scores.length).toFixed(1),
        ),
      }))
      .slice(-7);

    const avgPron = parseFloat(
      (
        filteredSessions.reduce((sum, s) => sum + s.pronunciation, 0) /
        (filteredSessions.length || 1)
      ).toFixed(1),
    );
    const avgFlu = parseFloat(
      (
        filteredSessions.reduce((sum, s) => sum + s.fluency, 0) /
        (filteredSessions.length || 1)
      ).toFixed(1),
    );

    return {
      totalClasses: classList.length,
      invited: filteredAll.filter((l) => l.status === "Invited").length,
      active: filteredActive.length,
      distribution,
      trend,
      avgPron,
      avgFlu,
    };
  }, [filteredAll, filteredSessions, filteredActive, classList]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#ff6e61] border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-medium">
            Loading dashboard…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-[#faf9f7]/90 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
            Overview
          </p>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">
            Dashboard
          </h1>
        </div>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#ff6e61]/30 focus:border-[#ff6e61] cursor-pointer"
        >
          <option value="ALL">All Classes</option>
          {classList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="p-6 space-y-5">
        {/* KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard
            icon={<IconClasses className="w-5 h-5 text-[#ff6e61]" />}
            label="Total Classes"
            value={stats.totalClasses}
            bg="#ff6e61"
          />
          <KPICard
            icon={<IconUsers className="w-5 h-5 text-emerald-500" />}
            label="Active Learners"
            value={stats.active}
            bg="#10b981"
          />
          <KPICard
            icon={<IconInvite className="w-5 h-5 text-amber-500" />}
            label="Invited (Pending)"
            value={stats.invited}
            bg="#f59e0b"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Reading Profile Distribution"
            description="Learners distributed across reading level tiers"
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={stats.distribution}
                barSize={32}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#64748b", fontSize: 12, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "#f8fafc" }}
                />
                <Bar dataKey="value" name="Learners" radius={[6, 6, 0, 0]}>
                  {stats.distribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Reading Quality"
            description="Average pronunciation vs fluency scores"
          >
            <div className="flex items-center h-[220px]">
              <ResponsiveContainer width="60%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Pronunciation", value: stats.avgPron },
                      { name: "Fluency", value: stats.avgFlu },
                    ]}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={4}
                  >
                    <Cell fill="#ff6e61" />
                    <Cell fill="#10b981" />
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-5 flex-1">
                <ScoreLegend
                  color="#ff6e61"
                  label="Pronunciation"
                  value={stats.avgPron}
                />
                <ScoreLegend
                  color="#10b981"
                  label="Fluency"
                  value={stats.avgFlu}
                />
              </div>
            </div>
          </ChartCard>
        </div>

        {/* Trend */}
        <ChartCard
          title="Class Average Reading Progress"
          description="7-day rolling average score across all learner sessions"
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={stats.trend}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="score"
                name="Avg Score"
                stroke="#ff6e61"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#ff6e61", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#ff6e61", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function KPICard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 flex items-center gap-4">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${bg}18` }}
      >
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-2xl font-bold text-slate-800 leading-tight">
          {value}
        </p>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100">
      <h2 className="font-semibold text-slate-800 text-sm">{title}</h2>
      <p className="text-[11px] text-slate-400 mt-0.5 mb-4">{description}</p>
      {children}
    </div>
  );
}

function ScoreLegend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-0.5">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs text-slate-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800 pl-4">{value}</p>
    </div>
  );
}
