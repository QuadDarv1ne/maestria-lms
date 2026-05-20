"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * CustomCursor — красивый кастомный курсор для всего сайта Maestria.
 *
 * Особенности:
 * - Маленькая точка следует за мышью мгновенно
 * - Большой круг следует с плавной анимацией (lerp)
 * - При наведении на карточки/кнопки круг расширяется
 * - При клике эффект сжатия
 * - Только на десктопе (pointer: fine)
 * - НЕ скрывает системный курсор
 * - Поддержка тёмной/янтарной тем через CSS-переменные
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const outlineRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: -100, y: -100 });
  const posRef = useRef({ x: -100, y: -100 });
  const isHoveringCard = useRef(false);
  const isHoveringButton = useRef(false);
  const isPressed = useRef(false);
  const animateRef = useRef<(() => void) | null>(null);

  const animate = useCallback(() => {
    const lerp = isHoveringCard.current ? 0.18 : isHoveringButton.current ? 0.15 : 0.12;
    posRef.current.x += (mouseRef.current.x - posRef.current.x) * lerp;
    posRef.current.y += (mouseRef.current.y - posRef.current.y) * lerp;

    const outline = outlineRef.current;
    if (outline) {
      outline.style.left = `${posRef.current.x}px`;
      outline.style.top = `${posRef.current.y}px`;

      // Динамические стили в зависимости от состояния
      if (isPressed.current) {
        outline.style.width = "22px";
        outline.style.height = "22px";
        outline.style.borderColor = "var(--cursor-press, rgba(41, 98, 255, 0.8))";
        outline.style.background = "var(--cursor-press-bg, rgba(41, 98, 255, 0.08))";
      } else if (isHoveringCard.current) {
        outline.style.width = "52px";
        outline.style.height = "52px";
        outline.style.borderColor = "var(--cursor-hover, rgba(41, 98, 255, 0.6))";
        outline.style.background = "var(--cursor-hover-bg, rgba(41, 98, 255, 0.04))";
      } else if (isHoveringButton.current) {
        outline.style.width = "40px";
        outline.style.height = "40px";
        outline.style.borderColor = "var(--cursor-hover, rgba(124, 58, 237, 0.5))";
        outline.style.background = "var(--cursor-hover-bg, rgba(124, 58, 237, 0.05))";
      } else {
        outline.style.width = "32px";
        outline.style.height = "32px";
        outline.style.borderColor = "var(--cursor-outline, rgba(41, 98, 255, 0.4))";
        outline.style.background = "transparent";
      }
    }

    rafRef.current = requestAnimationFrame(() => {
      animateRef.current?.();
    });
  }, []);

  // Store the animate function in a ref so it can be called recursively
  useEffect(() => {
    animateRef.current = animate;
  }, [animate]);

  useEffect(() => {
    // Проверяем тип указателя — только десктоп
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (!isFinePointer) return;

    const dot = dotRef.current;
    const outline = outlineRef.current;
    if (!dot || !outline) return;

    // Показываем элементы
    dot.style.display = "block";
    outline.style.display = "block";

    // Движение мыши
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
    };

    // Нажатие/отпускание
    const handleMouseDown = () => {
      isPressed.current = true;
      dot.style.transform = "translate(-50%, -50%) scale(0.6)";
    };

    const handleMouseUp = () => {
      isPressed.current = false;
      dot.style.transform = "translate(-50%, -50%) scale(1)";
    };

    // Определяем интерактивные элементы
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Кнопки, ссылки, input, select, интерактивные элементы
      const isButton = target.closest(
        'button, a, [role="button"], input, select, textarea, [data-cursor="pointer"]'
      );
      // Карточки и крупные интерактивные блоки
      const isCard = target.closest(
        '[data-cursor="card"], .cursor-pointer, [class*="hover:shadow"], [class*="hover:-translate"]'
      );

      if (isCard) {
        isHoveringCard.current = true;
        isHoveringButton.current = false;
      } else if (isButton) {
        isHoveringButton.current = true;
        isHoveringCard.current = false;
      } else {
        isHoveringCard.current = false;
        isHoveringButton.current = false;
      }
    };

    const handleMouseLeave = () => {
      isHoveringCard.current = false;
      isHoveringButton.current = false;
    };

    // Слушатели
    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mouseover", handleMouseOver, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);

    // Запуск анимации
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

  return (
    <>
      {/* Маленькая точка — следует мгновенно */}
      <div
        ref={dotRef}
        className="cursor-dot"
        aria-hidden="true"
      />
      {/* Большой круг — следует с анимацией */}
      <div
        ref={outlineRef}
        className="cursor-outline"
        aria-hidden="true"
      />
    </>
  );
}
