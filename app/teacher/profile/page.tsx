"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signOut,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";

function IconArrow(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function IconUser(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
function IconMail(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="2,4 12,13 22,4" />
    </svg>
  );
}
function IconSchool(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function IconLock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function IconEye(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconEyeOff(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function IconCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconLogout(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

type Status = { type: "success" | "error"; message: string } | null;

export default function TeacherProfilePage() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<any>(null);
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwStatus, setPwStatus] = useState<Status>(null);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    getDoc(doc(db, "users", user.uid)).then(async (snap) => {
      const data = snap.data();
      setTeacher(data);

      if (data?.schoolId) {
        const schoolSnap = await getDoc(doc(db, "schools", data.schoolId));
        setSchoolName(schoolSnap.data()?.name ?? data.schoolId);
      }

      setLoading(false);
    });
  }, []);

  const handleChangePassword = async () => {
    setPwStatus(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwStatus({ type: "error", message: "Please fill in all fields." });
      return;
    }
    if (newPassword.length < 6) {
      setPwStatus({ type: "error", message: "New password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwStatus({ type: "error", message: "New passwords do not match." });
      return;
    }

    setPwLoading(true);
    try {
      const user = auth.currentUser!;
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setPwStatus({ type: "success", message: "Password updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const msg =
        err.code === "auth/wrong-password" || err.code === "auth/invalid-credential"
          ? "Current password is incorrect."
          : err.code === "auth/too-many-requests"
          ? "Too many attempts. Please try again later."
          : "Failed to update password.";
      setPwStatus({ type: "error", message: msg });
    } finally {
      setPwLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#ff6e61] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initials = teacher?.name
    ? teacher.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "T";

  return (
    <div className="overflow-y-auto">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-3">
        <Link
          href="/teacher"
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 transition-colors text-sm font-medium"
        >
          <IconArrow className="w-4 h-4" />
          Back
        </Link>
        <span className="text-slate-200">/</span>
        <p className="text-sm font-semibold text-slate-700">Profile</p>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-5">
        {/* Avatar card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-[#ff6e61] text-white flex items-center justify-center font-bold text-xl shadow-md flex-shrink-0">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">{teacher?.name ?? "—"}</h1>
            <p className="text-sm text-slate-400 mt-0.5 capitalize">{teacher?.role ?? "Teacher"}</p>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-white rounded-2xl border border-slate-100">
          <div className="px-6 py-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-4">Account Info</p>
            <div className="space-y-4">
              <InfoRow icon={<IconUser className="w-4 h-4" />} label="Full Name" value={teacher?.name ?? "—"} />
              <InfoRow icon={<IconMail className="w-4 h-4" />} label="Email" value={teacher?.email ?? "—"} />
              <InfoRow icon={<IconSchool className="w-4 h-4" />} label="School" value={schoolName || "—"} />
            </div>
          </div>
        </div>

        {/* Change password card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#ff6e61]/10 flex items-center justify-center flex-shrink-0">
              <IconLock className="w-4 h-4 text-[#ff6e61]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Change Password</p>
              <p className="text-[11px] text-slate-400">Update your login password below</p>
            </div>
          </div>

          <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-4 py-3 mb-5 mt-3 leading-relaxed">
            To change your password, enter your <span className="font-semibold text-slate-500">current password</span> to
            verify it's you, then type and confirm your new password.
          </p>

          <div className="space-y-4">
            <PasswordInput
              label="Current Password"
              hint="This is the password you use to log in to SmartRead."
              value={currentPassword}
              onChange={setCurrentPassword}
              show={showCurrent}
              onToggle={() => setShowCurrent((v) => !v)}
            />
            <PasswordInput
              label="New Password"
              hint="At least 6 characters. Use a mix of letters and numbers for a stronger password."
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              onToggle={() => setShowNew((v) => !v)}
            />
            <PasswordInput
              label="Confirm New Password"
              hint="Type your new password again to make sure there are no typos."
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
            />
          </div>

          {pwStatus && (
            <div
              className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
                pwStatus.type === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {pwStatus.type === "success" && <IconCheck className="w-4 h-4 flex-shrink-0" />}
              {pwStatus.message}
            </div>
          )}

          <button
            onClick={handleChangePassword}
            disabled={pwLoading}
            className="mt-4 w-full bg-[#ff6e61] hover:opacity-90 disabled:opacity-60 text-white font-semibold text-sm rounded-xl py-3 transition-opacity"
          >
            {pwLoading ? "Updating…" : "Update Password"}
          </button>
        </div>

        {/* Logout card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Sign Out</p>
              <p className="text-[11px] text-slate-400 mt-0.5">You'll be returned to the login screen.</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 transition-colors text-sm font-semibold"
            >
              <IconLogout className="w-4 h-4" />
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-slate-400 font-medium">{label}</p>
        <p className="text-sm font-semibold text-slate-700 truncate">{value}</p>
      </div>
    </div>
  );
}

function PasswordInput({
  label,
  hint,
  value,
  onChange,
  show,
  onToggle,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-11 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#ff6e61]/25 focus:border-[#ff6e61] transition-colors"
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">{hint}</p>
    </div>
  );
}