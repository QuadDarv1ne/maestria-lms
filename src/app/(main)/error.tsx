"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useAppStore((s) => s.locale);

  return (
    <div className="container mx-auto px-4 py-16 md:py-24 text-center">
      <div className="max-w-md mx-auto space-y-6">
        <motion.div
          className="w-24 h-24 rounded-full bg-red-50 dark:bg-red-950/50 flex items-center justify-center mx-auto"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <AlertTriangle className="w-12 h-12 text-red-500" />
          </motion.div>
        </motion.div>
        <motion.h1
          className="text-5xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          500
        </motion.h1>
        <motion.p
          className="text-muted-foreground"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {t("error.serverErrorDescription", locale)}
        </motion.p>
        {process.env.NODE_ENV === "development" && error && (
          <motion.pre
            className="text-sm text-red-600 bg-red-50 dark:bg-red-950 p-4 rounded-lg max-w-lg mx-auto overflow-auto text-left border border-red-200 dark:border-red-900"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {error.message}
          </motion.pre>
        )}
        <motion.div
          className="flex flex-col sm:flex-row justify-center gap-3 pt-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Button onClick={reset} size="lg">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t("error.tryAgain", locale)}
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              {t("notFound.toHome", locale)}
            </Link>
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
