"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Award,
  Download,
  Printer,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

/* ── helpers ─────────────────────────────────────────────────────────── */

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
}

function generateCertificateNumber(courseId: string, userId: string): string {
  const h = hashString(courseId + userId);
  const year = new Date().getFullYear();
  return `MAE-${year}-${h.slice(0, 4)}-${h.slice(4, 8)}`;
}

/* ── types ───────────────────────────────────────────────────────────── */

interface CourseData {
  id: string;
  title: string;
  hasCertificate: boolean;
  isEnrolled: boolean;
  enrollmentStatus: string | null;
  enrollmentProgress: number;
}

/* ── component ───────────────────────────────────────────────────────── */

export function CertificatePage({ courseId }: { courseId: string }) {
  const { user, navigate, locale } = useAppStore();
  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const certRef = useRef<HTMLDivElement>(null);

  /* fetch course */
  useEffect(() => {
    let cancelled = false;
    const fetchCourse = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/courses/${courseId}`);
        if (!res.ok) {
          setError(t("cert.courseNotFound", locale));
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setCourse(data.course);
        }
      } catch {
        if (!cancelled) {
          setError(t("cert.loadError", locale));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    fetchCourse();
    return () => { cancelled = true; };
  }, [courseId, locale]);

  /* derived state */
  const isCompleted = course?.enrollmentStatus === "completed" || course?.enrollmentProgress === 100;
  const isEnrolled = course?.isEnrolled;
  const certificateNumber = user && courseId ? generateCertificateNumber(courseId, user.id) : "";
  const completionDate = new Date().toISOString();

  /* download: try html2canvas (if available), else print */
  const handleDownload = useCallback(async () => {
    if (!certRef.current) return;

    try {
      // Dynamic import – will fail silently if package is not installed
      const html2canvas = (await import("html2canvas" as string)).default;
      const canvas = await html2canvas(certRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `certificate-${certificateNumber}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // Fallback: use Print dialog (Save as PDF)
      window.print();
    }
  }, [certificateNumber]);

  /* print */
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  /* ── loading state ───────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4 max-w-4xl mx-auto">
          <div className="h-10 bg-gray-200 rounded w-1/3" />
          <div className="h-[500px] bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  /* ── error / unauthorized states ─────────────────────────────────── */
  if (error || !course) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {error || t("cert.courseNotFound", locale)}
        </h2>
        <Button variant="outline" onClick={() => navigate("catalog")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("common.back", locale)}
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {t("cert.loginToAccess", locale)}
        </h2>
        <Button
          className="bg-blue-700 hover:bg-blue-800 text-white mt-2"
          onClick={() => navigate("login")}
        >
          {t("cert.loginBtn", locale)}
        </Button>
      </div>
    );
  }

  if (!isEnrolled) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {t("cert.notEnrolled", locale)}
        </h2>
        <p className="text-muted-foreground mb-4">
          {t("cert.instructions", locale)}
        </p>
        <Button
          className="bg-blue-700 hover:bg-blue-800 text-white"
          onClick={() => navigate(`course/${courseId}`)}
        >
          {t("cert.toCourse", locale)}
        </Button>
      </div>
    );
  }

  if (!isCompleted) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {t("cert.notCompleted", locale)}
        </h2>
        <p className="text-muted-foreground mb-2">
          {t("cert.progressText", locale)}{" "}
          <span className="font-semibold">{course.enrollmentProgress}%</span>
        </p>
        <p className="text-muted-foreground mb-4">
          {t("cert.continueLearning", locale)}
        </p>
        <Button
          className="bg-blue-700 hover:bg-blue-800 text-white"
          onClick={() => navigate(`course/${courseId}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("cert.continueLearning", locale)}
        </Button>
      </div>
    );
  }

  if (!course.hasCertificate) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {t("cert.noCertificate", locale)}
        </h2>
        <Button variant="outline" onClick={() => navigate(`course/${courseId}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("cert.backToCourse", locale)}
        </Button>
      </div>
    );
  }

  /* ── certificate ─────────────────────────────────────────────────── */
  const userName = user.name || user.email;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* action bar – hidden on print */}
      <div className="print:hidden flex items-center justify-between mb-6 max-w-5xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(`course/${courseId}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("cert.toCourse", locale)}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            {t("cert.print", locale)}
          </Button>
          <Button
            className="bg-blue-700 hover:bg-blue-800 text-white"
            onClick={handleDownload}
          >
            <Download className="w-4 h-4 mr-2" />
            {t("cert.download", locale)}
          </Button>
        </div>
      </div>

      {/* certificate card */}
      <div className="flex justify-center">
        <div
          ref={certRef}
          className="relative w-full max-w-5xl bg-white print:max-w-none print:shadow-none"
          style={{
            aspectRatio: "297 / 210", /* A4 landscape */
          }}
        >
          {/* ── decorative border ─────────────────────────────────── */}
          {/* outer border */}
          <div className="absolute inset-0 rounded-sm border-[6px] border-blue-700/80 pointer-events-none" />
          {/* inner border */}
          <div className="absolute inset-3 rounded-sm border-2 border-violet-600/50 pointer-events-none" />

          {/* corner ornaments */}
          {[
            "top-5 left-5",
            "top-5 right-5",
            "bottom-5 left-5",
            "bottom-5 right-5",
          ].map((pos, i) => (
            <div
              key={i}
              className={`absolute ${pos} w-8 h-8 pointer-events-none`}
            >
              <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
                {i < 2 ? (
                  // top corners
                  <path
                    d={i === 0 ? "M0 32V8C0 3.6 3.6 0 8 0H32" : "M32 32V8C32 3.6 28.4 0 24 0H0"}
                    stroke="url(#cg)"
                    strokeWidth="2"
                    fill="none"
                  />
                ) : (
                  // bottom corners
                  <path
                    d={i === 2 ? "M0 0V24C0 28.4 3.6 32 8 32H32" : "M32 0V24C32 28.4 28.4 32 24 32H0"}
                    stroke="url(#cg)"
                    strokeWidth="2"
                    fill="none"
                  />
                )}
                <defs>
                  <linearGradient id="cg" x1="0" y1="0" x2="32" y2="32">
                    <stop stopColor="#1d4ed8" />
                    <stop offset="1" stopColor="#7c3aed" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          ))}

          {/* ── watermark ─────────────────────────────────────────── */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
            <div
              className="text-[180px] font-black select-none"
              style={{
                color: "rgba(30, 64, 175, 0.03)",
                transform: "rotate(-25deg)",
                lineHeight: 1,
              }}
            >
              MAESTRIA
            </div>
          </div>

          {/* ── subtle pattern ────────────────────────────────────── */}
          <div
            className="absolute inset-8 pointer-events-none opacity-[0.025]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, transparent, transparent 20px, #1d4ed8 20px, #1d4ed8 21px)',
            }}
          />

          {/* ── content ───────────────────────────────────────────── */}
          <div className="relative z-10 flex flex-col items-center justify-between h-full px-12 py-8 sm:px-16 sm:py-10">
            {/* top: logo + title */}
            <div className="flex flex-col items-center gap-2">
              {/* Maestria logo */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-700 to-violet-600 flex items-center justify-center">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <span
                  className="text-2xl font-bold tracking-widest"
                  style={{
                    background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  MAESTRIA
                </span>
              </div>

              {/* decorative line */}
              <div className="w-40 h-[2px] bg-gradient-to-r from-transparent via-blue-700/40 to-transparent" />

              {/* title */}
              <h1
                className="text-4xl sm:text-5xl font-black tracking-[0.25em] mt-1"
                style={{
                  background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {t("cert.title", locale)}
              </h1>
            </div>

            {/* middle: main text */}
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-gray-500 text-sm sm:text-base tracking-wide">
                {t("cert.certificateText", locale)}
              </p>

              {/* user name */}
              <h2
                className="text-3xl sm:text-4xl font-bold text-gray-900 italic"
                style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
              >
                {userName}
              </h2>

              <p className="text-gray-500 text-sm sm:text-base tracking-wide">
                {t("cert.completedCourse", locale)}
              </p>

              {/* course title */}
              <h3 className="text-2xl sm:text-3xl font-bold text-blue-800">
                «{course.title}»
              </h3>
            </div>

            {/* bottom: date + number + signature */}
            <div className="w-full flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">
              {/* left: date & number */}
              <div className="flex flex-col items-center sm:items-start gap-1 text-sm text-gray-500">
                <span>{t("cert.issueDate", locale)}: {formatDate(completionDate, locale)}</span>
                <span className="font-mono text-xs tracking-wider text-gray-400">
                  {certificateNumber}
                </span>
              </div>

              {/* center: seal */}
              <div className="flex flex-col items-center -mt-2 sm:-mt-4">
                <div className="relative w-20 h-20">
                  {/* outer ring */}
                  <div className="absolute inset-0 rounded-full border-[3px] border-amber-500/70" />
                  <div className="absolute inset-1.5 rounded-full border border-amber-400/40" />
                  {/* inner */}
                  <div className="absolute inset-3 rounded-full bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center">
                    <ShieldCheck className="w-8 h-8 text-amber-600" />
                  </div>
                </div>
              </div>

              {/* right: signature */}
              <div className="flex flex-col items-center sm:items-end gap-1">
                {/* signature line */}
                <div className="w-48 border-b border-gray-400 mb-0.5" />
                <span className="text-sm font-semibold text-gray-800">
                  {t("cert.director", locale)}
                </span>
                <span className="text-xs text-gray-500 text-center sm:text-right max-w-[220px]">
                  {t("cert.issuedBy", locale)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* print styles injected once */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          [ref] > div,
          div[ref] {
            visibility: visible;
          }
          /* print only the certificate container */
          .print\\:hidden {
            display: none !important;
          }
          .print\\:max-w-none {
            max-width: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
