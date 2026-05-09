"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import type { Learner } from "../page";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import LearnerModal from "./learnerModal";
import EditLearnerModal from "./editLearnerModal";

type ViewTableProps = {
  learners: Learner[];
  classStatus?: "Active" | "Archived";
  onBulkInvite: (selectedIds: string[]) => void;
  schoolId: string;
  classId: string;
  onRefresh?: () => void;
};

type SortOption = "nameAsc" | "nameDesc" | "profile";

const ITEMS_PER_PAGE = 10;

function normalizeStatus(status?: string) {
  return status ?? "Pending";
}

function getProfileStyle(profile: string) {
  switch (profile) {
    case "Emerging":
      return "bg-rose-50 text-rose-600 ring-1 ring-rose-200";
    case "Developing":
      return "bg-amber-50 text-amber-600 ring-1 ring-amber-200";

    default:
      return "bg-gray-100 text-gray-500 ring-1 ring-gray-200";
  }
}

function getProfileDot(profile: string) {
  switch (profile) {
    case "Emerging":
      return "bg-rose-400";
    case "Developing":
      return "bg-amber-400";

    default:
      return "bg-gray-300";
  }
}

function getStatusStyle(status?: string) {
  switch (status) {
    case "Pending":
      return "bg-amber-50 text-amber-600 ring-1 ring-amber-200";
    case "Invited":
      return "bg-blue-50 text-blue-600 ring-1 ring-blue-200";
    case "Active":
      return "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200";
    default:
      return "bg-gray-100 text-gray-500 ring-1 ring-gray-200";
  }
}

function getStatusIcon(status?: string) {
  switch (status) {
    case "Pending":
      return (
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case "Invited":
      return (
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      );
    case "Active":
      return (
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      );
    default:
      return null;
  }
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        {filtered ? (
          <svg
            className="w-7 h-7 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        ) : (
          <svg
            className="w-7 h-7 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        )}
      </div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">
        {filtered ? "No results found" : "No learners yet"}
      </h3>
      <p className="text-xs text-gray-400 max-w-xs">
        {filtered
          ? "Try adjusting your search or filter to find what you're looking for."
          : "Add learners to this class to get started."}
      </p>
    </div>
  );
}

export default function ViewTable({
  learners,
  classStatus,
  onBulkInvite,
  schoolId,
  classId,
  onRefresh,
}: ViewTableProps) {
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProfile, setFilterProfile] = useState<string>("All");
  const [sortOption, setSortOption] = useState<SortOption>("nameAsc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedLearner, setSelectedLearner] = useState<Learner | null>(null);
  const [editLearner, setEditLearner] = useState<Learner | null>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
        setProgress(snap.docs.map((doc) => doc.data()).reverse());
      } catch {
        setProgress([]);
      }
    };
    fetchProgress();
  }, [selectedLearner, schoolId, classId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pagePendingIds = paginatedLearners
    .filter((l) => normalizeStatus(l.status) === "Pending")
    .map((l) => l.id);

  const allPendingSelected =
    pagePendingIds.length > 0 &&
    pagePendingIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allPendingSelected) {
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

  const isFiltered = searchTerm !== "" || filterProfile !== "All";

  const profileCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    learners.forEach((l) => {
      counts[l.readingProfile] = (counts[l.readingProfile] || 0) + 1;
    });
    return counts;
  }, [learners]);

  const profiles = ["Emerging", "Developing"];

  return (
    <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8 w-full max-w-full overflow-x-hidden">
      {/* ── Summary Strip ── */}
      {learners.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {profiles.map((profile) => (
            <button
              key={profile}
              onClick={() =>
                setFilterProfile(filterProfile === profile ? "All" : profile)
              }
              className={`group relative flex flex-col gap-1 px-4 py-3.5 rounded-2xl border transition-all duration-200 text-left ${
                filterProfile === profile
                  ? "border-blue-300 bg-blue-50 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${getProfileDot(profile)}`}
                />
                <span className="text-[11px] font-medium text-gray-500 truncate leading-none">
                  {profile}
                </span>
              </div>
              <span className="text-2xl font-bold text-gray-800 leading-none pl-4">
                {profileCounts[profile] || 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search learners..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50/50 placeholder:text-gray-400"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <div className="relative">
              <select
                value={filterProfile}
                onChange={(e) => setFilterProfile(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="All">All Profiles</option>
                <option value="Emerging">Emerging</option>
                <option value="Developing">Developing</option>
                <option value="Transitioning">Transitioning</option>
                <option value="Reading at Grade Level">Grade Level</option>
              </select>
              <svg
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>

            <div className="relative">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="appearance-none pl-3 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="nameAsc">Name A–Z</option>
                <option value="nameDesc">Name Z–A</option>
              </select>
              <svg
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>

        {isFiltered && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">Filters:</span>
            {searchTerm && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg">
                "{searchTerm}"
                <button
                  onClick={() => setSearchInput("")}
                  className="hover:text-blue-800"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            )}
            {filterProfile !== "All" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg">
                {filterProfile}
                <button
                  onClick={() => setFilterProfile("All")}
                  className="hover:text-blue-800"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            )}
            <button
              onClick={() => {
                setSearchInput("");
                setFilterProfile("All");
              }}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-blue-600 rounded-2xl px-5 py-3.5 flex justify-between items-center shadow-md shadow-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {selectedIds.length}
              </span>
            </div>
            <p className="text-sm font-medium text-white">
              {selectedIds.length} learner{selectedIds.length !== 1 ? "s" : ""}{" "}
              selected
            </p>
          </div>
          <div className="flex gap-2">
            <button
              disabled={classStatus === "Archived"}
              onClick={() => {
                onBulkInvite(selectedIds);
                setSelectedIds([]);
              }}
              className="px-4 py-2 bg-white text-blue-600 text-sm font-semibold rounded-xl hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              Send Invite
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-2 bg-white/10 text-white text-sm rounded-xl hover:bg-white/20 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Desktop Table with Horizontal Scroll ONLY on table ── */}
      <div className="hidden md:block w-full overflow-x-hidden">
        {processedLearners.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
            <EmptyState filtered={isFiltered} />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full">
            <div className="px-6 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                {processedLearners.length} Learner
                {processedLearners.length !== 1 ? "s" : ""}
              </span>
              {isFiltered && (
                <span className="text-xs text-gray-400">
                  filtered from {learners.length} total
                </span>
              )}
            </div>

            <div className="overflow-x-auto w-full">
              <div className="min-w-[1000px] w-max">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100">
                      <th className="w-12 px-5 py-3.5">
                        <input
                          type="checkbox"
                          onChange={toggleSelectAll}
                          checked={allPendingSelected}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                        Code
                      </th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                        LRN
                      </th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                        Learner
                      </th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                        Profile
                      </th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                        Parent
                      </th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                        Email
                      </th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                        Status
                      </th>
                      <th className="w-24 px-4 py-3.5 whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-50">
                    {paginatedLearners.map((learner) => {
                      const status = normalizeStatus(learner.status);
                      const isSelected = selectedIds.includes(learner.id);

                      return (
                        <tr
                          key={learner.id}
                          className={`transition-colors duration-100 ${
                            isSelected ? "bg-blue-50/60" : "hover:bg-gray-50/80"
                          }`}
                        >
                          <td className="px-5 py-4">
                            <input
                              type="checkbox"
                              disabled={status !== "Pending"}
                              checked={isSelected}
                              onChange={() => toggleSelectOne(learner.id)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
                            />
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-mono font-bold bg-gray-100 text-gray-600 rounded-lg tracking-widest border border-gray-200">
                              {learner.learnerCode}
                            </span>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-gray-400 font-mono text-xs">
                              {learner.lrn}
                            </span>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0">
                                <span className="text-blue-700 text-xs font-bold">
                                  {learner.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="font-semibold text-gray-800 text-sm leading-tight">
                                {learner.name}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${getProfileStyle(learner.readingProfile)}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getProfileDot(learner.readingProfile)}`}
                              />
                              {learner.readingProfile}
                            </span>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-gray-600 text-sm">
                              {learner.parentName || (
                                <span className="text-gray-300">—</span>
                              )}
                            </span>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-gray-400 text-xs">
                              {learner.parentEmail || (
                                <span className="text-gray-300">—</span>
                              )}
                            </span>
                          </td>

                          <td className="px-5 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${getStatusStyle(status)}`}
                            >
                              {getStatusIcon(status)}
                              {status}
                            </span>
                          </td>

                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLearner(learner);
                                }}
                                className="rounded-xl p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                                title="View details"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                  />
                                </svg>
                              </button>

                              <div
                                className="relative"
                                ref={openMenuId === learner.id ? menuRef : null}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(
                                      openMenuId === learner.id
                                        ? null
                                        : learner.id,
                                    );
                                  }}
                                  className="rounded-xl p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                                  title="More options"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                                    />
                                  </svg>
                                </button>

                                {openMenuId === learner.id && (
                                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditLearner(learner);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                        />
                                      </svg>
                                      Edit Information
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile Card View ── */}
      <div className="md:hidden space-y-3">
        {processedLearners.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
            <EmptyState filtered={isFiltered} />
          </div>
        ) : (
          paginatedLearners.map((learner) => {
            const status = normalizeStatus(learner.status);
            const isSelected = selectedIds.includes(learner.id);

            return (
              <div
                key={learner.id}
                className={`bg-white rounded-2xl border shadow-sm p-4 transition-colors ${
                  isSelected
                    ? "border-blue-300 bg-blue-50/40"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {status === "Pending" && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(learner.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 flex-shrink-0"
                      />
                    )}
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 text-sm font-bold">
                        {learner.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800 text-sm truncate">
                        {learner.name}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">
                        {learner.lrn}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedLearner(learner)}
                      className="rounded-xl p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      title="View details"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => setEditLearner(learner)}
                      className="rounded-xl p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      title="Edit"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold bg-gray-100 text-gray-600 rounded-md border border-gray-200 tracking-wider">
                    {learner.learnerCode}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${getProfileStyle(learner.readingProfile)}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${getProfileDot(learner.readingProfile)}`}
                    />
                    {learner.readingProfile}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${getStatusStyle(status)}`}
                  >
                    {getStatusIcon(status)}
                    {status}
                  </span>
                </div>

                {learner.parentName && (
                  <p className="text-xs text-gray-400 mt-2 truncate">
                    <span className="text-gray-300 mr-1">Parent:</span>
                    {learner.parentName}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
          <p className="text-sm text-gray-400">
            Showing{" "}
            <span className="font-medium text-gray-600">
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
              {Math.min(currentPage * ITEMS_PER_PAGE, processedLearners.length)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-gray-600">
              {processedLearners.length}
            </span>
          </p>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg
                className="w-4 h-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
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
                  className={`w-9 h-9 text-sm rounded-xl font-medium transition-colors ${
                    page === currentPage
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                      : "text-gray-600 hover:bg-gray-100"
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
              className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg
                className="w-4 h-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      <LearnerModal
        selectedLearner={selectedLearner}
        schoolId={schoolId}
        classId={classId}
        onClose={() => setSelectedLearner(null)}
      />

      <EditLearnerModal
        learner={editLearner}
        schoolId={schoolId}
        classId={classId}
        onClose={() => setEditLearner(null)}
        onUpdate={onRefresh || (() => {})}
      />
    </div>
  );
}
