"use client";

import React, { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronRight,
  Home,
  HelpCircle,
  Search,
  BookOpen,
  CreditCard,
  Shield,
  Users,
  Settings,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Mail,
  Phone,
} from "lucide-react";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

function getFaqItems(locale: string): FAQItem[] {
  return [
    { id: "faq-1", question: t("help.faq.1q", locale), answer: t("help.faq.1a", locale), category: "learning" },
    { id: "faq-2", question: t("help.faq.2q", locale), answer: t("help.faq.2a", locale), category: "learning" },
    { id: "faq-3", question: t("help.faq.3q", locale), answer: t("help.faq.3a", locale), category: "learning" },
    { id: "faq-4", question: t("help.faq.4q", locale), answer: t("help.faq.4a", locale), category: "learning" },
    { id: "faq-5", question: t("help.faq.5q", locale), answer: t("help.faq.5a", locale), category: "learning" },
    { id: "faq-6", question: t("help.faq.6q", locale), answer: t("help.faq.6a", locale), category: "payment" },
    { id: "faq-7", question: t("help.faq.7q", locale), answer: t("help.faq.7a", locale), category: "payment" },
    { id: "faq-8", question: t("help.faq.8q", locale), answer: t("help.faq.8a", locale), category: "payment" },
    { id: "faq-9", question: t("help.faq.9q", locale), answer: t("help.faq.9a", locale), category: "account" },
    { id: "faq-10", question: t("help.faq.10q", locale), answer: t("help.faq.10a", locale), category: "account" },
    { id: "faq-11", question: t("help.faq.11q", locale), answer: t("help.faq.11a", locale), category: "account" },
    { id: "faq-12", question: t("help.faq.12q", locale), answer: t("help.faq.12a", locale), category: "technical" },
    { id: "faq-13", question: t("help.faq.13q", locale), answer: t("help.faq.13a", locale), category: "technical" },
    { id: "faq-14", question: t("help.faq.14q", locale), answer: t("help.faq.14a", locale), category: "technical" },
    { id: "faq-15", question: t("help.faq.15q", locale), answer: t("help.faq.15a", locale), category: "technical" },
  ];
}

function getCategories(locale: string) {
  return [
    { key: "learning", label: t("help.categories.learning", locale), icon: BookOpen, color: "text-blue-700", bg: "bg-blue-50" },
    { key: "payment", label: t("help.categories.payment", locale), icon: CreditCard, color: "text-amber-600", bg: "bg-amber-50" },
    { key: "account", label: t("help.categories.account", locale), icon: Shield, color: "text-violet-600", bg: "bg-violet-50" },
    { key: "technical", label: t("help.categories.technical", locale), icon: Settings, color: "text-orange-600", bg: "bg-orange-50" },
  ];
}

export function HelpPage() {
  const { navigate, locale } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const faqItems = useMemo(() => getFaqItems(locale), [locale]);
  const categories = useMemo(() => getCategories(locale), [locale]);

  const filteredItems = useMemo(() => {
    let items = faqItems;
    if (activeCategory) {
      items = items.filter((item) => item.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.question.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q)
      );
    }
    return items;
  }, [searchQuery, activeCategory, faqItems]);

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6">
        <button onClick={() => navigate("home")} className="hover:text-foreground transition-colors flex items-center gap-1">
          <Home className="w-4 h-4" />
          {t("nav.home", locale)}
        </button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium">{t("help.title", locale)}</span>
      </nav>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-700 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{t("help.faq", locale)}</h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">{t("help.subtitle", locale)}</p>
      </div>

      {/* Search */}
      <div className="relative mb-8 max-w-lg mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("help.searchPlaceholder", locale)}
          className="pl-10 h-12 text-base"
        />
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        <Button
          variant={activeCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveCategory(null)}
          className={activeCategory === null ? "bg-blue-700 hover:bg-blue-800 text-white" : ""}
        >
          {t("help.allCategories", locale)}
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.key}
            variant={activeCategory === cat.key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(activeCategory === cat.key ? null : cat.key)}
            className={activeCategory === cat.key ? "bg-blue-700 hover:bg-blue-800 text-white" : ""}
          >
            <cat.icon className="w-4 h-4 mr-1.5" />
            {cat.label}
          </Button>
        ))}
      </div>

      {/* FAQ items */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t("help.noResults", locale)}</h3>
          <p className="text-muted-foreground">{t("help.noResultsHint", locale)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isOpen = openItems.has(item.id);
            const cat = categories.find((c) => c.key === item.category);
            return (
              <Card key={item.id} className="border-0 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleItem(item.id)}
                  className="w-full text-left p-4 hover:bg-muted/30 transition-colors flex items-start gap-3"
                >
                  <div className={`w-8 h-8 ${cat?.bg || "bg-gray-50"} rounded-lg flex items-center justify-center shrink-0 mt-0.5`}>
                    {cat ? <cat.icon className={`w-4 h-4 ${cat.color}`} /> : <HelpCircle className="w-4 h-4 text-gray-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm pr-6">{item.question}</h3>
                  </div>
                  <div className="shrink-0 mt-1">
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pl-15">
                    <div className="ml-11 prose text-sm text-muted-foreground leading-relaxed">
                      <p>{item.answer}</p>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Contact support */}
      <Card className="mt-10 border-0 shadow-sm bg-gradient-to-r from-blue-50 to-violet-50">
        <CardContent className="p-8 text-center">
          <MessageCircle className="w-10 h-10 text-blue-700 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">{t("help.contactTitle", locale)}</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">{t("help.contactDesc", locale)}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="mailto:maksimqwe42@mail.ru" className="inline-flex items-center gap-2">
              <Button className="bg-blue-700 hover:bg-blue-800 text-white">
                <Mail className="w-4 h-4 mr-2" />
                {t("help.emailUs", locale)}
              </Button>
            </a>
            <a href="tel:+79150480249">
              <Button variant="outline">
                <Phone className="w-4 h-4 mr-2" />
                +7 (915) 048-02-49
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        {[
          { label: t("footer.userAgreement", locale), route: "terms", icon: Shield, color: "text-blue-700" },
          { label: t("footer.privacyPolicy", locale), route: "privacy", icon: Shield, color: "text-violet-600" },
          { label: t("legal.platformRules", locale), route: "rules", icon: Users, color: "text-amber-600" },
        ].map((link, i) => (
          <Card key={i} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(link.route)}>
            <CardContent className="p-4 flex items-center gap-3">
              <link.icon className={`w-5 h-5 ${link.color}`} />
              <span className="text-sm font-medium">{link.label}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
