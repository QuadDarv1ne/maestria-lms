"use client";

import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/store";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  locale: Locale;
  className?: string;
}

export function Breadcrumbs({ items, locale, className }: BreadcrumbsProps) {
  const homeLabel = t("nav.home", locale);

  return (
    <nav aria-label="Breadcrumb" className={cn("mb-4", className)}>
      <ol className="flex items-center gap-1.5 text-sm">
        <li>
          <Link
            href="/"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={homeLabel}
          >
            <Home className="w-4 h-4" />
          </Link>
        </li>
        {items.map((item, index) => (
          <Fragment key={index}>
            <li aria-hidden="true" className="text-muted-foreground">
              <ChevronRight className="w-4 h-4" />
            </li>
            <li>
              {item.href && index < items.length - 1 ? (
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground transition-colors rounded px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label || "Page"}
                </Link>
              ) : (
                <span className="text-foreground font-medium" aria-current="page">
                  {item.label || "Page"}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
