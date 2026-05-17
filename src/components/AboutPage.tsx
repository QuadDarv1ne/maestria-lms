"use client";

import { useAppStore } from "@/lib/store";
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
  const { navigate } = useAppStore();

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
              Платформа от Maestro7IT
            </Badge>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              О платформе{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-amber-200">
                Maestria
              </span>
            </h1>
            <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed">
              Мы верим, что качественное образование в сфере программирования должно быть доступным
              каждому. Maestria — это место, где знания превращаются в навыки, а навыки — в
              успешную карьеру в IT.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
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
                onClick={() => navigate("login")}
              >
                Начать бесплатно
              </Button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-14 max-w-3xl mx-auto">
            {[
              { icon: <BookOpen className="w-5 h-5" />, value: "12+", label: "Курсов" },
              { icon: <Users className="w-5 h-5" />, value: "12 000+", label: "Студентов" },
              { icon: <Award className="w-5 h-5" />, value: "1 000+", label: "Сертификатов" },
              { icon: <GraduationCap className="w-5 h-5" />, value: "95%", label: "Довольных" },
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
              Наша миссия
            </Badge>
            <h2 className="text-2xl md:text-4xl font-bold mb-2">Наша миссия</h2>
            <p className="text-muted-foreground text-lg">
              Делать качественное IT-образование доступным для каждого
            </p>
          </div>

          <div className="space-y-6 text-base md:text-lg text-muted-foreground leading-relaxed">
            <p>
              Maestria — это не просто образовательная платформа, это целая экосистема, созданная
              компанией <span className="text-blue-700 font-semibold">Maestro7IT</span> с целью
              демократизировать доступ к качественному программированному образованию. Мы убеждены,
              что каждый человек, независимо от возраста, места проживания или финансового
              положения, заслуживает возможности освоить востребованную профессию в сфере
              информационных технологий. Наша платформа объединяет лучшие методики онлайн-обучения с
              индивидуальным подходом к каждому студенту, создавая уникальную среду для развития.
            </p>

            <p>
              В основе Maestria лежит интеграция с образовательным сообществом{" "}
              <span className="text-violet-600 font-semibold">MentorHUB</span>, которое позволяет
              выстроить эффективную систему наставничества и взаимной поддержки между
              преподавателями и студентами. MentorHUB — это пространство, где опытные менторы
              делятся своими знаниями, помогают преодолевать трудности в обучении и направляют
              студентов на пути к профессиональному росту. Благодаря этому формируется живое
              сообщество единомышленников, объединённых общей целью — стать профессионалами в мире
              программирования.
            </p>

            <p>
              Мы тщательно разрабатываем каждый курс, опираясь на реальные потребности рынка труда и
              обратную связь от ведущих IT-компаний. Наша пошаговая система обучения позволяет
              двигаться от простых тем к сложным, закрепляя каждый блок знаний практическими
              заданиями и проектами. Студенты не просто смотрят лекции — они пишут код, решают
              задачи и создают собственные проекты, формируя портфолио, которое поможет им при
              трудоустройстве. Каждый курс завершается сертификацией, подтверждающей полученные
              компетенции.
            </p>

            <p>
              Наша конечная цель — стать мостом между желанием учиться и реальной карьерой в
              IT-индустрии. Мы стремимся к тому, чтобы каждый выпускник Maestria не просто получал
              знания, а обретал уверенность в своих силах и способность решать реальные
              профессиональные задачи. Мы постоянно совершенствуем платформу, добавляем новые
              направления обучения и расширяем команду преподавателей, чтобы оставаться на
              передовом рубеже образовательных технологий.
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
              Руководство
            </Badge>
            <h2 className="text-2xl md:text-4xl font-bold mb-2">Руководитель</h2>
            <p className="text-muted-foreground">
              Человек, стоящий за созданием платформы
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
                      Дуплей Максим Игоревич
                    </h3>
                  </div>
                  <p className="text-blue-200 text-sm mb-3">
                    Основатель и руководитель Maestro7IT
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
                    Дуплей Максим Игоревич — основатель и идейный вдохновитель компании Maestro7IT,
                    под эгидой которой была создана образовательная платформа Maestria. Обладая
                    глубоким пониманием как технической, так и образовательной сферы, Максим
                    Игоревич поставил перед собой амбициозную задачу — создать платформу, которая
                    станет новым стандартом качества в онлайн-образовании по программированию.
                  </p>
                  <p>
                    Именно его видение легло в основу уникальной методологии обучения Maestria,
                    сочетающей интерактивные уроки, систему наставничества через MentorHUB и
                    практико-ориентированный подход. Максим лично курирует разработку образовательных
                    программ и отбор преподавателей, обеспечивая соответствие каждого курса высоким
                    стандартам платформы.
                  </p>
                  <p>
                    Под руководством Максима Игоревича Maestro7IT выросла из небольшого
                    образовательного проекта в полноценную экосистему, объединяющую тысячи студентов
                    и десятки опытных преподавателей. Его кредо — образование должно быть не только
                    качественным, но и по-настоящему доступным, и этот принцип воплощается в каждом
                    аспекте работы платформы Maestria.
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
            Преимущества
          </Badge>
          <h2 className="text-2xl md:text-4xl font-bold mb-2">
            Почему выбирают Maestria
          </h2>
          <p className="text-muted-foreground text-lg">
            Шесть причин доверить нам своё образование
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: <Zap className="w-7 h-7 text-blue-700" />,
              bg: "bg-blue-50",
              title: "Интерактивное обучение",
              desc: "Наши курсы — это не скучные видеолекции, а полноценный интерактивный опыт. Вы пишете код прямо в браузере, мгновенно видите результат своих действий и получаете автоматическую обратную связь от системы. Такой подход позволяет быстрее усваивать материал и превращает обучение в увлекательный процесс, похожий на игру.",
            },
            {
              icon: <BookOpen className="w-7 h-7 text-violet-600" />,
              bg: "bg-violet-50",
              title: "Пошаговая система",
              desc: "Каждый курс разбит на логические шаги и модули, выстроенные по принципу от простого к сложному. Вы всегда знаете, на каком этапе находитесь, что уже пройдено и что ждёт впереди. Пошаговая структура позволяет эффективно планировать время обучения и не чувствовать себя перегруженным объёмом информации.",
            },
            {
              icon: <Users className="w-7 h-7 text-amber-600" />,
              bg: "bg-amber-50",
              title: "Опытные преподаватели",
              desc: "Все наши преподаватели — практикующие специалисты с многолетним опытом работы в ведущих IT-компаниях. Они не только обладают глубокими знаниями предмета, но и умеют доступно объяснять сложные концепции. Благодаря сообществу MentorHUB каждый студент получает персональное наставничество и поддержку.",
            },
            {
              icon: <Award className="w-7 h-7 text-orange-600" />,
              bg: "bg-orange-50",
              title: "Сертификаты",
              desc: "По завершении каждого курса вы получаете именной сертификат, подтверждающий освоенные компетенции и навыки. Наши сертификаты признаются партнёрскими компаниями и могут стать весомым дополнением к вашему резюме при трудоустройстве. Сертификат навсегда остаётся в вашем цифровом портфолио на платформе.",
            },
            {
              icon: <Smartphone className="w-7 h-7 text-blue-700" />,
              bg: "bg-blue-50",
              title: "Оплата через СБП",
              desc: "Мы принимаем оплату через Систему быстрых платежей (СБП), что гарантирует моментальное зачисление средств и отсутствие комиссий. Это самый удобный и безопасный способ оплаты курсов на территории Российской Федерации. Также доступны и другие способы оплаты для вашего комфорта.",
            },
            {
              icon: <Clock className="w-7 h-7 text-violet-600" />,
              bg: "bg-violet-50",
              title: "Доступность 24/7",
              desc: "Платформа работает круглосуточно и без выходных. Учитесь в любое удобное время, из любой точки мира — нужен только интернет. Все материалы курсов доступны сразу после оплаты, и вы можете возвращаться к ним неограниченное количество раз. Ваш прогресс сохраняется автоматически на любом устройстве.",
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
              Направления
            </Badge>
            <h2 className="text-2xl md:text-4xl font-bold mb-2">
              Направления обучения
            </h2>
            <p className="text-muted-foreground text-lg">
              Выберите направление, которое откроет двери в мир IT
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Code2 className="w-8 h-8 text-blue-700" />,
                name: "Python",
                color: "from-blue-600 to-blue-800",
                desc: "Python — один из самых востребованных языков программирования в мире. На наших курсах вы освоите синтаксис Python, научитесь работать с библиотеками, создавать скрипты автоматизации и строить серверные приложения. Python идеально подходит как для первого языка, так и для углублённого изучения специализированных областей, включая веб-разработку и автоматизацию.",
              },
              {
                icon: <Globe className="w-8 h-8 text-violet-600" />,
                name: "Веб-разработка",
                color: "from-violet-600 to-violet-800",
                desc: "Научитесь создавать современные веб-приложения с нуля. Наши курсы охватывают HTML, CSS, JavaScript, а также популярные фреймворки и библиотеки. Вы освоите адаптивную вёрстку, интерактивные интерфейсы, работу с серверными API и развертывание проектов. Веб-разработка — это фундамент цифровой экономики и одна из самых востребованных профессий.",
              },
              {
                icon: <Gamepad2 className="w-8 h-8 text-red-500" />,
                name: "Roblox",
                color: "from-red-500 to-red-700",
                desc: "Создавайте собственные игры в Roblox Studio! Это направление идеально подходит для юных разработчиков и тех, кто хочет погрузиться в геймдев. Вы научитесь программировать на Lua, создавать 3D-миры, настраивать игровую механику и публиковать свои проекты. Roblox — отличная стартовая площадка для будущих разработчиков игр.",
              },
              {
                icon: <Cpu className="w-8 h-8 text-blue-800" />,
                name: "C++ / C#",
                color: "from-blue-800 to-indigo-900",
                desc: "Мощные языки системного программирования, открывающие путь к разработке высокопроизводительных приложений, игровых движков и программного обеспечения. Наши курсы по C++ и C# дают глубокое понимание принципов работы памяти, объектно-ориентированного программирования и алгоритмов, необходимых для серьёзной технической карьеры.",
              },
              {
                icon: <BarChart3 className="w-8 h-8 text-orange-600" />,
                name: "Data Science",
                color: "from-orange-500 to-amber-600",
                desc: "Data Science — одно из самых быстрорастущих направлений в IT. Научитесь анализировать данные, строить предиктивные модели и визуализировать результаты с помощью Python, Pandas, NumPy и библиотек машинного обучения. Наши курсы дают практические навыки работы с реальными наборами данных и подготовки отчётов, востребованных в бизнесе.",
              },
              {
                icon: <Smartphone className="w-8 h-8 text-green-600" />,
                name: "Мобильная разработка",
                color: "from-green-500 to-emerald-700",
                desc: "Мобильные приложения окружают нас повсюду, и спрос на мобильных разработчиков продолжает расти. Научитесь создавать приложения для iOS и Android, используя современные фреймворки и инструменты. Вы освоите проектирование интерфейсов, работу с API, хранение данных и публикацию приложений в магазинах App Store и Google Play.",
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
            Контакты
          </Badge>
          <h2 className="text-2xl md:text-4xl font-bold mb-2">Связаться с нами</h2>
          <p className="text-muted-foreground text-lg">
            Мы всегда рады ответить на ваши вопросы
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              icon: <Mail className="w-7 h-7 text-blue-700" />,
              bg: "bg-blue-50",
              label: "Электронная почта",
              value: "maksimqwe42@mail.ru",
              href: "mailto:maksimqwe42@mail.ru",
            },
            {
              icon: <Phone className="w-7 h-7 text-violet-600" />,
              bg: "bg-violet-50",
              label: "Телефон",
              value: "+7 (915) 048-02-49",
              href: "tel:+79150480249",
            },
            {
              icon: <MapPin className="w-7 h-7 text-amber-600" />,
              bg: "bg-amber-50",
              label: "Местоположение",
              value: "Москва, Россия",
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
            Начните обучение прямо сейчас
          </h2>
          <p className="text-blue-100 mb-8 max-w-xl mx-auto text-lg leading-relaxed">
            Присоединяйтесь к тысячам студентов, которые уже меняют свою жизнь с помощью Maestria.
            Регистрация бесплатна — начните свой путь в мир программирования уже сегодня.
          </p>
          <Button
            size="lg"
            className="bg-white text-blue-800 hover:bg-blue-50 font-semibold text-lg px-8 py-6"
            onClick={() => navigate("login")}
          >
            Зарегистрироваться бесплатно
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>
    </div>
  );
}
