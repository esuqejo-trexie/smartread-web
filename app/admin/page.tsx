"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/lib/firebase";

/* ---------------- TYPES ---------------- */
type TeacherStatus = "invited" | "active" | "deactivated";

type Teacher = {
  id: string;
  name: string;
  username: string;
  email: string;
  status: TeacherStatus;
};

type School = {
  name: string;
  schoolCode: string;
  email: string;
};

/* --- SORT CONFIG TYPE --- */
type SortConfig = {
  key: keyof Teacher;
  direction: "asc" | "desc";
};

const DEFAULT_PASSWORD = "SmartRead@123";
const ITEMS_PER_PAGE = 10; // Controls pagination size

/* ---------------- STATUS STYLES ---------------- */
const statusStyles: Record<TeacherStatus, string> = {
  invited: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-800 ring-1 ring-green-200",
  deactivated: "bg-gray-200 text-gray-600",
};

export default function AdminDashboard() {
  const router = useRouter();

  /* --- DATA STATE --- */
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<School | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  /* --- TABLE CONTROLS (Search, Filter, Sort, Pagination) --- */
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TeacherStatus | "all">(
    "all",
  );
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  /* --- MODAL STATES --- */
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newTeacher, setNewTeacher] = useState({
    name: "",
    username: "",
    email: "",
  });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [resetTeacher, setResetTeacher] = useState<Teacher | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const [confirmDeactivate, setConfirmDeactivate] = useState<Teacher | null>(
    null,
  );
  const [confirmActivate, setConfirmActivate] = useState<Teacher | null>(null);
  const [isProcessingStatus, setIsProcessingStatus] = useState(false);

  /* ---------------- AUTH ---------------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push("/login");

      const adminSnap = await getDoc(doc(db, "users", user.uid));
      if (!adminSnap.exists()) return router.push("/login");

      const adminData = adminSnap.data();
      if (adminData.role !== "admin" || !adminData.schoolId)
        return router.push("/login");

      setSchoolId(adminData.schoolId);

      const schoolSnap = await getDoc(doc(db, "schools", adminData.schoolId));
      if (schoolSnap.exists()) setSchool(schoolSnap.data() as School);

      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  /* ---------------- LOAD DATA ---------------- */
  useEffect(() => {
    if (!schoolId) return;

    const load = async () => {
      const q = query(
        collection(db, "users"),
        where("role", "==", "teacher"),
        where("schoolId", "==", schoolId),
      );

      const snap = await getDocs(q);

      setTeachers(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.fullName,
            username: data.username,
            email: data.email,
            status: (data.status ?? "invited") as TeacherStatus,
          };
        }),
      );
    };

    load();
  }, [schoolId]);

  /* ---------------- TABLE LOGIC (Sort/Filter/Paginate) ---------------- */

  // 1. Sorting Handler
  const handleSort = (key: keyof Teacher) => {
    setSortConfig((current) => {
      if (current?.key === key && current.direction === "asc") {
        return { key, direction: "desc" };
      }
      return { key, direction: "asc" };
    });
  };

  // 2. Data Processing Pipeline
  const processedTeachers = useMemo(() => {
    let result = [...teachers];

    // Filter by Search
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(lower) ||
          t.username.toLowerCase().includes(lower) ||
          t.email.toLowerCase().includes(lower),
      );
    }

    // Filter by Status
    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }

    // Sort Data
    if (sortConfig) {
      result.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key])
          return sortConfig.direction === "asc" ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key])
          return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [teachers, searchTerm, statusFilter, sortConfig]);

  // Reset to Page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // 3. Pagination Logic
  const totalPages = Math.ceil(processedTeachers.length / ITEMS_PER_PAGE);
  const paginatedTeachers = processedTeachers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  /* ---------------- ACTIONS ---------------- */
  const handleAddTeacher = async () => {
    if (
      isAdding ||
      !newTeacher.name ||
      !newTeacher.username ||
      !newTeacher.email
    )
      return;

    setIsAdding(true);

    try {
      const createTeacher = httpsCallable(functions, "createTeacherAccount");
      const res: any = await createTeacher({
        fullName: newTeacher.name,
        username: newTeacher.username,
        email: newTeacher.email,
      });

      setTeachers((prev) => [
        ...prev,
        {
          id: res.data.uid,
          name: newTeacher.name,
          username: newTeacher.username,
          email: newTeacher.email,
          status: "invited",
        },
      ]);

      setIsAddOpen(false);
      setNewTeacher({ name: "", username: "", email: "" });
    } catch (err: any) {
      alert(err.message || "Failed to add teacher");
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTeacher || isSavingEdit) return;

    setIsSavingEdit(true);

    try {
      await updateDoc(doc(db, "users", editingTeacher.id), {
        fullName: editingTeacher.name,
      });

      setTeachers((prev) =>
        prev.map((t) => (t.id === editingTeacher.id ? editingTeacher : t)),
      );

      setIsEditOpen(false);
      setEditingTeacher(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeactivateTeacher = (t: Teacher) => {
    if (t.status !== "active") return;
    setConfirmDeactivate(t);
  };

  const confirmDeactivateTeacher = async () => {
    if (!confirmDeactivate) return;
    setIsProcessingStatus(true);
    await updateDoc(doc(db, "users", confirmDeactivate.id), {
      status: "deactivated",
    });
    setTeachers((prev) =>
      prev.map((x) =>
        x.id === confirmDeactivate.id ? { ...x, status: "deactivated" } : x,
      ),
    );
    setConfirmDeactivate(null);
    setIsProcessingStatus(false);
  };

  const handleActivateTeacher = (t: Teacher) => {
    if (t.status !== "deactivated") return;
    setConfirmActivate(t);
  };

  const confirmActivateTeacher = async () => {
    if (!confirmActivate) return;
    setIsProcessingStatus(true);
    await updateDoc(doc(db, "users", confirmActivate.id), { status: "active" });
    setTeachers((prev) =>
      prev.map((x) =>
        x.id === confirmActivate.id ? { ...x, status: "active" } : x,
      ),
    );
    setConfirmActivate(null);
    setIsProcessingStatus(false);
  };

  const handleResetPassword = async () => {
    if (!resetTeacher || isResetting) return;
    setIsResetting(true);
    try {
      const fn = httpsCallable(functions, "resetTeacherPassword");
      await fn({ teacherUid: resetTeacher.id, newPassword: DEFAULT_PASSWORD });
      setResetDone(true);
    } catch (err: any) {
      alert(err.message || "Failed to reset password");
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) return <p>Loading admin dashboard...</p>;

  /* ================= UI ================= */
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Admin Dashboard</h2>

      {/* STATS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Teachers" value={teachers.length} />
        <StatCard
          label="Active"
          value={teachers.filter((t) => t.status === "active").length}
        />
        <StatCard
          label="Invited"
          value={teachers.filter((t) => t.status === "invited").length}
        />
        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-gray-500 mb-2">School</p>
          <p className="font-semibold">{school?.name}</p>
          <p className="text-sm text-gray-600">{school?.email}</p>
          <p className="mt-2 text-sm">
            School ID:{" "}
            <span className="font-mono font-semibold">
              {school?.schoolCode}
            </span>
          </p>
        </div>
      </section>

      {/* TABLE SECTION */}
      <section className="rounded-lg bg-white p-6 shadow">
        {/* TOOLBAR */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex gap-4 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="Search teachers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded border pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Filter Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as TeacherStatus | "all")
              }
              className="border rounded px-3 py-2 text-sm bg-white focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>

          <button
            onClick={() => setIsAddOpen(true)}
            className="w-full md:w-auto rounded bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 transition"
          >
            + Add Teacher
          </button>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 border-b">
              <tr>
                {/* SORTABLE HEADERS */}
                <SortableHeader
                  label="Name"
                  sortKey="name"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Username"
                  sortKey="username"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                  Email
                </th>
                <SortableHeader
                  label="Status"
                  sortKey="status"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {paginatedTeachers.length > 0 ? (
                paginatedTeachers.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {t.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {t.username}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {t.email}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[t.status]}`}
                      >
                        {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <ActionBtn
                          label="Edit"
                          color="blue"
                          onClick={() => {
                            setEditingTeacher(t);
                            setIsEditOpen(true);
                          }}
                        />
                        <ActionBtn
                          label="Reset"
                          color="orange"
                          onClick={() => {
                            setResetTeacher(t);
                            setResetDone(false);
                          }}
                        />
                        {t.status === "active" && (
                          <ActionBtn
                            label="Deactivate"
                            color="red"
                            onClick={() => handleDeactivateTeacher(t)}
                          />
                        )}
                        {t.status === "deactivated" && (
                          <ActionBtn
                            label="Activate"
                            color="green"
                            onClick={() => handleActivateTeacher(t)}
                          />
                        )}
                        {t.status === "invited" && (
                          <ActionBtn
                            label="Deactivate"
                            color="red"
                            disabled
                            onClick={() => {}}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No teachers found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        {processedTeachers.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between border-t border-gray-200 mt-4 pt-4">
            <p className="text-sm text-gray-500">
              Showing{" "}
              <span className="font-medium">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium">
                {Math.min(
                  currentPage * ITEMS_PER_PAGE,
                  processedTeachers.length,
                )}
              </span>{" "}
              of <span className="font-medium">{processedTeachers.length}</span>{" "}
              results
            </p>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* --- MODALS --- */}

      {/* DEACTIVATE MODAL */}
      {confirmDeactivate && (
        <Modal
          title="Deactivate Teacher"
          onClose={() => setConfirmDeactivate(null)}
        >
          <p className="text-sm mb-4">
            Are you sure you want to deactivate{" "}
            <span className="font-semibold">{confirmDeactivate.name}</span>'s
            account?
          </p>
          <button
            disabled={isProcessingStatus}
            onClick={confirmDeactivateTeacher}
            className="w-full rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-70"
          >
            {isProcessingStatus ? "Processing..." : "Confirm Deactivation"}
          </button>
        </Modal>
      )}

      {/* ACTIVATE MODAL */}
      {confirmActivate && (
        <Modal
          title="Activate Teacher"
          onClose={() => setConfirmActivate(null)}
        >
          <p className="text-sm mb-4">
            Are you sure you want to activate{" "}
            <span className="font-semibold">{confirmActivate.name}</span>'s
            account?
          </p>
          <button
            disabled={isProcessingStatus}
            onClick={confirmActivateTeacher}
            className="w-full rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-70"
          >
            {isProcessingStatus ? "Processing..." : "Confirm Activation"}
          </button>
        </Modal>
      )}

      {/* ADD MODAL */}
      {isAddOpen && (
        <Modal title="Add Teacher" onClose={() => setIsAddOpen(false)}>
          <Input
            label="Full Name"
            value={newTeacher.name}
            onChange={(v) => setNewTeacher({ ...newTeacher, name: v })}
          />
          <Input
            label="Username"
            value={newTeacher.username}
            onChange={(v) => setNewTeacher({ ...newTeacher, username: v })}
          />
          <Input
            label="Email"
            value={newTeacher.email}
            onChange={(v) => setNewTeacher({ ...newTeacher, email: v })}
          />
          <p className="text-sm text-gray-600 mb-4">
            Default password:{" "}
            <span className="font-mono">{DEFAULT_PASSWORD}</span>
          </p>
          <button
            onClick={handleAddTeacher}
            disabled={isAdding}
            className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-70"
          >
            {isAdding ? "Adding..." : "Add"}
          </button>
        </Modal>
      )}

      {/* EDIT MODAL */}
      {isEditOpen && editingTeacher && (
        <Modal title="Edit Teacher" onClose={() => setIsEditOpen(false)}>
          <Input
            label="Full Name"
            value={editingTeacher.name}
            onChange={(v) => setEditingTeacher({ ...editingTeacher, name: v })}
          />
          <Input label="Username" value={editingTeacher.username} disabled />
          <Input label="Email" value={editingTeacher.email} disabled />
          <ModalActions loading={isSavingEdit} onSave={handleSaveEdit} />
        </Modal>
      )}

      {/* RESET MODAL */}
      {resetTeacher && (
        <Modal title="Reset Password" onClose={() => setResetTeacher(null)}>
          <p className="text-sm mb-4">
            Password will be reset to:
            <br />
            <span className="font-mono font-semibold">{DEFAULT_PASSWORD}</span>
          </p>
          <button
            disabled={resetDone || isResetting}
            onClick={handleResetPassword}
            className={`w-full rounded px-4 py-2 text-white ${
              resetDone
                ? "bg-gray-400 cursor-default"
                : "bg-orange-600 hover:bg-orange-700"
            }`}
          >
            {resetDone ? "Password Reset" : "Reset Password"}
          </button>
        </Modal>
      )}
    </div>
  );
}

/* ---------- HELPER COMPONENTS ---------- */

function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
}: {
  label: string;
  sortKey: keyof Teacher;
  currentSort: SortConfig | null;
  onSort: (key: keyof Teacher) => void;
}) {
  return (
    <th
      className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 cursor-pointer hover:bg-gray-100 select-none group transition-colors"
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className="text-gray-400 w-4">
          {currentSort?.key === sortKey ? (
            currentSort.direction === "asc" ? (
              "▲"
            ) : (
              "▼"
            )
          ) : (
            <span className="opacity-0 group-hover:opacity-50 transition-opacity">
              ↕
            </span>
          )}
        </span>
      </div>
    </th>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  color,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color: "blue" | "orange" | "red" | "green";
}) {
  const styles = {
    blue: "border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100",
    orange:
      "border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100",
    red: "border-red-200 text-red-700 bg-red-50 hover:bg-red-100",
    green: "border-green-200 text-green-700 bg-green-50 hover:bg-green-100",
  };

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`min-w-[90px] px-3 py-1 text-xs font-medium rounded-md border transition ${
        disabled
          ? "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
          : styles[color]
      }`}
    >
      {label}
    </button>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <p className="text-gray-500">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

// UPDATED: Blur effect removed from modal background
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded bg-white p-6 shadow-lg">
        <h3 className="font-semibold mb-4 text-lg">{title}</h3>
        {children}
        <button
          onClick={onClose}
          className="mt-4 text-sm text-gray-500 hover:text-gray-800 w-full text-center"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-3">
      <label className="text-sm text-gray-600 block mb-1">{label}</label>
      <input
        disabled={disabled}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded border px-3 py-2 disabled:bg-gray-100 focus:border-blue-500 focus:outline-none transition-colors"
      />
    </div>
  );
}

function ModalActions({
  loading,
  onSave,
}: {
  loading: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 mt-4">
      <button
        disabled={loading}
        onClick={onSave}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-70 transition-colors"
      >
        {loading ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
