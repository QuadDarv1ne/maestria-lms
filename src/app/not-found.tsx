"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Search, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const locale = useAppStore((s) => s.locale);

  return (
    <div className="container mx-auto px-4 py-16 md:py-24 text-center">
      <div className="max-w-md mx-auto space-y-6">
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <motion.div
            className="text-8xl md:text-9xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent"
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            style={{ backgroundSize: "200% 200%" }}
          >
            404
          </motion.div>
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full blur-2xl opacity-50" />
          <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-violet-100 dark:bg-violet-900/30 rounded-full blur-2xl opacity-50" />
        </motion.div>
        <motion.h2
          className="text-2xl font-semibold"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {t("notFound.title", locale)}
        </motion.h2>
        <motion.p
          className="text-muted-foreground"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {t("notFound.description", locale)}
        </motion.p>
        <motion.div
          className="flex flex-col sm:flex-row justify-center gap-3 pt-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Button asChild size="lg">
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              {t("notFound.toHome", locale)}
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/catalog">
              <Search className="w-4 h-4 mr-2" />
              {t("notFound.toCatalog", locale)}
            </Link>
          </Button>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("notFound.goBack", locale)}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
