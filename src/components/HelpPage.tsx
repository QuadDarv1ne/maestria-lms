"use client";

import React, { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

const faqItems: FAQItem[] = [
  // Обучение
  { id: "faq-1", question: "Как записаться на курс?", answer: "Для записи на курс перейдите в Каталог курсов, выберите интересующий вас курс и нажмите кнопку «Записаться». Для бесплатных курсов доступ откроется сразу после регистрации. Для платных курсов необходимо произвести оплату.", category: "learning" },
  { id: "faq-2", question: "Как получить сертификат?", answer: "Сертификат выдаётся автоматически после завершения всех обязательных шагов курса и достижения 100% прогресса. Сертификат будет доступен в разделе «Сертификаты» вашего профиля. Вы можете скачать его в формате PDF или поделиться ссылкой на него.", category: "learning" },
  { id: "faq-3", question: "Можно ли проходить курсы в своём темпе?", answer: "Да, все курсы на Maestria доступны в любое время. Вы можете проходить уроки в удобном для вас темпе, возвращаться к пройденным материалам и повторять их неограниченное количество раз. Ваш прогресс сохраняется автоматически.", category: "learning" },
  { id: "faq-4", question: "Сколько времени занимает прохождение курса?", answer: "Длительность курса указана на его странице в каталоге. В среднем курс занимает от 10 до 40 часов. Вы можете распределить обучение по собственному графику — ограничений по времени нет.", category: "learning" },
  { id: "faq-5", question: "Какие типы заданий есть на курсах?", answer: "На платформе доступны 5 типов шагов: текстовые уроки с теорией, видео-лекции, квизы (тесты с выбором ответа), практические задания по программированию и проекты. Каждый тип шага проверяется автоматически или преподавателем.", category: "learning" },
  // Оплата
  { id: "faq-6", question: "Как оплатить курс?", answer: "Оплата осуществляется через интегрированные платёжные системы на странице курса. Мы принимаем банковские карты (МИР, Visa, Mastercard), Систему быстрых платежей (СБП) и другие способы. Оплата безопасна и защищена шифрованием.", category: "payment" },
  { id: "faq-7", question: "Можно ли вернуть деньги за курс?", answer: "Да, в соответствии с Законом о защите прав потребителей вы можете отказаться от услуги в течение 14 календарных дней с момента оплаты. После начала обучения возврат осуществляется пропорционально неиспользованной части. Подробнее см. Политику возврата средств.", category: "payment" },
  { id: "faq-8", question: "Есть ли скидки и промокоды?", answer: "Maestria регулярно проводит акции и предоставляет промокоды на скидки. Следите за уведомлениями на платформе и нашими каналами в VK Video и Rutube. Также скидки могут предоставляться при покупке нескольких курсов одновременно.", category: "payment" },
  // Аккаунт
  { id: "faq-9", question: "Как восстановить пароль?", answer: "На странице входа нажмите ссылку «Забыли пароль?», введите email, указанный при регистрации, и следуйте инструкциям в письме. Если письмо не приходит, проверьте папку «Спам» или обратитесь в поддержку.", category: "account" },
  { id: "faq-10", question: "Как включить двухфакторную аутентификацию?", answer: "Перейдите в настройки профиля и активируйте 2FA. Вам будет предложено использовать приложение-аутентификатор (Google Authenticator, Authy и др.). После настройки при каждом входе потребуется вводить код из приложения.", category: "account" },
  { id: "faq-11", question: "Как изменить роль со студента на преподавателя?", answer: "Для получения роли преподавателя обратитесь к администратору платформы через форму поддержки или по email maksimqwe42@mail.ru. Вам потребуется предоставить информацию о вашей квалификации и опыте преподавания.", category: "account" },
  // Технические
  { id: "faq-12", question: "Какие браузеры поддерживаются?", answer: "Maestria работает во всех современных браузерах: Google Chrome, Mozilla Firefox, Safari, Microsoft Edge, Яндекс.Браузер. Рекомендуем использовать последнюю версию браузера для оптимальной работы платформы.", category: "technical" },
  { id: "faq-13", question: "Как сменить тему оформления?", answer: "В правом верхнем углу экрана нажмите на иконку палитры и выберите одну из трёх тем: Светлая, Тёмная или Янтарная. Ваш выбор сохраняется автоматически и синхронизируется между сессиями.", category: "technical" },
  { id: "faq-14", question: "Как сменить язык интерфейса?", answer: "Нажмите на иконку глобуса в правом верхнем углу экрана и выберите нужный язык: Русский, English или 中文. Язык интерфейса изменится мгновенно, и ваш выбор будет сохранён.", category: "technical" },
  { id: "faq-15", question: "Код не отправляется на проверку. Что делать?", answer: "Убедитесь, что ваш код не содержит синтаксических ошибок. Попробуйте обновить страницу. Если проблема сохраняется, очистите кэш браузера или попробуйте другой браузер. При повторяющихся ошибках обратитесь в поддержку.", category: "technical" },
];

const categories = [
  { key: "learning", label: "Обучение", icon: BookOpen, color: "text-blue-700", bg: "bg-blue-50" },
  { key: "payment", label: "Оплата и возврат", icon: CreditCard, color: "text-amber-600", bg: "bg-amber-50" },
  { key: "account", label: "Аккаунт и безопасность", icon: Shield, color: "text-violet-600", bg: "bg-violet-50" },
  { key: "technical", label: "Технические вопросы", icon: Settings, color: "text-orange-600", bg: "bg-orange-50" },
];

export function HelpPage() {
  const { navigate, locale } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

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
  }, [searchQuery, activeCategory]);

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
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{t("help.title", locale)}</h1>
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
          <h2 className="text-xl font-bold mb-2">{t("help.stillNeedHelp", locale)}</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">{t("help.stillNeedHelpDesc", locale)}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="mailto:maksimqwe42@mail.ru" className="inline-flex items-center gap-2">
              <Button className="bg-blue-700 hover:bg-blue-800 text-white">
                <Mail className="w-4 h-4 mr-2" />
                {t("help.emailSupport", locale)}
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
