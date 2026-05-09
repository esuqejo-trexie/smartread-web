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
  Legend,
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
              query(sessionsRef, orderBy("createdAt", "desc"), limit(50)),
              resolve,
            ),
          );

          const sessions = sessionsSnap.docs.map((d: any) => d.data());
          sessions.forEach((s: any) => {
            allSessions.push({
              classId,
              learnerId: learnerDoc.id,
              learnerName: learnerDoc.data().name,
              createdAt: s.createdAt?.toDate?.() || new Date(),
              accuracyScore: s.accuracyScore || s.pronunciationScore || 0,
              completenessScore: s.completenessScore || 0,
              fluencyScore: s.fluencyScore || 0,
              finalScore: s.finalScore ?? 0,
            });
          });
        }
      }

      setClassList(classes);
      setAllLearners(learnersAll);
      setSessionData(allSessions);
    });

    return () => unsubscribe();
  }, [teacher]);

  const filteredSessions =
    selectedClass === "ALL"
      ? sessionData
      : sessionData.filter((s) => s.classId === selectedClass);

  const filteredAll =
    selectedClass === "ALL"
      ? allLearners
      : allLearners.filter((l) => l.classId === selectedClass);

  // Compute aggregated data for graphs (grouped by date)
  const aggregatedData = useMemo(() => {
    // Group sessions by date
    const dateMap: Record<
      string,
      {
        accuracySum: number;
        completenessSum: number;
        fluencySum: number;
        count: number;
        date: Date;
      }
    > = {};

    filteredSessions.forEach((s) => {
      const dateKey = s.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const fullDate = s.createdAt;

      if (!dateMap[dateKey]) {
        dateMap[dateKey] = {
          accuracySum: 0,
          completenessSum: 0,
          fluencySum: 0,
          count: 0,
          date: fullDate,
        };
      }

      dateMap[dateKey].accuracySum += s.accuracyScore;
      dateMap[dateKey].completenessSum += s.completenessScore;
      dateMap[dateKey].fluencySum += s.fluencyScore;
      dateMap[dateKey].count += 1;
    });

    // Convert to array and calculate averages
    const data = Object.entries(dateMap)
      .map(([date, values]) => ({
        date,
        accuracy: parseFloat((values.accuracySum / values.count).toFixed(1)),
        completeness: parseFloat(
          (values.completenessSum / values.count).toFixed(1),
        ),
        fluency: parseFloat((values.fluencySum / values.count).toFixed(1)),
        sessionCount: values.count,
        timestamp: values.date.getTime(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-14); // Last 14 days

    return data;
  }, [filteredSessions]);

  const stats = useMemo(() => {
    const activeLearners = new Set(filteredSessions.map((s) => s.learnerId))
      .size;
    const invited = filteredAll.filter((l) => l.status === "Invited").length;

    // Calculate current averages (last 7 days or all if less)
    const recentData = aggregatedData.slice(-7);
    const avgAccuracy =
      recentData.length > 0
        ? parseFloat(
            (
              recentData.reduce((sum, d) => sum + d.accuracy, 0) /
              recentData.length
            ).toFixed(1),
          )
        : 0;
    const avgCompleteness =
      recentData.length > 0
        ? parseFloat(
            (
              recentData.reduce((sum, d) => sum + d.completeness, 0) /
              recentData.length
            ).toFixed(1),
          )
        : 0;
    const avgFluency =
      recentData.length > 0
        ? parseFloat(
            (
              recentData.reduce((sum, d) => sum + d.fluency, 0) /
              recentData.length
            ).toFixed(1),
          )
        : 0;

    // Profile distribution
    const distribution = [
      { name: "Emerging - Spark", value: 0, color: "#fbbf24" },
      { name: "Developing - Ember", value: 0, color: "#f97316" },
    ];
    filteredAll.forEach((learner) => {
      if (learner.profile === "Emerging") distribution[0].value++;
      else if (learner.profile === "Developing") distribution[1].value++;
    });

    return {
      totalClasses: classList.length,
      activeLearners,
      invited,
      avgAccuracy,
      avgCompleteness,
      avgFluency,
      distribution,
    };
  }, [filteredSessions, filteredAll, classList, aggregatedData]);

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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <KPICard
            icon={<IconClasses className="w-5 h-5 text-[#ff6e61]" />}
            label="Total Classes"
            value={stats.totalClasses}
            bg="#ff6e61"
          />
          <KPICard
            icon={<IconUsers className="w-5 h-5 text-emerald-500" />}
            label="Active Learners"
            value={stats.activeLearners}
            bg="#10b981"
          />
          <KPICard
            icon={<IconInvite className="w-5 h-5 text-amber-500" />}
            label="Invited (Pending)"
            value={stats.invited}
            bg="#f59e0b"
          />
          <KPICard
            icon={<IconUsers className="w-5 h-5 text-blue-500" />}
            label="Total Learners"
            value={filteredAll.length}
            bg="#3b82f6"
          />
        </div>

        {/* Accuracy Trend Graph */}
        <ChartCard
          title="Accuracy Score Trend"
          description="Class average accuracy score over time"
        >
          <ResponsiveContainer width="100%" height={250}>
            <LineChart
              data={aggregatedData}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="accuracy"
                name="Accuracy Score"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#10b981", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Completeness Trend Graph */}
        <ChartCard
          title="Completeness Score Trend"
          description="Class average completeness score over time"
        >
          <ResponsiveContainer width="100%" height={250}>
            <LineChart
              data={aggregatedData}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="completeness"
                name="Completeness Score"
                stroke="#f59e0b"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#f59e0b", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Fluency Trend Graph */}
        <ChartCard
          title="Fluency Score Trend"
          description="Class average fluency score over time"
        >
          <ResponsiveContainer width="100%" height={250}>
            <LineChart
              data={aggregatedData}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="fluency"
                name="Fluency Score"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#8b5cf6", strokeWidth: 0 }}
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
