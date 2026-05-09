"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import AddLearner from "./components/addLearner";
import ViewTable from "./components/viewTable";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

type ClassData = {
  name: string;
  status: "Active" | "Archived";
  schoolId: string;
  teacherId: string;
};

export type Learner = {
  id: string;
  lrn: string;
  learnerCode: string;
  name: string;
  readingProfile: string;
  parentName?: string;
  parentEmail?: string;
  status?: "Pending" | "Invited" | "Joined"; // ✅ ADDED
};

export default function ClassDetailsPage() {
  const params = useParams();
  const classId = params?.classID as string;

  const [mounted, setMounted] = useState(false);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openAddLearner, setOpenAddLearner] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!classId || !mounted) return;

    let unsubscribeLearners: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setError("Not authenticated.");
        setLoading(false);
        return;
      }

      try {
        const teacherSnap = await getDoc(doc(db, "users", user.uid));
        if (!teacherSnap.exists()) {
          setError("Teacher record not found.");
          setLoading(false);
          return;
        }

        const schoolId = teacherSnap.data().schoolId;
        if (!schoolId) {
          setError("School not assigned.");
          setLoading(false);
          return;
        }

        const classRef = doc(db, "schools", schoolId, "classes", classId);
        const classSnap = await getDoc(classRef);

        if (!classSnap.exists()) {
          setError("Class not found.");
          setLoading(false);
          return;
        }

        const data = classSnap.data() as ClassData;

        if (data.teacherId !== user.uid) {
          setError("You don't have access to this class.");
          setLoading(false);
          return;
        }

        setClassData(data);

        const learnersRef = collection(
          db,
          "schools",
          schoolId,
          "classes",
          classId,
          "learners",
        );

        unsubscribeLearners = onSnapshot(learnersRef, (snapshot) => {
          const learnersData: Learner[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Learner, "id">),
          }));

          setLearners(learnersData);
        });
      } catch (err) {
        console.error(err);
        setError("Failed to load class.");
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeLearners) unsubscribeLearners();
    };
  }, [classId, mounted]);

  /* =========================
     Bulk Invite Handler
  ========================== */
  const handleBulkInvite = async (selectedIds: string[]) => {
    if (!classData) return;

    try {
      const sendInvite = httpsCallable(functions, "sendParentInvite");

      const result = await sendInvite({
        schoolId: classData.schoolId,
        classId,
        learnerIds: selectedIds,
      });

      const response = result.data as {
        successCount: number;
        failed: string[];
      };

      if (response.successCount > 0) {
        setInviteMessage(
          `Successfully sent ${response.successCount} invite(s).`,
        );
      }

      if (response.failed.length > 0) {
        setInviteMessage(
          `Sent ${response.successCount} invite(s). ${response.failed.length} failed.`,
        );
      }

      setTimeout(() => setInviteMessage(null), 4000);
    } catch (error: any) {
      console.error(error);
      setInviteMessage("Failed to send invites. Please try again.");
      setTimeout(() => setInviteMessage(null), 4000);
    }
  };

  if (!mounted) return null;

  if (loading)
    return (
      <div className="p-10 text-center text-gray-500">Loading class...</div>
    );

  if (error)
    return (
      <div className="p-10 text-center text-red-500 font-semibold">{error}</div>
    );

  return (
    <>
      <div className="pt-6 pb-2 space-y-4">
        {/* Header */}
        <div className="px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {classData?.name}
            </h1>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">
                {learners.length}
              </span>
              <p className="text-gray-400 text-sm font-medium">
                {learners.length === 1
                  ? "Learner enrolled"
                  : "Learners enrolled"}
              </p>
              {classData?.status === "Archived" && (
                <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                  Archived
                </span>
              )}
            </div>
          </div>

          <button
            disabled={classData?.status === "Archived"}
            onClick={() => setOpenAddLearner(true)}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all duration-150
        ${
          classData?.status === "Archived"
            ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
            : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:scale-[0.97]"
        }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            Add Learner
          </button>
        </div>

        {/* Invite Message Toast */}
        {inviteMessage && (
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 text-green-800 px-5 py-3.5 rounded-xl text-sm font-medium shadow-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-green-500 shrink-0 mt-0.5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              {inviteMessage}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Learner Table */}
        <ViewTable
          learners={learners}
          classStatus={classData?.status}
          onBulkInvite={handleBulkInvite}
          schoolId={classData?.schoolId || ""}
          classId={classId}
        />
      </div>

      {/* Add Learner Modal */}
      <AddLearner
        open={openAddLearner}
        onClose={() => setOpenAddLearner(false)}
        classId={classId}
        existingLearners={learners}
      />
    </>
  );
}
