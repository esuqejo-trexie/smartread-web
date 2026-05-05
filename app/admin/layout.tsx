// web/app/admin/layout.tsx
"use client";

import { useRouter } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Header */}
      <header className="flex items-center justify-between bg-white px-8 py-4 shadow">
        <h1 className="text-xl font-bold">SmartRead – Admin</h1>

        <button
          onClick={() => router.push("/login")} // UI-only logout
          className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600"
        >
          Log out
        </button>
      </header>

      <main className="p-8">{children}</main>
    </div>
  );
}
