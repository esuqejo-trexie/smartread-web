"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { functions, db, auth } from "@/lib/firebase";

type ClassItem = {
  id: string;
  name: string;
  status: "Active" | "Archived";
};

type Filter = "all" | "active" | "archived";

// ── Icons ────────────────────────────────────────────────────────────────────
function IconPlus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function IconDots(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <circle cx="12" cy="5" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
  );
}
function IconEdit(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function IconArchive(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}
function IconRestore(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
    </svg>
  );
}
function IconArrow(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function IconEmpty(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

export default function TeacherClassesPage() {
  const router = useRouter();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("active");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [editName, setEditName] = useState("");

  const menuRef = useRef<HTMLDivElement | null>(null);

  // ── Load classes ────────────────────────────────────────────────────────
  useEffect(() => {
    let unsubSnap: (() => void) | null = null;

    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (!user) return;

      const userSnap = await getDoc(doc(db, "users", user.uid));
      const schoolId = userSnap.data()?.schoolId;

      const constraints = [where("teacherId", "==", user.uid)];
      if (filter !== "all")
        constraints.push(where("status", "==", filter === "active" ? "Active" : "Archived"));

      const q = query(collection(db, "schools", schoolId, "classes"), ...constraints);

      unsubSnap = onSnapshot(q, (snap) => {
        setClasses(
          snap.docs
            .map((d) => ({ id: d.id, name: d.data().name, status: d.data().status }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      });
    });

    return () => {
      unsubAuth();
      if (unsubSnap) unsubSnap();
    };
  }, [filter]);

  // ── Outside click closes menu ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setActiveMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────
  const createClass = async () => {
    if (!className.trim() || loading) return;
    setLoading(true);
    try {
      await httpsCallable(functions, "createClass")({ name: className.trim() });
      setShowModal(false);
      setClassName("");
    } finally {
      setLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!editingClass || !editName.trim()) return;
    const user = auth.currentUser;
    if (!user) return;
    const snap = await getDoc(doc(db, "users", user.uid));
    const schoolId = snap.data()?.schoolId;
    await updateDoc(doc(db, "schools", schoolId, "classes", editingClass.id), { name: editName.trim() });
    setEditingClass(null);
  };

  const toggleArchive = async (cls: ClassItem) => {
    const user = auth.currentUser;
    if (!user) return;
    const snap = await getDoc(doc(db, "users", user.uid));
    const schoolId = snap.data()?.schoolId;
    await updateDoc(doc(db, "schools", schoolId, "classes", cls.id), {
      status: cls.status === "Active" ? "Archived" : "Active",
    });
    setActiveMenu(null);
  };

  const counts = {
    all: classes.length,
    active: classes.filter((c) => c.status === "Active").length,
    archived: classes.filter((c) => c.status === "Archived").length,
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-[#faf9f7]/90 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Manage</p>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">Classes</h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#ff6e61] hover:opacity-90 active:scale-95 transition text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm"
        >
          <IconPlus className="w-3.5 h-3.5" />
          Create Class
        </button>
      </div>

      <div className="p-6 space-y-5 flex-1">
        {/* Filter tabs */}
        <div className="flex gap-1 bg-white border border-slate-100 rounded-xl p-1 w-fit shadow-sm">
          {(["active", "archived", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg capitalize transition-colors ${
                filter === f
                  ? "bg-[#ff6e61] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              {f}
              <span className={`ml-1.5 text-[10px] font-bold ${filter === f ? "opacity-70" : "opacity-50"}`}>
                {f === "all" ? classes.length : f === "active" ? counts.active : counts.archived}
              </span>
            </button>
          ))}
        </div>

        {/* Empty state */}
        {classes.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
              <IconEmpty className="w-6 h-6 text-slate-300" />
            </div>
            <p className="font-semibold text-slate-700">No classes found</p>
            <p className="text-sm text-slate-400 mt-1">
              {filter === "archived" ? "No archived classes yet." : "Create your first class to get started."}
            </p>
            {filter !== "archived" && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-5 inline-flex items-center gap-2 bg-[#ff6e61] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition"
              >
                <IconPlus className="w-3.5 h-3.5" />
                Create Class
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <div
              key={cls.id}
              onClick={() => cls.status === "Active" && router.push(`/teacher/classes/${cls.id}`)}
              className={`relative bg-white rounded-2xl border border-slate-100 p-5 transition-all group ${
                cls.status === "Active"
                  ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                  : "opacity-60 cursor-default"
              }`}
            >
              {/* Status dot */}
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                    cls.status === "Active"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      cls.status === "Active" ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                  />
                  {cls.status}
                </div>

                {/* Context menu */}
                <div
                  ref={activeMenu === cls.id ? menuRef : null}
                  className="relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setActiveMenu(activeMenu === cls.id ? null : cls.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <IconDots className="w-4 h-4" />
                  </button>

                  {activeMenu === cls.id && (
                    <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-100 rounded-xl shadow-lg overflow-hidden z-10">
                      <button
                        onClick={() => {
                          setEditingClass(cls);
                          setEditName(cls.name);
                          setActiveMenu(null);
                        }}
                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <IconEdit className="w-3.5 h-3.5 text-slate-400" />
                        Edit name
                      </button>
                      <div className="border-t border-slate-50" />
                      <button
                        onClick={() => toggleArchive(cls)}
                        className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-left text-sm transition-colors ${
                          cls.status === "Active"
                            ? "text-red-500 hover:bg-red-50"
                            : "text-emerald-600 hover:bg-emerald-50"
                        }`}
                      >
                        {cls.status === "Active" ? (
                          <IconArchive className="w-3.5 h-3.5" />
                        ) : (
                          <IconRestore className="w-3.5 h-3.5" />
                        )}
                        {cls.status === "Active" ? "Archive class" : "Restore class"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Class name */}
              <h2 className="font-bold text-slate-800 text-base leading-tight mb-1 pr-2">{cls.name}</h2>
              <p className="text-[11px] text-slate-400">Tap to view learners</p>

              {/* Arrow hint on hover */}
              {cls.status === "Active" && (
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <IconArrow className="w-4 h-4 text-[#ff6e61]" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create modal */}
      {showModal && (
        <Modal title="Create New Class" onClose={() => { setShowModal(false); setClassName(""); }}>
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Class Name</label>
              <input
                autoFocus
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createClass()}
                placeholder="e.g. Grade 3 - Section A"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#ff6e61]/25 focus:border-[#ff6e61] transition-colors"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">Give your class a clear, descriptive name.</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setShowModal(false); setClassName(""); }}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800 font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createClass}
                disabled={loading || !className.trim()}
                className="px-5 py-2 bg-[#ff6e61] text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition"
              >
                {loading ? "Creating…" : "Create Class"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editingClass && (
        <Modal title="Edit Class Name" onClose={() => setEditingClass(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Class Name</label>
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#ff6e61]/25 focus:border-[#ff6e61] transition-colors"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setEditingClass(null)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800 font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={!editName.trim()}
                className="px-5 py-2 bg-[#ff6e61] text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Modal wrapper ── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-slate-100">
        <div className="px-6 py-5 border-b border-slate-50">
          <h2 className="font-bold text-slate-800 text-base">{title}</h2>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}