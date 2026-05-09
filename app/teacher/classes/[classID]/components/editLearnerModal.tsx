"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { Learner } from "../page";
import { auth, db, functions } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

type EditLearnerModalProps = {
  learner: Learner | null;
  schoolId: string;
  classId: string;
  onClose: () => void;
  onUpdate: () => void; // Callback to refresh the learners list
};

export default function EditLearnerModal({
  learner,
  schoolId,
  classId,
  onClose,
  onUpdate,
}: EditLearnerModalProps) {
  const [formData, setFormData] = useState({
    lrn: "",
    name: "",
    readingProfile: "",
    parentName: "",
    parentEmail: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Update form data when learner changes
  useEffect(() => {
    if (learner) {
      setFormData({
        lrn: learner.lrn || "",
        name: learner.name || "",
        readingProfile: learner.readingProfile || "",
        parentName: learner.parentName || "",
        parentEmail: learner.parentEmail || "",
      });
    }
  }, [learner]);

  if (!learner) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.lrn.trim()) {
      newErrors.lrn = "LRN is required.";
    } else if (!/^\d{12}$/.test(formData.lrn)) {
      newErrors.lrn = "LRN must contain exactly 12 digits.";
    }

    if (!formData.name.trim()) newErrors.name = "Required.";
    if (!formData.readingProfile) newErrors.readingProfile = "Required.";
    if (!formData.parentName.trim()) newErrors.parentName = "Required.";

    if (!formData.parentEmail.trim()) {
      newErrors.parentEmail = "Required.";
    } else if (!emailRegex.test(formData.parentEmail)) {
      newErrors.parentEmail = "Invalid email.";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      setIsSaving(true);

      const user = auth.currentUser;
      if (!user) return;

      const teacherSnap = await getDoc(doc(db, "users", user.uid));
      const userSchoolId = teacherSnap.data()?.schoolId;
      if (!userSchoolId) return;

      const updateLearnerFunction = httpsCallable(functions, "updateLearner");

      await updateLearnerFunction({
        schoolId: userSchoolId,
        classId,
        learnerId: learner.id,
        lrn: formData.lrn,
        learnerName: formData.name,
        readingProfile: formData.readingProfile,
        parentName: formData.parentName,
        parentEmail: formData.parentEmail,
      });

      onUpdate(); // Refresh the learners list
      onClose();
    } catch (error: any) {
      console.error(error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl p-6 relative overflow-y-auto max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold mb-6">Edit Learner</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* LRN */}
          <div>
            <label className="block text-sm font-medium mb-1">LRN</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={12}
              value={formData.lrn}
              onChange={(e) => {
                const numericValue = e.target.value.replace(/\D/g, "");
                const limitedValue = numericValue.slice(0, 12);

                setFormData({
                  ...formData,
                  lrn: limitedValue,
                });
              }}
              className={`w-full rounded-xl px-4 py-2 border transition ${
                errors.lrn
                  ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                  : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              } focus:ring-2 focus:outline-none`}
            />
            {errors.lrn && (
              <p className="text-red-500 text-xs mt-1">{errors.lrn}</p>
            )}
          </div>

          {/* Learner Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Learner Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  name: e.target.value,
                })
              }
              className={`w-full rounded-xl px-4 py-2 border transition ${
                errors.name
                  ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                  : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              } focus:ring-2 focus:outline-none`}
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          {/* Reading Profile */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Reading Profile
            </label>
            <select
              value={formData.readingProfile}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  readingProfile: e.target.value,
                })
              }
              className={`w-full rounded-xl px-4 py-2 border transition ${
                errors.readingProfile
                  ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                  : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              } focus:ring-2 focus:outline-none`}
            >
              <option value="" disabled hidden>
                Select Reading Profile
              </option>
              <option value="Emerging">Emerging</option>
              <option value="Developing">Developing</option>
            </select>
            {errors.readingProfile && (
              <p className="text-red-500 text-xs mt-1">
                {errors.readingProfile}
              </p>
            )}
          </div>

          {/* Parent Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Parent Name
            </label>
            <input
              type="text"
              value={formData.parentName}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  parentName: e.target.value,
                })
              }
              className={`w-full rounded-xl px-4 py-2 border transition ${
                errors.parentName
                  ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                  : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              } focus:ring-2 focus:outline-none`}
            />
            {errors.parentName && (
              <p className="text-red-500 text-xs mt-1">{errors.parentName}</p>
            )}
          </div>

          {/* Parent Email */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Parent Email
            </label>
            <input
              type="email"
              value={formData.parentEmail}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  parentEmail: e.target.value,
                })
              }
              className={`w-full rounded-xl px-4 py-2 border transition ${
                errors.parentEmail
                  ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                  : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              } focus:ring-2 focus:outline-none`}
            />
            {errors.parentEmail && (
              <p className="text-red-500 text-xs mt-1">{errors.parentEmail}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl font-semibold transition border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`flex-1 py-2.5 rounded-xl font-semibold transition ${
                isSaving
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
