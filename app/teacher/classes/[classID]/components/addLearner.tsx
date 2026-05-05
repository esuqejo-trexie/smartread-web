"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";
import type { Learner } from "../page";
import * as XLSX from "xlsx";

import { auth, db, functions } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

type AddLearnerProps = {
  open: boolean;
  onClose: () => void;
  classId: string;
  existingLearners: Learner[];
};

export default function AddLearner({
  open,
  onClose,
  classId,
  existingLearners,
}: AddLearnerProps) {
  // =========================
  // STATE (ALL HOOKS FIRST)
  // =========================

  const [mode, setMode] = useState<"template" | "manual">("template");

  const [formData, setFormData] = useState({
    lrn: "",
    name: "",
    readingProfile: "",
    parentName: "",
    parentEmail: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [uploadSummary, setUploadSummary] = useState<{
    added: number;
    total: number;
    skipped: number;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  const isAllFieldsEmpty = useMemo(() => {
    return Object.values(formData).every((value) => value.trim() === "");
  }, [formData]);

  // 🚨 Must come AFTER all hooks
  if (!open) return null;

  const resetForm = () => {
    setFormData({
      lrn: "",
      name: "",
      readingProfile: "",
      parentName: "",
      parentEmail: "",
    });
    setErrors({});
    setUploadSummary(null);
  };

  // =========================
  // BULK UPLOAD
  // =========================

  const handleDownloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/templates/student_template.xlsx";
    link.download = "student_template.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const normalize = (val: any) =>
    String(val || "")
      .replace(/\s+/g, " ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "") // remove invisible chars
      .trim()
      .toLowerCase();

  const cleanString = (val: any) =>
    String(val || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim();

  const cleanLrn = (val: any) => {
    const cleaned = cleanString(val).replace(/[^\d.eE+-]/g, "");

    if (/^\d+\.0+$/.test(cleaned)) {
      return cleaned.split(".")[0];
    }

    if (/^\d+(\.\d+)?e\+?\d+$/i.test(cleaned)) {
      const numericValue = Number(cleaned);
      if (Number.isSafeInteger(numericValue)) {
        return numericValue.toFixed(0);
      }
    }

    return cleaned.replace(/\D/g, "");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadSummary(null);

    if (!file.name.endsWith(".xlsx")) {
      setUploadSummary({ added: 0, total: 0, skipped: 0 });
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const studentSheetName = workbook.SheetNames.find(
        (name) => normalize(name) === "students",
      );

      if (studentSheetName && studentSheetName !== "students") {
        workbook.Sheets.students = workbook.Sheets[studentSheetName];
        workbook.SheetNames.push("students");
      }

      if (!workbook.Sheets.__smartread_meta) {
        workbook.Sheets.__smartread_meta = {
          A1: { t: "s", v: "SMARTREAD_TEMPLATE_V1" },
          "!ref": "A1:A1",
        };
      }

      if (
        !workbook.SheetNames.some(
          (name) => normalize(name) === "__smartread_meta",
        )
      ) {
        workbook.SheetNames.push("__smartread_meta");
      }

      workbook.Sheets.__smartread_meta.A1 = {
        t: "s",
        v: "SMARTREAD_TEMPLATE_V1",
      };

      // ✅ Flexible sheet check
      const sheetNames = workbook.SheetNames.map((s) => s.toLowerCase());

      if (
        !sheetNames.includes("students") ||
        !sheetNames.includes("__smartread_meta")
      ) {
        console.error("Missing required sheets:", workbook.SheetNames);
        setUploadSummary({ added: 0, total: 0, skipped: 0 });
        return;
      }

      const metaSheet = workbook.Sheets["__smartread_meta"];

      // ✅ FIX: safely extract A1
      const signature = cleanString(metaSheet?.["A1"]?.v);

      if (signature !== "SMARTREAD_TEMPLATE_V1") {
        console.error("Invalid template signature:", signature);
        setUploadSummary({ added: 0, total: 0, skipped: 0 });
        return;
      }

      const sheet = workbook.Sheets["students"];

      const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false, // ✅ prevents scientific notation issues
      });

      if (rawRows.length < 2) {
        setUploadSummary({ added: 0, total: 0, skipped: 0 });
        return;
      }

      const headers = rawRows[0].map((h: any) => cleanString(h));

      const expectedHeaders = [
        "LRN",
        "Learner Name",
        "Reading Profile",
        "Parent/Guardian Name",
        "Parent Email",
      ];

      // ✅ FLEXIBLE HEADER MATCH
      const validHeader =
        expectedHeaders.length === headers.length &&
        expectedHeaders.every((h, i) => normalize(h) === normalize(headers[i]));

      if (!validHeader) {
        console.error("Header mismatch:", headers);
        setUploadSummary({ added: 0, total: 0, skipped: 0 });
        return;
      }

      const dataRows = rawRows.slice(2);

      const parsed = dataRows
        .filter((row) => row.some((cell: any) => cleanString(cell) !== ""))
        .map((row) => ({
          lrn: cleanLrn(row[0]),
          name: cleanString(row[1]),
          readingProfile: cleanString(row[2]),
          parentName: cleanString(row[3]),
          parentEmail: cleanString(row[4]),
        }));

      console.log("PARSED:", parsed);

      const validProfiles = [
        "emerging",
        "developing",
        "transitioning",
        "reading at grade level",
      ];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const valid = parsed.filter((learner) => {
        const normalizedProfile = normalize(learner.readingProfile);

        return (
          learner.lrn &&
          /^\d{12}$/.test(learner.lrn) &&
          learner.name &&
          validProfiles.includes(normalizedProfile) &&
          learner.parentName &&
          learner.parentEmail &&
          emailRegex.test(learner.parentEmail)
        );
      });

      console.log("VALID:", valid);

      if (valid.length === 0) {
        console.warn("No valid learners found");
        setUploadSummary({
          added: 0,
          total: parsed.length,
          skipped: parsed.length,
        });
        return;
      }

      const user = auth.currentUser;
      if (!user) return;

      const teacherSnap = await getDoc(doc(db, "users", user.uid));
      const schoolId = teacherSnap.data()?.schoolId;
      if (!schoolId) return;

      const addLearnerFunction = httpsCallable(functions, "addLearner");

      let addedCount = 0;

      for (const learner of valid) {
        try {
          await addLearnerFunction({
            schoolId,
            classId,
            lrn: learner.lrn,
            learnerName: learner.name,
            readingProfile: learner.readingProfile,
            parentName: learner.parentName,
            parentEmail: learner.parentEmail,
          });
          addedCount++;
        } catch (err) {
          console.error("FAILED ADD:", learner, err);
          continue;
        }
      }

      setUploadSummary({
        added: addedCount,
        total: parsed.length,
        skipped: parsed.length - addedCount,
      });
    } catch (error) {
      console.error("UPLOAD ERROR:", error);
      setUploadSummary({ added: 0, total: 0, skipped: 0 });
    }
  };

  // =========================
  // MANUAL ADD
  // =========================

  const handleManualSubmit = async (e: React.FormEvent) => {
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
      const schoolId = teacherSnap.data()?.schoolId;
      if (!schoolId) return;

      const addLearnerFunction = httpsCallable(functions, "addLearner");

      await addLearnerFunction({
        schoolId,
        classId,
        lrn: formData.lrn,
        learnerName: formData.name,
        readingProfile: formData.readingProfile,
        parentName: formData.parentName,
        parentEmail: formData.parentEmail,
      });

      resetForm();
      onClose();
    } catch (error: any) {
      const errorCode = error?.code || "";

      if (errorCode.includes("already-exists")) {
        setErrors({
          lrn: "This learner is already enrolled in another section in this school.",
        });
      } else {
        console.error(error);
        alert("Something went wrong. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // =========================
  // UI (UNCHANGED)
  // =========================

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl p-6 relative overflow-y-auto max-h-[90vh]">
        <button
          onClick={() => {
            resetForm();
            onClose();
          }}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold mb-6">Add Learners</h2>

        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setMode("template")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === "template"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            Upload via Template
          </button>

          <button
            onClick={() => setMode("manual")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              mode === "manual"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            Add Manually
          </button>
        </div>

        {mode === "template" && (
          <div className="space-y-6">
            {/* STEP 1 */}
            <div className="bg-gray-50 border rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">
                Step 1: Download the Official Template
              </h3>

              <p className="text-sm text-gray-500">
                Use the SmartRead template to ensure correct format and
                validation.
              </p>

              <button
                onClick={handleDownloadTemplate}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
              >
                Download Template (.xlsx)
              </button>
            </div>

            {/* STEP 2 */}
            <div className="bg-gray-50 border rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">
                Step 2: Upload Completed File
              </h3>

              <p className="text-sm text-gray-500">
                Keep the sample row unchanged. Add learners starting from row 3.
              </p>

              <label className="block">
                <span className="sr-only">Choose file</span>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileUpload}
                  className="block w-full text-sm
      file:mr-4 file:py-2 file:px-4
      file:rounded-xl file:border-0
      file:text-sm file:font-semibold
      file:bg-blue-50 file:text-blue-700
      hover:file:bg-blue-100"
                />
              </label>

              {uploadSummary && (
                <div className="mt-4 rounded-xl border p-4 bg-green-50 border-green-200">
                  <p className="font-semibold text-green-700">
                    Upload Complete
                  </p>

                  <p className="text-sm mt-1">
                    Added {uploadSummary.added} / {uploadSummary.total}
                  </p>

                  {uploadSummary.skipped > 0 && (
                    <p className="text-sm text-yellow-700 mt-1">
                      {uploadSummary.skipped} row(s) skipped
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {mode === "manual" && (
          <form onSubmit={handleManualSubmit} className="space-y-5">
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
                <p className="text-red-500 text-xs mt-1">
                  {errors.parentEmail}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isAllFieldsEmpty || isSaving}
              className={`w-full py-2.5 rounded-xl font-semibold transition ${
                isAllFieldsEmpty || isSaving
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {isSaving ? "Saving..." : "Save Learner"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
