"use client";

import { useRouter } from "next/navigation";

import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Users,
  Award,
  GraduationCap,
  BookOpen,
  Star,
  Sparkles,
  Rocket,
  Shield,
  ChevronDown,
} from "lucide-react";
import { CoursePromoCarousel } from "@/components/CoursePromoCarousel";
import { CourseCard } from "@/components/CourseCard";
import { AnimatedCounter } from "@/components/AnimatedCounter";

import { ScrollReveal } from "@/components/ScrollReveal";
import { CATEGORIES } from "@/lib/constants";
import { useCourses } from "@/hooks/useCourses";
import { t } from "@/lib/i18n";


const categoryColors = ["#3776AB", "#F7DF1E", "#E2231A", "#00599C", "#FF6F00", "#3DDC84"];

export function HomePage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const { data: coursesData, isLoading, error } = useCourses({ limit: 6 });
  const featuredCourses = coursesData?.courses ?? [];
  const loading = isLoading;

  const defaultCategories = CATEGORIES.map((c, i) => ({
    id: String(i + 1),
    name: t(c.labelKey, locale),
    slug: c.slug,
    icon: c.icon,
    color: categoryColors[i],
    description: "",
  }));

  return (
    <div>
      <section className="hero-section relative overflow-hidden bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900">
        <div className="hero-mesh absolute inset-0 opacity-20">
          <div className="hero-blob-1 absolute top-20 left-10 w-72 h-72 bg-blue-400 rounded-full blur-[128px]" />
          <div className="hero-blob-2 absolute bottom-20 right-10 w-96 h-96 bg-violet-400 rounded-full blur-[128px]" />
          <div className="hero-blob-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-300 rounded-full blur-[100px]" />
        </div>
        <div className="hero-grid absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <ScrollReveal direction="up" delay={100}>
            <div className="max-w-3xl">
              <Badge className="mb-4 bg-white/15 text-white border-0 hover:bg-white/25 backdrop-blur-sm transition-colors duration-300">
                <Sparkles className="w-4 h-4 mr-1" /> {t("home.heroTitle", locale)}
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
                {t("home.heroSubtitle", locale)}
                <br />
                <span className="hero-gradient-text text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-cyan-200 to-violet-200">
                  {t("home.heroHighlight", locale)}
                </span>
              </h1>
              <p className="text-lg md:text-xl text-blue-100/80 mb-8 max-w-2xl leading-relaxed">
                {t("home.heroDescription", locale)}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="bg-white text-blue-800 hover:bg-blue-50 font-semibold shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/30 hover:-translate-y-0.5 transition-all duration-300"
                  onClick={() => router.push("/catalog")}
                >
                  {t("home.viewCourses", locale)}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 text-white bg-white/10 hover:bg-white/20 hover:border-white/50 backdrop-blur-sm hover:-translate-y-0.5 transition-all duration-300"
                  onClick={() => router.push("?dialog=login")}
                >
                  {t("home.startFree", locale)}
                </Button>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={300} duration={800}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
              {[
                { icon: <BookOpen className="w-5 h-5" />, value: 34, suffix: "+", label: t("home.courses", locale), decimals: 0 },
                { icon: <Users className="w-5 h-5" />, value: 12000, suffix: "+", label: t("home.students", locale), decimals: 0 },
                { icon: <Award className="w-5 h-5" />, value: 1000, suffix: "+", label: t("home.certificates", locale), decimals: 0 },
                { icon: <Star className="w-5 h-5" />, value: 4.8, suffix: "", label: t("home.avgRating", locale), decimals: 1 },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="stat-card bg-white/10 backdrop-blur-md rounded-xl p-4 text-white border border-white/10 hover:bg-white/15 hover:border-white/20 hover:-translate-y-1 transition-all duration-300"
                  aria-label={`${stat.label}: ${stat.value}${stat.suffix}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {stat.icon}
                    <span className="text-2xl font-bold">
                      <AnimatedCounter
                        end={stat.value}
                        suffix={stat.suffix}
                        decimals={stat.decimals || 0}
                        duration={2000}
                      />
                    </span>
                  </div>
                  <p className="text-sm text-blue-200/80">{stat.label}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-white/40" />
        </div>
      </section>

      <ScrollReveal direction="up">
        <section className="container mx-auto px-4 py-12 md:py-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              {t("home.directionsTitle", locale)}
            </h2>
            <p className="text-muted-foreground">{t("home.directionsSubtitle", locale)}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {defaultCategories.map((cat) => (
              <Card
                key={cat.id}
                role="button"
                tabIndex={0}
                className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 border-0 shadow-sm"
                onClick={() => {
                  router.push("/catalog");
                  useAppStore.getState().setCourseFilters({ category: cat.slug, search: "", level: "", sortBy: "popular", freeOnly: false });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push("/catalog");
                    useAppStore.getState().setCourseFilters({ category: cat.slug, search: "", level: "", sortBy: "popular", freeOnly: false });
                  }
                }}
                aria-label={`${cat.name}: ${cat.description}`}
              >
                <CardContent className="p-4 text-center">
                  <div
                    className="w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center text-2xl transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: cat.color + "20" }}
                  >
                    {cat.icon}
                  </div>
                  <h3 className="font-semibold text-sm leading-tight group-hover:text-blue-700 transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {cat.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </ScrollReveal>

      <CoursePromoCarousel />

      <ScrollReveal direction="up">
        <section className="bg-muted/30 py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold">
                  {t("home.popularCourses", locale)}
                </h2>
                <p className="text-muted-foreground mt-1">
                  {t("home.popularCoursesSubtitle", locale)}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push("/catalog")}
                className="hidden sm:flex"
              >
                {t("home.allCourses", locale)}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="border-0 shadow-sm overflow-hidden">
                    <div className="h-40 bg-muted animate-pulse" />
                    <CardContent className="p-4 space-y-3">
                      <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                      <div className="h-3 bg-muted animate-pulse rounded w-full" />
                      <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">{t("catalog.error", locale)}</p>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  {t("catalog.retry", locale)}
                </Button>
              </div>
            ) : featuredCourses.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">{t("catalog.noResults", locale)}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onClick={() => router.push(`/course/${course.id}`)}
                  />
                ))}
              </div>
            )}

            <div className="text-center mt-8 sm:hidden">
              <Button variant="outline" onClick={() => router.push("/catalog")}>
                {t("home.allCourses", locale)}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal direction="up">
        <section className="container mx-auto px-4 py-12 md:py-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              {t("home.whyMaestria", locale)}
            </h2>
            <p className="text-muted-foreground">
              {t("home.whyMaestriaSubtitle", locale)}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <GraduationCap className="w-8 h-8 text-amber-600" />,
                title: t("home.feature1Title", locale),
                desc: t("home.feature1Desc", locale),
                gradient: "from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30",
                iconBg: "bg-amber-100 dark:bg-amber-900/40",
              },
              {
                icon: <Rocket className="w-8 h-8 text-violet-600" />,
                title: t("home.feature2Title", locale),
                desc: t("home.feature2Desc", locale),
                gradient: "from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30",
                iconBg: "bg-violet-100 dark:bg-violet-900/40",
              },
              {
                icon: <Shield className="w-8 h-8 text-blue-700" />,
                title: t("home.feature3Title", locale),
                desc: t("home.feature3Desc", locale),
                gradient: "from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30",
                iconBg: "bg-blue-100 dark:bg-blue-900/40",
              },
            ].map((item, i) => (
              <Card key={i} className="group border-0 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <CardContent className="relative p-6 text-center">
                  <div className={`w-16 h-16 ${item.iconBg} rounded-2xl mx-auto mb-4 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                    {item.icon}
                  </div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </ScrollReveal>

      <section className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 py-16 md:py-20">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-white rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-white rounded-full blur-[80px]" />
        </div>
        <ScrollReveal direction="up">
          <div className="relative container mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
              {t("home.startNowTitle", locale)}
            </h2>
            <p className="text-blue-100/80 mb-8 max-w-lg mx-auto text-lg">
              {t("home.startNowSubtitle", locale)}
            </p>
            <Button
              size="lg"
              className="bg-white text-blue-800 hover:bg-blue-50 font-semibold shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/30 hover:-translate-y-0.5 transition-all duration-300"
              onClick={() => router.push("?dialog=login")}
            >
              {t("home.registerFree", locale)}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}
