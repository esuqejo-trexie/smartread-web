"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
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
import { X, TrendingUp, Activity, Award, BookOpen, Info } from "lucide-react";

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
  const [progress, setProgress] = useState<any[]>([]); // Last 10 (graph)
  const [allSessions, setAllSessions] = useState<any[]>([]); // Full data (stats)
  const [loading, setLoading] = useState(true);
  const [showFormula, setShowFormula] = useState(false);

  // ✅ CORRECTED FORMULA FUNCTION
  // Formula matches the note exactly:
  // Emerging: 70% Accuracy + 20% Completeness + 10% Fluency
  // Developing: 60% Accuracy + 20% Completeness + 10% Fluency
  const computeFinalScore = (d: any) => {
    // If finalScore is already provided directly, use it
    if (d.finalScore !== undefined && d.finalScore !== null) {
      return d.finalScore;
    }

    // Get the scores (with fallbacks)
    const accuracy =
      d.accuracyScore !== undefined && d.accuracyScore !== null
        ? d.accuracyScore
        : 0;
    const completeness = d.completenessScore || 0;
    const fluency = d.fluencyScore || 0;
    const profile = d.profile;

    let computedFinal = 0;

    if (profile === "Emerging") {
      // Emerging: 70% accuracy + 20% completeness + 10% fluency
      computedFinal = accuracy * 0.7 + completeness * 0.2 + fluency * 0.1;
    } else if (profile === "Developing") {
      // Developing: 60% accuracy + 20% completeness + 10% fluency
      computedFinal = accuracy * 0.6 + completeness * 0.2 + fluency * 0.2;
    } else {
      // Default fallback: just use accuracy/pronunciation
      computedFinal = accuracy;
    }

    return Math.min(100, Math.max(0, computedFinal)); // Clamp between 0-100
  };

  // Listener 1: Last 10 sessions (Graph)
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
          console.log("RAW FIRESTORE DATA:", d); // 👈 ADD THIS

          return {
            id: doc.id,
            ...d,
            finalScore: d.finalScore,
          };
        })
        .reverse(); // chronological order

      setProgress(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedLearner?.id, schoolId, classId]);

  // Listener 2: All sessions (Activity stats)
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

    const q = query(ref, orderBy("createdAt", "asc"));

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

  // Formatter for percentages
  const formatScore = (score: number) => {
    if (!score && score !== 0) return "0";
    return Number.isInteger(score) ? score.toString() : score.toFixed(1);
  };

  // Prepare graph data for last 10 sessions
  const formatted = progress.map((item, index) => ({
    ...item,
    sessionLabel: item.createdAt
      ? new Date(item.createdAt.seconds * 1000).toLocaleDateString()
      : `Session ${index + 1}`,

    accuracyScore:
      item.accuracyScore !== undefined && item.accuracyScore !== null
        ? Number(item.accuracyScore)
        : 0,

    completenessScore:
      item.completenessScore !== undefined && item.completenessScore !== null
        ? Number(item.completenessScore)
        : 0,

    fluencyScore:
      item.fluencyScore !== undefined && item.fluencyScore !== null
        ? Number(item.fluencyScore)
        : 0,

    finalScore:
      item.finalScore !== undefined && item.finalScore !== null
        ? Number(item.finalScore)
        : null,
  }));

  // Activity stats using all sessions - with CORRECT best score calculation
  const activityStats = Object.values(
    allSessions.reduce((acc: any, curr: any) => {
      const activityId = curr.activity;
      const comprehensionScore = curr.comprehensionScore || 0;

      if (!acc[activityId]) {
        acc[activityId] = {
          activity: activityId,
          attempts: 0,
          bestReadingScore: 0,
          bestComprehensionScore: 0,
          allReadingScores: [], // For debugging if needed
        };
      }

      acc[activityId].attempts += 1;

      // Track best reading score (final score)
      const currentReadingScore = curr.finalScore ?? 0;
      if (currentReadingScore > acc[activityId].bestReadingScore) {
        acc[activityId].bestReadingScore = currentReadingScore;
      }

      // Track best comprehension score
      if (comprehensionScore > acc[activityId].bestComprehensionScore) {
        acc[activityId].bestComprehensionScore = comprehensionScore;
      }

      return acc;
    }, {}),
  ).sort((a: any, b: any) => Number(a.activity) - Number(b.activity));

  const latest = formatted[formatted.length - 1] || {};

  // Prepare data for multi-metric chart
  const multiMetricData = formatted.map((item) => ({
    session: item.sessionLabel,
    Accuracy: item.accuracyScore,
    Completeness: item.completenessScore,
    Fluency: item.fluencyScore,
  }));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] relative">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl z-10">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold">{selectedLearner.name}</h2>
          <h3 className="text-2xl font-bold">{selectedLearner.profile}</h3>
          <p className="text-blue-100 mt-1 text-sm">
            Learner Progress Overview
          </p>
          {selectedLearner.profile && (
            <span className="inline-block mt-2 px-2 py-1 bg-white/20 rounded-lg text-xs">
              Profile: {selectedLearner.profile}
            </span>
          )}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-20 text-gray-400">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              Loading data...
            </div>
          ) : progress.length > 0 ? (
            <div className="space-y-6">
              {/* ✅ CORRECTED FORMULA NOTE */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-4 h-4 text-amber-700" />
                      <p className="text-sm font-semibold text-amber-800">
                        Assessment Formula
                      </p>
                    </div>
                    <div className="text-xs text-amber-700 space-y-2">
                      <div className="bg-amber-100/50 p-2 rounded-lg">
                        <p className="font-medium">🎯 Emerging Profile:</p>
                        <p className="ml-2">
                          70% Accuracy + 20% Completeness + 10% Fluency
                        </p>
                      </div>
                      <div className="bg-amber-100/50 p-2 rounded-lg">
                        <p className="font-medium">📈 Developing Profile:</p>
                        <p className="ml-2">
                          60% Accuracy + 20% Completeness + 20% Fluency
                        </p>
                      </div>
                      <div className="text-amber-600 text-xs italic mt-2 pt-1 border-t border-amber-200">
                        🔍 Pronunciation assessment powered by Microsoft Azure
                        AI
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Metrics Cards - Reading Score card removed */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-green-700 font-medium">
                      Accuracy
                    </p>
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold text-green-700">
                    {formatScore(
                      latest.accuracyScore !== undefined &&
                        latest.accuracyScore !== null
                        ? latest.accuracyScore
                        : 0,
                    )}
                    %
                  </p>
                  <p className="text-xs text-green-600 mt-1">Latest session</p>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-orange-700 font-medium">
                      Completeness
                    </p>
                    <Activity className="w-5 h-5 text-orange-600" />
                  </div>
                  <p className="text-2xl font-bold text-orange-700">
                    {formatScore(
                      latest.completenessScore !== undefined &&
                        latest.completenessScore !== null
                        ? latest.completenessScore
                        : 0,
                    )}
                    %
                  </p>
                  <p className="text-xs text-orange-600 mt-1">Latest session</p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-purple-700 font-medium">
                      Fluency
                    </p>
                    <Activity className="w-5 h-5 text-purple-600" />
                  </div>
                  <p className="text-2xl font-bold text-purple-700">
                    {formatScore(
                      latest.fluencyScore !== undefined &&
                        latest.fluencyScore !== null
                        ? latest.fluencyScore
                        : 0,
                    )}
                    %
                  </p>
                  <p className="text-xs text-purple-600 mt-1">Latest session</p>
                </div>
              </div>

              {/* Progress Trend - Last 10 Sessions */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">
                      Progress Trend (Reading Score)
                    </p>
                    <p className="text-xs text-gray-400">
                      Last 10 sessions • Chronological order
                    </p>
                  </div>
                  <BookOpen className="w-5 h-5 text-gray-400" />
                </div>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={formatted}>
                      <XAxis dataKey="sessionLabel" stroke="#9CA3AF" />
                      <YAxis domain={[0, 100]} stroke="#9CA3AF" />

                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="finalScore"
                        connectNulls={true}
                        stroke="#3B82F6"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#3B82F6" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Detailed Metrics Graph */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700">
                    Detailed Performance Metrics
                  </p>
                  <p className="text-xs text-gray-400">
                    Accuracy, Completeness & Fluency over last 10 sessions
                  </p>
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={multiMetricData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="session" stroke="#9CA3AF" />
                      <YAxis domain={[0, 100]} stroke="#9CA3AF" />

                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="Accuracy"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Completeness"
                        stroke="#F59E0B"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Fluency"
                        stroke="#8B5CF6"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Summary Stats - Only Total Sessions and Activities */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl text-center border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium">
                    Total Sessions
                  </p>
                  <p className="font-bold text-2xl text-gray-800 mt-1">
                    {allSessions.length}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl text-center border border-gray-200">
                  <p className="text-xs text-gray-600 font-medium">
                    Activities
                  </p>
                  <p className="font-bold text-2xl text-gray-800 mt-1">
                    {activityStats.length}
                  </p>
                </div>
              </div>

              {/* Activity History Table */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-3 border-b border-gray-200">
                  <p className="text-sm font-semibold text-gray-700">
                    Activity History
                  </p>
                  <p className="text-xs text-gray-500">
                    Best scores across all attempts for each activity
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                      <tr>
                        <th className="text-left py-3 px-5">Activity Done</th>
                        <th className="text-center py-3 px-5">
                          How Many Attempts
                        </th>
                        <th className="text-center py-3 px-5">Reading Score</th>
                        <th className="text-center py-3 px-5">
                          Comprehension Score
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityStats.map((item: any, idx: number) => (
                        <tr
                          key={item.activity}
                          className={`border-t border-gray-100 ${
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                          }`}
                        >
                          <td className="py-3 px-5 font-medium text-gray-800">
                            Activity {item.activity}
                          </td>
                          <td className="text-center py-3 px-5">
                            <span className="inline-flex items-center justify-center bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-semibold">
                              {item.attempts}
                            </span>
                          </td>
                          <td className="text-center py-3 px-5">
                            <span className="font-semibold text-green-600">
                              {formatScore(item.bestReadingScore)}
                            </span>
                          </td>
                          <td className="text-center py-3 px-5">
                            <span className="font-semibold text-purple-600">
                              {formatScore(item.bestComprehensionScore)}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {activityStats.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="text-center py-8 text-gray-400"
                          >
                            No activity data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Formula Calculation Example for current learner */}
              {selectedLearner.profile &&
                (selectedLearner.profile === "Emerging" ||
                  selectedLearner.profile === "Developing") && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-xs text-blue-700">
                      <strong>
                        Current calculation for {selectedLearner.profile}{" "}
                        profile:
                      </strong>
                      <br />
                      Latest session: Accuracy{" "}
                      {formatScore(
                        latest.accuracyScore !== undefined &&
                          latest.accuracyScore !== null
                          ? latest.accuracyScore
                          : 0,
                      )}
                      % ×
                      {selectedLearner.profile === "Emerging" ? "0.7" : "0.6"} +
                      Completeness{" "}
                      {formatScore(
                        latest.completenessScore !== undefined &&
                          latest.completenessScore !== null
                          ? latest.completenessScore
                          : 0,
                      )}
                      % × 0.2 + Fluency{" "}
                      {formatScore(
                        latest.fluencyScore !== undefined &&
                          latest.fluencyScore !== null
                          ? latest.fluencyScore
                          : 0,
                      )}
                      % × 0.1 = Reading Score{" "}
                      {formatScore(latest.finalScore || 0)}%
                    </p>
                  </div>
                )}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-500">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>No reading data available yet</p>
              <p className="text-sm mt-2 text-gray-400">
                Sessions will appear here once the learner starts reading
              </p>
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="mt-6 w-full bg-gray-100 hover:bg-gray-200 transition-all py-3 rounded-xl font-medium text-gray-700 hover:text-gray-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
