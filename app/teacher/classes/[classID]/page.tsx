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
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{classData?.name}</h1>
            <p className="text-gray-500 text-sm">
              {learners.length} Learner
              {learners.length !== 1 && "s"}
            </p>
          </div>

          <button
            disabled={classData?.status === "Archived"}
            onClick={() => setOpenAddLearner(true)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition
              ${
                classData?.status === "Archived"
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
              }`}
          >
            + Add Learner
          </button>
        </div>

        {inviteMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-5 py-3 rounded-xl text-sm font-medium shadow-sm">
            {inviteMessage}
          </div>
        )}

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
