"use client";

import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Zap,
  BookOpen,
  Users,
  Award,
  Smartphone,
  Clock,
  Crown,
  Mail,
  Phone,
  MapPin,
  ArrowRight,
  Code2,
  Gamepad2,
  BarChart3,
  Cpu,
  Globe,
  Target,
  Sparkles,
  Heart,
  GraduationCap,
} from "lucide-react";

export function AboutPage() {
  const { navigate, locale } = useAppStore();
  const tr = (key: string) => t(key, locale);

  return (
    <div>
      {/* ===== 1. Hero Section ===== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-800 via-violet-700 to-indigo-900">
        <div className="absolute inset-0 bg-black/10" />
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-3xl" />
        <div className="relative container mx-auto px-4 py-16 md:py-28">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4 bg-white/20 text-white border-0 hover:bg-white/30 text-sm">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              {tr("about.platformBadge")}
            </Badge>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              {tr("about.platformTitle")}{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-amber-200">
                Maestria
              </span>
            </h1>
            <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed">
              {tr("about.platformDesc")}
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button
                size="lg"
                className="bg-white text-blue-800 hover:bg-blue-50 font-semibold"
                onClick={() => navigate("catalog")}
              >
                {tr("about.viewCourses")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white bg-blue-600 hover:bg-blue-700 hover:border-blue-600"
                onClick={() => navigate("login")}
              >
                {tr("about.startFree")}
              </Button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-14 max-w-3xl mx-auto">
            {[
              { icon: <BookOpen className="w-5 h-5" />, value: "12+", label: tr("about.coursesCount") },
              { icon: <Users className="w-5 h-5" />, value: "12 000+", label: tr("about.studentsCount") },
              { icon: <Award className="w-5 h-5" />, value: "1 000+", label: tr("about.certificatesCount") },
              { icon: <GraduationCap className="w-5 h-5" />, value: "95%", label: tr("about.satisfiedCount") },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-white"
              >
                <div className="flex items-center gap-2 mb-1">
                  {stat.icon}
                  <span className="text-2xl font-bold">{stat.value}</span>
                </div>
                <p className="text-sm text-blue-200">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 2. Mission Section ===== */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <Badge className="mb-3 bg-blue-100 text-blue-700 border-0">
              <Target className="w-3.5 h-3.5 mr-1" />
              {tr("about.mission")}
            </Badge>
            <h2 className="text-2xl md:text-4xl font-bold mb-2">{tr("about.mission")}</h2>
            <p className="text-muted-foreground text-lg">
              {tr("about.missionDesc")}
            </p>
          </div>

          <div className="space-y-6 text-base md:text-lg text-muted-foreground leading-relaxed">
            <p>
              {tr("about.missionBody1")}
            </p>

            <p>
              {tr("about.missionBody2")}
            </p>

            <p>
              {tr("about.missionBody3")}
            </p>

            <p>
              {tr("about.missionBody4")}
            </p>
          </div>
        </div>
      </section>

      {/* ===== 3. Director Section ===== */}
      <section className="bg-gray-50 py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <Badge className="mb-3 bg-amber-100 text-amber-700 border-0">
              <Crown className="w-3.5 h-3.5 mr-1" />
              {tr("about.leadership")}
            </Badge>
            <h2 className="text-2xl md:text-4xl font-bold mb-2">{tr("about.leadership")}</h2>
            <p className="text-muted-foreground">
              {tr("about.leadershipDesc")}
            </p>
          </div>

          <Card className="max-w-3xl mx-auto border-0 shadow-lg overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-blue-800 via-violet-700 to-indigo-900 p-6 md:p-8 flex flex-col sm:flex-row items-center gap-6">
                <Avatar className="w-24 h-24 border-4 border-white/30 shadow-xl">
                  <AvatarFallback className="bg-amber-500 text-white text-2xl font-bold">
                    ДИ
                  </AvatarFallback>
                </Avatar>
                <div className="text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                    <Crown className="w-5 h-5 text-amber-300" />
                    <h3 className="text-2xl font-bold text-white">
                      {tr("about.directorName")}
                    </h3>
                  </div>
                  <p className="text-blue-200 text-sm mb-3">
                    {tr("about.directorRole")}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 text-sm text-blue-100">
                    <a
                      href="mailto:maksimqwe42@mail.ru"
                      className="flex items-center gap-2 hover:text-white transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      maksimqwe42@mail.ru
                    </a>
                    <a
                      href="tel:+79150480249"
                      className="flex items-center gap-2 hover:text-white transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      +7 (915) 048-02-49
                    </a>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8">
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p>
                    {tr("about.directorBody1")}
                  </p>
                  <p>
                    {tr("about.directorBody2")}
                  </p>
                  <p>
                    {tr("about.directorBody3")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ===== 4. Advantages Section ===== */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <div className="text-center mb-10">
          <Badge className="mb-3 bg-violet-100 text-violet-700 border-0">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            {tr("about.advantages")}
          </Badge>
          <h2 className="text-2xl md:text-4xl font-bold mb-2">
            {tr("about.whyChoose")}
          </h2>
          <p className="text-muted-foreground text-lg">
            {tr("about.whyChooseDesc")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: <Zap className="w-7 h-7 text-blue-700" />,
              bg: "bg-blue-50",
              title: tr("about.advInteractive"),
              desc: tr("about.advInteractiveDesc"),
            },
            {
              icon: <BookOpen className="w-7 h-7 text-violet-600" />,
              bg: "bg-violet-50",
              title: tr("about.advStepByStep"),
              desc: tr("about.advStepByStepDesc"),
            },
            {
              icon: <Users className="w-7 h-7 text-amber-600" />,
              bg: "bg-amber-50",
              title: tr("about.advTeachers"),
              desc: tr("about.advTeachersDesc"),
            },
            {
              icon: <Award className="w-7 h-7 text-orange-600" />,
              bg: "bg-orange-50",
              title: tr("about.advCertificates"),
              desc: tr("about.advCertificatesDesc"),
            },
            {
              icon: <Smartphone className="w-7 h-7 text-blue-700" />,
              bg: "bg-blue-50",
              title: tr("about.advSBP"),
              desc: tr("about.advSBPDesc"),
            },
            {
              icon: <Clock className="w-7 h-7 text-violet-600" />,
              bg: "bg-violet-50",
              title: tr("about.adv247"),
              desc: tr("about.adv247Desc"),
            },
          ].map((item, i) => (
            <Card
              key={i}
              className="border-0 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1"
            >
              <CardContent className="p-6">
                <div
                  className={`w-14 h-14 ${item.bg} rounded-2xl mb-4 flex items-center justify-center`}
                >
                  {item.icon}
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ===== 5. Technologies Section ===== */}
      <section className="bg-gray-50 py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <Badge className="mb-3 bg-blue-100 text-blue-700 border-0">
              <Code2 className="w-3.5 h-3.5 mr-1" />
              {tr("about.directions")}
            </Badge>
            <h2 className="text-2xl md:text-4xl font-bold mb-2">
              {tr("about.directionsTitle")}
            </h2>
            <p className="text-muted-foreground text-lg">
              {tr("about.directionsDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Code2 className="w-8 h-8 text-blue-700" />,
                name: "Python",
                color: "from-blue-600 to-blue-800",
                desc: tr("about.dirPython"),
              },
              {
                icon: <Globe className="w-8 h-8 text-violet-600" />,
                name: tr("about.dirWebName"),
                color: "from-violet-600 to-violet-800",
                desc: tr("about.dirWeb"),
              },
              {
                icon: <Gamepad2 className="w-8 h-8 text-red-500" />,
                name: "Roblox",
                color: "from-red-500 to-red-700",
                desc: tr("about.dirRoblox"),
              },
              {
                icon: <Cpu className="w-8 h-8 text-blue-800" />,
                name: "C++ / C#",
                color: "from-blue-800 to-indigo-900",
                desc: tr("about.dirCpp"),
              },
              {
                icon: <BarChart3 className="w-8 h-8 text-orange-600" />,
                name: "Data Science",
                color: "from-orange-500 to-amber-600",
                desc: tr("about.dirDS"),
              },
              {
                icon: <Smartphone className="w-8 h-8 text-green-600" />,
                name: tr("about.dirMobileName"),
                color: "from-green-500 to-emerald-700",
                desc: tr("about.dirMobile"),
              },
            ].map((dir, i) => (
              <Card
                key={i}
                className="border-0 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 overflow-hidden"
              >
                <div
                  className={`bg-gradient-to-r ${dir.color} p-5 flex items-center gap-3`}
                >
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    {dir.icon}
                  </div>
                  <h3 className="text-lg font-bold text-white">{dir.name}</h3>
                </div>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {dir.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 6. Contacts Section ===== */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <div className="text-center mb-10">
          <Badge className="mb-3 bg-green-100 text-green-700 border-0">
            <Phone className="w-3.5 h-3.5 mr-1" />
            {tr("about.contact")}
          </Badge>
          <h2 className="text-2xl md:text-4xl font-bold mb-2">{tr("about.contactTitle")}</h2>
          <p className="text-muted-foreground text-lg">
            {tr("about.contactDesc")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              icon: <Mail className="w-7 h-7 text-blue-700" />,
              bg: "bg-blue-50",
              label: tr("about.contactEmail"),
              value: "maksimqwe42@mail.ru",
              href: "mailto:maksimqwe42@mail.ru",
            },
            {
              icon: <Phone className="w-7 h-7 text-violet-600" />,
              bg: "bg-violet-50",
              label: tr("about.contactPhone"),
              value: "+7 (915) 048-02-49",
              href: "tel:+79150480249",
            },
            {
              icon: <MapPin className="w-7 h-7 text-amber-600" />,
              bg: "bg-amber-50",
              label: tr("about.contactLocation"),
              value: tr("about.locationValue"),
              href: undefined,
            },
          ].map((item, i) => (
            <Card
              key={i}
              className="border-0 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 text-center"
            >
              <CardContent className="p-6">
                <div
                  className={`w-14 h-14 ${item.bg} rounded-2xl mx-auto mb-4 flex items-center justify-center`}
                >
                  {item.icon}
                </div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-1">
                  {item.label}
                </h3>
                {item.href ? (
                  <a
                    href={item.href}
                    className="text-base font-medium text-foreground hover:text-blue-700 transition-colors"
                  >
                    {item.value}
                  </a>
                ) : (
                  <p className="text-base font-medium text-foreground">{item.value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ===== 7. CTA Section ===== */}
      <section className="bg-gradient-to-r from-blue-700 via-violet-700 to-indigo-800 py-16 md:py-20">
        <div className="absolute inset-0 bg-black/5 pointer-events-none" />
        <div className="relative container mx-auto px-4 text-center">
          <Heart className="w-10 h-10 text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
            {tr("about.ctaTitle")}
          </h2>
          <p className="text-blue-100 mb-8 max-w-xl mx-auto text-lg leading-relaxed">
            {tr("about.ctaDesc")}
          </p>
          <Button
            size="lg"
            className="bg-white text-blue-800 hover:bg-blue-50 font-semibold text-lg px-8 py-6"
            onClick={() => navigate("login")}
          >
            {tr("about.startLearning")}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>
    </div>
  );
}
