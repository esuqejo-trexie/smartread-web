"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface LearnerModalProps {
  selectedLearner: any;
  schoolId: string;
  classId: string;
  onClose: () => void;
}

export default function LearnerModal({
  selectedLearner,
  schoolId,
  classId,
  onClose,
}: LearnerModalProps) {
  const [progress, setProgress] = useState<any[]>([]); // 🔹 last 10 (graph)
  const [allSessions, setAllSessions] = useState<any[]>([]); // 🔹 full data (stats)
  const [loading, setLoading] = useState(true);

  // 🔥 COMMON FUNCTION (avoid duplication)
  const computeFinalScore = (d: any) => {
    let computedFinal = d.finalScore;

    if (computedFinal === undefined || computedFinal === null) {
      if (d.profile === "Emerging") {
        computedFinal = d.pronunciationScore;
      } else if (d.profile === "Developing") {
        computedFinal =
          0.8 * (d.pronunciationScore || 0) + 0.2 * (d.fluencyScore || 0);
      } else if (d.profile === "Transitioning") {
        computedFinal =
          0.7 * (d.pronunciationScore || 0) + 0.3 * (d.fluencyScore || 0);
      } else {
        computedFinal = d.pronScore;
      }
    }

    return computedFinal ?? 0;
  };

  // ✅ LISTENER 1: LAST 10 SESSIONS (GRAPH)
  useEffect(() => {
    if (!selectedLearner?.id || !schoolId || !classId) return;

    setLoading(true);

    const ref = collection(
      db,
      "schools",
      schoolId,
      "classes",
      classId,
      "learners",
      selectedLearner.id,
      "readingSessions",
    );

    const q = query(ref, orderBy("createdAt", "desc"), limit(10));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map((doc) => {
          const d = doc.data();

          return {
            id: doc.id,
            ...d,
            finalScore: computeFinalScore(d),
          };
        })
        .reverse(); // chronological

      setProgress(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedLearner?.id, schoolId, classId]);

  // ✅ LISTENER 2: ALL SESSIONS (ACTIVITY STATS)
  useEffect(() => {
    if (!selectedLearner?.id || !schoolId || !classId) return;

    const ref = collection(
      db,
      "schools",
      schoolId,
      "classes",
      classId,
      "learners",
      selectedLearner.id,
      "readingSessions",
    );

    const q = query(
      ref,
      orderBy("createdAt", "asc"), // full history
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const d = doc.data();

        return {
          id: doc.id,
          ...d,
          finalScore: computeFinalScore(d),
        };
      });

      setAllSessions(data);
    });

    return () => unsubscribe();
  }, [selectedLearner?.id, schoolId, classId]);

  if (!selectedLearner) return null;

  // ✅ FORMATTER
  const formatScore = (score: number) =>
    Number.isInteger(score) ? score : score.toFixed(1);

  // ✅ GRAPH DATA
  const formatted = progress.map((item) => ({
    ...item,
    sessionLabel: item.createdAt
      ? new Date(item.createdAt.seconds * 1000).toLocaleDateString()
      : "—",
  }));

  // ✅ ACTIVITY STATS (FIXED: uses ALL sessions)
  const activityStats = Object.values(
    allSessions.reduce((acc: any, curr: any) => {
      const key = curr.activity;

      if (!acc[key]) {
        acc[key] = {
          activity: key,
          attempts: 0,
          bestScore: 0,
        };
      }

      acc[key].attempts += 1;
      acc[key].bestScore = Math.max(acc[key].bestScore, curr.finalScore ?? 0);

      return acc;
    }, {}),
  ).sort((a: any, b: any) => Number(a.activity) - Number(b.activity));

  const latest = formatted.at(-1) || {};

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-4xl rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* HEADER */}
        <div className="mb-5">
          <h2 className="text-2xl font-bold text-gray-800">
            {selectedLearner.name}
          </h2>
          <p className="text-sm text-gray-500">Learner Progress Overview</p>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400">Loading data...</div>
        ) : progress.length > 0 ? (
          <div className="space-y-6">
            {/* METRICS */}
            <div className="grid grid-cols-2 gap-10">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-600">Pronunciation</p>
                <p className="text-xl font-bold text-blue-600">
                  {formatScore(latest.pronunciationScore || 0)}%
                </p>
              </div>

              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-600">Fluency</p>
                <p className="text-xl font-bold text-green-600">
                  {formatScore(latest.fluencyScore || 0)}%
                </p>
              </div>
            </div>

            {/* GRAPH */}
            <p className="text-xs text-gray-400 mb-1">
              Showing last 10 sessions
            </p>
            <div className="bg-white border rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Progress Trend
              </p>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={formatted}>
                    <XAxis dataKey="sessionLabel" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="finalScore"
                      stroke="#6366F1"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* SUMMARY */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl text-center">
                <p className="text-xs text-gray-500">Total Attempts</p>
                <p className="font-bold text-lg">{formatted.length}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl text-center">
                <p className="text-xs text-gray-500">Activities Completed</p>
                <p className="font-bold text-lg">{activityStats.length}</p>
              </div>
            </div>

            {/* ACTIVITY TABLE */}
            <div className="bg-white border rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-700 mb-3">
                Activity Breakdown
              </p>

              <table className="w-full text-sm">
                <thead className="text-gray-500 text-xs">
                  <tr>
                    <th className="text-left py-2">Activity</th>
                    <th className="text-center py-2">Attempts</th>
                    <th className="text-right py-2">Best Score</th>
                  </tr>
                </thead>
                <tbody>
                  {activityStats.map((item: any) => (
                    <tr key={item.activity} className="border-t">
                      <td className="py-2">Activity {item.activity}</td>
                      <td className="text-center">{item.attempts}</td>
                      <td className="text-right font-semibold">
                        {formatScore(item.bestScore)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            No reading data yet
          </div>
        )}

        {/* CLOSE */}
        <button
          onClick={onClose}
          className="mt-6 w-full bg-gray-100 hover:bg-gray-200 transition py-3 rounded-xl font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}
