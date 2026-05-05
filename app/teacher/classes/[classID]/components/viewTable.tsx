"use client";

import { useEffect, useMemo, useState } from "react";
import type { Learner } from "../page";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import LearnerModal from "./learnerModal";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type ViewTableProps = {
  learners: Learner[];
  classStatus?: "Active" | "Archived";
  onBulkInvite: (selectedIds: string[]) => void;

  // ✅ ADDED
  schoolId: string;
  classId: string;
};

type SortOption = "nameAsc" | "nameDesc" | "profile";

const ITEMS_PER_PAGE = 10;

function normalizeStatus(status?: string) {
  return status ?? "Pending";
}

function getProfileStyle(profile: string) {
  switch (profile) {
    case "Emerging":
      return "bg-rose-50 text-rose-700";
    case "Developing":
      return "bg-amber-50 text-amber-700";
    case "Transitioning":
      return "bg-indigo-50 text-indigo-700";
    case "Reading at Grade Level":
      return "bg-emerald-50 text-emerald-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function getStatusStyle(status?: string) {
  switch (status) {
    case "Pending":
      return "bg-amber-50 text-amber-700";
    case "Invited":
      return "bg-blue-50 text-blue-700";
    case "Active":
      return "bg-emerald-50 text-emerald-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default function ViewTable({
  learners,
  classStatus,
  onBulkInvite,
  schoolId,
  classId,
}: ViewTableProps) {
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProfile, setFilterProfile] = useState<string>("All");
  const [sortOption, setSortOption] = useState<SortOption>("nameAsc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // ✅ ADDED STATES
  const [selectedLearner, setSelectedLearner] = useState<Learner | null>(null);
  const [progress, setProgress] = useState<any[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const processedLearners = useMemo(() => {
    let data = [...learners];

    if (searchTerm) {
      data = data.filter((l) =>
        [
          l.name,
          l.lrn,
          l.learnerCode,
          l.readingProfile,
          l.parentName,
          l.parentEmail,
          normalizeStatus(l.status),
        ]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(searchTerm)),
      );
    }

    if (filterProfile !== "All") {
      data = data.filter((l) => l.readingProfile === filterProfile);
    }

    if (sortOption === "nameAsc") {
      data.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOption === "nameDesc") {
      data.sort((a, b) => b.name.localeCompare(a.name));
    } else {
      data.sort((a, b) => a.readingProfile.localeCompare(b.readingProfile));
    }

    return data;
  }, [learners, searchTerm, filterProfile, sortOption]);

  const totalPages = Math.ceil(processedLearners.length / ITEMS_PER_PAGE) || 1;

  const paginatedLearners = processedLearners.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterProfile, sortOption]);

  useEffect(() => {
    setSelectedIds([]);
  }, [currentPage]);

  // ✅ ADDED FETCH LOGIC
  useEffect(() => {
    const fetchProgress = async () => {
      if (!selectedLearner) return;

      try {
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

        const q = query(ref, orderBy("createdAt", "desc"), limit(5));
        const snap = await getDocs(q);

        const sessions = snap.docs.map((doc) => doc.data());
        setProgress(sessions.reverse());
      } catch (err) {
        console.error(err);
        setProgress([]);
      }
    };

    fetchProgress();
  }, [selectedLearner, schoolId, classId]);

  const toggleSelectAll = () => {
    const pagePendingIds = paginatedLearners
      .filter((l) => normalizeStatus(l.status) === "Pending")
      .map((l) => l.id);

    const allSelected = pagePendingIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !pagePendingIds.includes(id)),
      );
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...pagePendingIds])]);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const hasLearners = learners.length > 0;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
        <div className="relative w-full lg:w-1/3">
          <input
            type="text"
            placeholder="Search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-sm"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={filterProfile}
            onChange={(e) => setFilterProfile(e.target.value)}
            className="px-4 py-2.5 border rounded-xl text-sm"
          >
            <option value="All">All Profiles</option>
            <option value="Emerging">Emerging</option>
            <option value="Developing">Developing</option>
            <option value="Transitioning">Transitioning</option>
            <option value="Reading at Grade Level">
              Reading at Grade Level
            </option>
          </select>

          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="px-4 py-2.5 border rounded-xl text-sm"
          >
            <option value="nameAsc">Name (A–Z)</option>
            <option value="nameDesc">Name (Z–A)</option>
          </select>
        </div>
      </div>

      {hasLearners && (
        <>
          {/* Selected Bar */}
          {selectedIds.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex justify-between items-center">
              <p className="text-sm font-medium text-blue-700">
                {selectedIds.length} selected
              </p>

              <div className="flex gap-3">
                <button
                  disabled={classStatus === "Archived"}
                  onClick={() => {
                    onBulkInvite(selectedIds);
                    setSelectedIds([]);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Send Parent Invite
                </button>

                <button
                  onClick={() => setSelectedIds([])}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50/70 text-[11px] uppercase tracking-wider text-gray-500 border-b">
                  <tr>
                    <th className="w-10 px-4 py-4">
                      <input
                        type="checkbox"
                        onChange={toggleSelectAll}
                        checked={
                          paginatedLearners
                            .filter(
                              (l) => normalizeStatus(l.status) === "Pending",
                            )
                            .every((l) => selectedIds.includes(l.id)) &&
                          paginatedLearners.some(
                            (l) => normalizeStatus(l.status) === "Pending",
                          )
                        }
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </th>

                    <th className="px-6 py-4 text-left">Code</th>
                    <th className="px-6 py-4 text-left">LRN</th>
                    <th className="px-6 py-4 text-left">Learner</th>
                    <th className="px-6 py-4 text-left">Profile</th>
                    <th className="px-6 py-4 text-left">Parent</th>
                    <th className="px-6 py-4 text-left">Email</th>
                    <th className="px-6 py-4 text-left">Status</th>
                    <th className="w-12 px-4 py-4"></th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {paginatedLearners.map((learner) => {
                    const status = normalizeStatus(learner.status);

                    return (
                      <tr
                        key={learner.id}
                        className={`group transition-all duration-150 ${
                          selectedIds.includes(learner.id)
                            ? "bg-blue-50/40"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            disabled={status !== "Pending"}
                            checked={selectedIds.includes(learner.id)}
                            onChange={() => toggleSelectOne(learner.id)}
                            className="h-4 w-4 rounded border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                          />
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1 text-xs font-mono font-semibold bg-gray-100 text-gray-700 rounded-lg tracking-wider">
                            {learner.learnerCode}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-gray-500">
                          {learner.lrn}
                        </td>

                        <td className="px-6 py-4 font-semibold text-gray-800">
                          {learner.name}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${getProfileStyle(
                              learner.readingProfile,
                            )}`}
                          >
                            {learner.readingProfile}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-gray-600">
                          {learner.parentName || "-"}
                        </td>

                        <td className="px-6 py-4 text-gray-500">
                          {learner.parentEmail || "-"}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${getStatusStyle(
                              status,
                            )}`}
                          >
                            {status}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => setSelectedLearner(learner)}
                            className="opacity-100 transition rounded-lg p-2 hover:bg-gray-100 text-gray-500 hover:text-gray-800"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <circle cx="12" cy="5" r="2" />
                              <circle cx="12" cy="12" r="2" />
                              <circle cx="12" cy="19" r="2" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination UI (UNCHANGED FROM YOUR ORIGINAL) */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
              <p className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(
                    Math.max(currentPage - 3, 0),
                    Math.min(currentPage + 2, totalPages),
                  )
                  .map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 text-sm rounded-xl transition ${
                        page === currentPage
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
      <LearnerModal
        selectedLearner={selectedLearner}
        schoolId={schoolId}
        classId={classId}
        onClose={() => setSelectedLearner(null)}
      />
    </div>
  );
}
