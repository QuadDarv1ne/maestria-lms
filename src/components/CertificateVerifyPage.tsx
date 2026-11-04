"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import { t } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { log } from "@/lib/logger";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  ShieldCheck,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";

interface CertificateData {
  number: string;
  issuedAt: string;
  userName: string;
  courseTitle: string;
  courseSlug: string;
}

interface CertificateVerifyPageProps {
  certificateNumber?: string;
}

export function CertificateVerifyPage({
  certificateNumber: initialNumber,
}: CertificateVerifyPageProps) {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const [number, setNumber] = useState(initialNumber ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"found" | "notfound" | null>(null);
  const [data, setData] = useState<CertificateData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialNumber) {
      setNumber(initialNumber.toUpperCase());
    }
  }, [initialNumber]);

  const verify = useCallback(async () => {
    const trimmed = number.trim().toUpperCase();
    if (!trimmed) {
      setError(t("cert.verifyInvalid", locale));
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setData(null);

    try {
      const res = await fetch(`/api/certificates/verify?number=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        if (res.status === 404) {
          setResult("notfound");
        } else {
          setError("Server error");
        }
        return;
      }
      const json = await res.json();
      if (json.valid && json.certificate) {
        setResult("found");
        setData(json.certificate);
      } else {
        setResult("notfound");
      }
    } catch (e: unknown) {
      log.error("Certificate verification failed", { error: e instanceof Error ? e.message : String(e) });
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [number, locale]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") verify();
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      {/* header */}
      <div className="mb-8">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("common.back", locale)}
        </Button>
        <h1 className="text-2xl font-bold mt-4">{t("cert.verifyPageTitle", locale)}</h1>
        <p className="text-muted-foreground mt-1">
          {t("cert.verifyPageDesc", locale)}
        </p>
      </div>

      {/* search form */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input
              placeholder={t("cert.verifyInputPlaceholder", locale)}
              value={number}
              onChange={(e) => setNumber(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="font-mono text-base"
            />
            <Button
              onClick={verify}
              disabled={loading || !number.trim()}
              className="shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("cert.verifyChecking", locale)}
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  {t("cert.verifyButton", locale)}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* error */}
      {error && (
        <Card className="mt-4 border-red-200 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <XCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* not found */}
      {result === "notfound" && (
        <Card className="mt-4 border-red-200 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <XCircle className="w-5 h-5 shrink-0" />
              <span>{t("cert.verifyNotFound", locale)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* found */}
      {result === "found" && data && (
        <Card className="mt-4 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-green-600 dark:text-green-400 mb-4">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <span className="font-semibold text-lg">
                {t("cert.verifyFound", locale)}
              </span>
            </div>

            <div className="space-y-3">
              {/* user name */}
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("cert.completedCourse", locale)}
                  </p>
                  <p className="font-semibold text-lg">{data.userName}</p>
                </div>
              </div>

              {/* course */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("cert.toCourse", locale)}
                  </p>
                  <p className="font-semibold">{data.courseTitle}</p>
                  <a
                    href={`/course/${data.courseSlug}`}
                    className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    {data.courseSlug}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* number & date */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("cert.issueDate", locale)}
                  </p>
                  <p className="font-mono text-sm">{data.number}</p>
                  <Badge variant="outline" className="mt-1">
                    {formatDate(data.issuedAt, locale)}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
