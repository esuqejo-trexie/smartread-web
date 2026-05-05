"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, username, password);
      const uid = cred.user.uid;

      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error("User profile not found");
      }

      const userData = userSnap.data();

      // ✅ AUTO-ACTIVATE TEACHER (simple fix)
      if (userData.role === "teacher" && userData.status === "invited") {
        await updateDoc(userRef, {
          status: "active",
        });
      }

      const { role } = userData;
      if (role === "admin") {
        router.push("/admin");
      } else if (role === "teacher") {
        router.push("/teacher");
      } else {
        throw new Error("Invalid user role");
      }
    } catch (err) {
      setError("Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8f2e6]">
      {/* Left branding section */}
      <div className="flex w-full md:w-3/8 flex-col items-center justify-center p-8 text-center bg-white">
        <Image
          src="/SmartRead_logo.webp"
          alt="SmartRead Logo"
          width={300}
          height={300}
          priority
        />
        <h2 className="mt-6 text-2xl font-bold text-slate-800">
          Ignite your reading,
          <br />
          Spark your imagination.
        </h2>
      </div>

      {/* Right login card */}
      <div className="flex w-full md:w-5/8 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow">
          <h1 className="mb-8 text-center text-3xl font-bold text-slate-800">
            SmartRead Log In
          </h1>

          <div className="space-y-6">
            {/* Username field */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded border border-slate-300 px-4 py-3 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ff6e61]/40 focus:border-[#ff6e61]"
                placeholder="Enter username"
              />
            </div>

            {/* Password field */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded border border-slate-300 px-4 py-3 pr-12 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ff6e61]/40 focus:border-[#ff6e61]"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    // Eye-off icon
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    // Eye icon
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-center text-sm">{error}</p>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded bg-[#ff6e61] py-3 text-lg font-bold text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {loading ? "LOGGING IN..." : "LOG IN"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
