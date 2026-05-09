"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// ── Icons ────────────────────────────────────────────────────────────────────
function IconDashboard(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      {...props}
    >
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
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
function IconChevron(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      {...props}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function IconMenu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      {...props}
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

const navItems = [
  { label: "Dashboard", href: "/teacher", icon: IconDashboard },
  { label: "Classes", href: "/teacher/classes", icon: IconClasses },
];

type TeacherData = { name: string; email: string; role: string };

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<TeacherData | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists() || snap.data().role !== "teacher") {
        await signOut(auth);
        router.push("/login");
        return;
      }

      setTeacher({
        name: snap.data().name ?? snap.data().fullName ?? "Teacher",
        email: snap.data().email ?? user.email ?? "",
        role: snap.data().role,
      });
      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
        <div className="w-8 h-8 border-4 border-[#ff6e61] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initials = teacher?.name
    ? teacher.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "T";

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 mb-10">
        <div className="w-8 h-8 rounded-lg bg-[#ff6e61] flex items-center justify-center shadow-sm flex-shrink-0">
          <span className="text-white font-bold text-xs">SR</span>
        </div>
        <span className="font-bold text-slate-800 text-base tracking-tight">
          SmartRead
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1 px-3">
        <p className="text-[10px] uppercase tracking-widest text-slate-300 font-semibold px-2 mb-2">
          Menu
        </p>
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/teacher"
              ? pathname === "/teacher"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#ff6e61]/10 text-[#ff6e61]"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Profile */}
      <div className="px-3 mt-4">
        <Link
          href="/teacher/profile"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-100 ${
            pathname === "/teacher/profile"
              ? "bg-[#ff6e61]/10 border-[#ff6e61]/10"
              : ""
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-[#ff6e61] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate leading-tight">
              {teacher?.name}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              {teacher?.email}
            </p>
          </div>
          <IconChevron className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#ff6e61] flex-shrink-0 transition-colors" />
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#faf9f7]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-white border-r border-slate-100 py-8 fixed h-full z-20">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl flex flex-col py-8 z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content area - FIXED: prevents horizontal scrolling */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <IconMenu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#ff6e61] flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">SR</span>
            </div>
            <span className="font-bold text-slate-800 text-sm">SmartRead</span>
          </div>
          <div className="w-9" />
        </div>

        {/* Main content - FIXED: handles vertical scrolling only, hides horizontal overflow */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
