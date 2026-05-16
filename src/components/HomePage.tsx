"use client";

import React, { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  Users,
  BookOpen,
  Award,
  Star,
  Clock,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { CoursePromoCarousel } from "@/components/CoursePromoCarousel";
import { AnimatedCounter } from "@/components/AnimatedCounter";

interface CourseCard {
  id: string;
  title: string;
  slug: string;
  shortDesc: string | null;
  image: string | null;
  price: number;
  oldPrice: number | null;
  level: string;
  duration: string | null;
  isFeatured: boolean;
  rating: number;
  studentCount: number;
  totalLessons: number;
  totalDuration: number;
  teacher: { id: string; name: string | null; image: string | null };
  category: { id: string; name: string; slug: string; icon: string | null; color: string | null };
}

export function HomePage() {
  const { navigate } = useAppStore();
  const [featuredCourses, setFeaturedCourses] = useState<CourseCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const courseRes = await fetch("/api/courses?limit=6");
        if (courseRes.ok) {
          const data = await courseRes.json();
          setFeaturedCourses(data.courses || []);
        }
      } catch (e) {
        console.error("Ошибка загрузки данных:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const levelLabels: Record<string, string> = {
    beginner: "Начинающий",
    intermediate: "Средний",
    advanced: "Продвинутый",
  };

  const levelColors: Record<string, string> = {
    beginner: "bg-blue-100 text-blue-700",
    intermediate: "bg-amber-100 text-amber-700",
    advanced: "bg-red-100 text-red-700",
  };

  const defaultCategories = [
    { id: "1", name: "Программирование на Python", slug: "python", icon: "🐍", color: "#3776AB", description: "Курсы по Python" },
    { id: "2", name: "Веб-разработка", slug: "web-development", icon: "🌐", color: "#F7DF1E", description: "HTML, CSS, JS" },
    { id: "3", name: "Создание игр в Roblox", slug: "roblox", icon: "🎮", color: "#E2231A", description: "Roblox Studio" },
    { id: "4", name: "C++/C#", slug: "cpp-csharp", icon: "⚡", color: "#00599C", description: "Системное программирование" },
    { id: "5", name: "Data Science", slug: "data-science", icon: "📊", color: "#FF6F00", description: "Анализ данных" },
    { id: "6", name: "Мобильная разработка", slug: "mobile-development", icon: "📱", color: "#3DDC84", description: "iOS и Android" },
  ];

  return (
    <div>
      {/* Герой-секция */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-800 via-violet-700 to-indigo-900">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl">
            <Badge className="mb-4 bg-white/20 text-white border-0 hover:bg-white/30">
              🎓 Обучающая платформа нового поколения
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
              Научись программировать
              <br />
              <span className="text-blue-200">с нуля до профи</span>
            </h1>
            <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-2xl">
              Интерактивные курсы по программированию, веб-разработке, созданию игр и Data
              Science. Учитесь в своём темпе с лучшими преподавателями.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                className="bg-white text-blue-800 hover:bg-blue-50 font-semibold"
                onClick={() => navigate("catalog")}
              >
                Смотреть курсы
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white bg-blue-600 hover:bg-blue-700 hover:border-blue-600"
                onClick={() => (window.location.hash = "login")}
              >
                Начать бесплатно
              </Button>
            </div>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[
              { icon: <BookOpen className="w-5 h-5" />, value: 34, suffix: "+", label: "Курсов", decimals: 0 },
              { icon: <Users className="w-5 h-5" />, value: 12000, suffix: "+", label: "Студентов", decimals: 0 },
              { icon: <Award className="w-5 h-5" />, value: 1000, suffix: "+", label: "Сертификатов", decimals: 0 },
              { icon: <Star className="w-5 h-5" />, value: 4.8, suffix: "", label: "Средняя оценка", decimals: 1 },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-white"
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
                <p className="text-sm text-blue-200">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Категории */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">
            Направления обучения
          </h2>
          <p className="text-muted-foreground">
            Выберите направление, которое вам интересно
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {defaultCategories.map((cat) => (
            <Card
              key={cat.id}
              className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 border-0 shadow-sm"
              onClick={() => {
                navigate("catalog");
                useAppStore.setState({
                  courseFilters: { category: cat.slug, search: "", level: "", sortBy: "popular" as const, freeOnly: false },
                });
              }}
            >
              <CardContent className="p-4 text-center">
                <div
                  className="w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center text-2xl"
                  style={{ backgroundColor: cat.color + "20" }}
                >
                  {cat.icon}
                </div>
                <h3 className="font-semibold text-sm leading-tight">
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

      {/* Промо-карусель курсов */}
      <CoursePromoCarousel />

      {/* Популярные курсы */}
      <section className="bg-gray-50 py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">
                Популярные курсы
              </h2>
              <p className="text-muted-foreground mt-1">
                Лучшие курсы по оценкам студентов
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("catalog")}
              className="hidden sm:flex"
            >
              Все курсы
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="border-0 shadow-sm">
                  <CardContent className="p-0">
                    <div className="h-40 bg-gray-200 animate-pulse rounded-t-lg" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-gray-200 animate-pulse rounded" />
                      <div className="h-3 bg-gray-200 animate-pulse rounded w-2/3" />
                      <div className="h-3 bg-gray-200 animate-pulse rounded w-1/2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredCourses.map((course) => (
                <Card
                  key={course.id}
                  className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 border-0 shadow-sm overflow-hidden"
                  onClick={() => navigate(`course/${course.id}`)}
                >
                  <CardContent className="p-0">
                    {/* Обложка курса */}
                    <div className="relative h-40 bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                      {course.category?.icon && (
                        <span className="text-5xl opacity-50">
                          {course.category.icon}
                        </span>
                      )}
                      {course.price === 0 && (
                        <Badge className="absolute top-3 left-3 bg-green-500 text-white border-0">
                          Бесплатно
                        </Badge>
                      )}
                      {course.isFeatured && course.price > 0 && (
                        <Badge className="absolute top-3 left-3 bg-amber-500 text-white border-0">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Хит
                        </Badge>
                      )}
                      <Badge
                        className={`absolute top-3 right-3 ${levelColors[course.level] || "bg-gray-100 text-gray-700"}`}
                      >
                        {levelLabels[course.level] || course.level}
                      </Badge>
                    </div>

                    <div className="p-4">
                      {/* Категория */}
                      <p className="text-xs text-violet-600 font-medium mb-1">
                        {course.category?.name}
                      </p>

                      {/* Название */}
                      <h3 className="font-semibold text-sm leading-tight mb-2 line-clamp-2">
                        {course.title}
                      </h3>

                      {/* Преподаватель */}
                      <p className="text-xs text-muted-foreground mb-3">
                        {course.teacher?.name}
                      </p>

                      {/* Мета-информация */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {course.totalDuration} мин
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {course.totalLessons} уроков
                        </span>
                      </div>

                      {/* Рейтинг и студенты */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-semibold">
                            {course.rating}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({course.studentCount})
                          </span>
                        </div>
                        <div>
                          {course.price === 0 ? (
                            <span className="text-sm font-semibold text-green-600">
                              Бесплатно
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              {course.oldPrice && (
                                <span className="text-xs text-muted-foreground line-through">
                                  {course.oldPrice.toLocaleString("ru-RU")} ₽
                                </span>
                              )}
                              <span className="text-sm font-bold text-foreground">
                                {course.price.toLocaleString("ru-RU")} ₽
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="text-center mt-8 sm:hidden">
            <Button variant="outline" onClick={() => navigate("catalog")}>
              Все курсы
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Преимущества */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">
            Почему Maestria?
          </h2>
          <p className="text-muted-foreground">
            Мы создаём лучший опыт онлайн-обучения
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <GraduationCap className="w-8 h-8 text-amber-600" />,
              title: "Практический подход",
              desc: "Каждый курс содержит практические задания, проекты и задачи для закрепления материала",
            },
            {
              icon: <Users className="w-8 h-8 text-violet-600" />,
              title: "Опытные преподаватели",
              desc: "Наши преподаватели — практикующие разработчики с многолетним опытом работы",
            },
            {
              icon: <Award className="w-8 h-8 text-blue-700" />,
              title: "Сертификаты",
              desc: "Получите сертификат по окончании курса для подтверждения ваших навыков",
            },
          ].map((item, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                  {item.icon}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-700 to-violet-700 py-12 md:py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Начните обучаться прямо сейчас!
          </h2>
          <p className="text-blue-100 mb-6 max-w-lg mx-auto">
            Зарегистрируйтесь бесплатно и получите доступ к бесплатным курсам по
            программированию
          </p>
          <Button
            size="lg"
            className="bg-white text-blue-800 hover:bg-blue-50 font-semibold"
            onClick={() => (window.location.hash = "login")}
          >
            Зарегистрироваться бесплатно
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>
    </div>
  );
}
