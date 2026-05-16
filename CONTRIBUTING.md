# Руководство для участников Maestria

Спасибо за интерес к проекту Maestria! Этот документ описывает процесс внесения вклада в развитие платформы.

---

## 🤝 Как внести вклад

### Сообщения об ошибках

1. Проверьте, не был ли этот баг уже зарегистрирован в Issues
2. Создайте новый Issue с подробным описанием:
   - Шаги для воспроизведения
   - Ожидаемое поведение
   - Фактическое поведение
   - Скриншоты (если применимо)
   - Окружение (браузер, ОС, устройство)

### Предложения по улучшению

1. Создайте Issue с тегом `enhancement`
2. Опишите проблему, которую решает предложение
3. Предложите решение и альтернативы
4. Укажите приоритет и обоснование

---

## 🛠 Разработка

### Настройка окружения

```bash
# Форкните репозиторий
git clone https://github.com/YOUR_USERNAME/Maestria.git
cd Maestria

# Установите зависимости
npm install

# Создайте ветку для вашей фичи
git checkout -b feature/your-feature-name

# Запустите dev-сервер
npm run dev
```

### Стандарты кода

- **TypeScript**: Строгая типизация, `noImplicitAny`
- **Компоненты React**: Функциональные компоненты с хуками
- **Стилизация**: Tailwind CSS 4, oklch-цвета, CSS-переменные
- **i18n**: Все пользовательские строки — через `t(key, locale)`
- **Состояние**: Zustand store для глобального состояния
- **API**: Next.js API Routes с валидацией Zod

### Структура компонентов

```tsx
"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  const { locale } = useAppStore();
  const [state, setState] = useState(false);

  return (
    <div className="p-4 bg-card text-card-foreground rounded-xl">
      <h2 className="text-lg font-bold">{title}</h2>
    </div>
  );
}
```

### Правила коммитов

Используем [Conventional Commits](https://www.conventionalcommits.org/ru/):

```
feat: добавлена страница сертификатов
fix: исправлена ошибка фильтрации курсов
docs: обновлена документация API
style: форматирование кода
refactor: рефакторинг компонента Header
i18n: добавлены ключи для zh локали
```

### Pull Request

1. Убедитесь, что код компилируется без ошибок (`npm run build`)
2. Добавьте i18n ключи для всех 3 языков (ru/en/zh)
3. Проверьте работу в 3 темах (light/dark/amber)
4. Проверьте мобильную адаптивность
5. Создайте PR с описанием изменений

---

## 🎨 Дизайн-система

### Цвета

Используйте CSS-переменные из `globals.css`:

```css
var(--primary)        /* Основной цвет */
var(--background)     /* Фон */
var(--foreground)     /* Текст */
var(--card)           /* Карточка фон */
var(--muted)          /* Приглушённый фон */
var(--muted-foreground) /* Приглушённый текст */
var(--destructive)    /* Ошибка/удаление */
```

### Компоненты

Используйте shadcn/ui из `src/components/ui/`:
- `Button` — кнопки (варианты: default, outline, ghost, destructive)
- `Card` — карточки (CardHeader, CardTitle, CardContent)
- `Badge` — бейджи и метки
- `Table` — таблицы данных
- `Dialog` — модальные окна
- `Select` — выпадающие списки
- `Input` — поля ввода
- `Progress` — прогресс-бары
- И другие (40+ компонентов)

---

## 📝 Правовые требования

Поскольку платформа работает в юрисдикции Российской Федерации:

- Все пользовательские данные должны храниться на серверах в РФ
- Требуется согласие на обработку персональных данных (152-ФЗ)
- Пользовательский контент публикуется под CC BY-SA 4.0
- Необходимо соблюдать требования Роскомнадзора

---

## 📞 Связь

- **Email**: maksimqwe42@mail.ru
- **GitHub**: Maestro7IT/Maestria
- **VK**: сообщество Maestro7IT

---

Спасибо за ваш вклад в развитие Maestria! 🎓
