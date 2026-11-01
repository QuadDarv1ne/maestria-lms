import { describe, expect, it } from "vitest";
import { isIpAllowed } from "./ip-whitelist";

describe("isIpAllowed — провайдеры без whitelist", () => {
  it("SBER (пустой whitelist) → всегда true", () => {
    expect(isIpAllowed("SBER", "1.2.3.4")).toBe(true);
  });

  it("SBER без IP → true (полагаемся на подпись)", () => {
    expect(isIpAllowed("SBER", undefined)).toBe(true);
  });

  it("неизвестный провайдер → true (нет ограничений)", () => {
    expect(isIpAllowed("STRIPE", "1.2.3.4")).toBe(true);
  });
});

describe("isIpAllowed — валидация входа", () => {
  it("отсутствие IP для провайдера с whitelist → false", () => {
    expect(isIpAllowed("YOOKASSA", undefined)).toBe(false);
  });

  it("пустая строка → false", () => {
    expect(isIpAllowed("YOOKASSA", "")).toBe(false);
    expect(isIpAllowed("YOOKASSA", "   ")).toBe(false);
  });

  it("некорректный IPv4 → false", () => {
    expect(isIpAllowed("YOOKASSA", "999.1.1.1")).toBe(false);
    expect(isIpAllowed("YOOKASSA", "185.71.76")).toBe(false);
    expect(isIpAllowed("YOOKASSA", "not.an.ip")).toBe(false);
  });
});

describe("isIpAllowed — CIDR-диапазоны YooKassa", () => {
  it("IP внутри /27 → true", () => {
    expect(isIpAllowed("YOOKASSA", "185.71.76.15")).toBe(true);
  });

  it("граница диапазона: последний хост /27 → true", () => {
    expect(isIpAllowed("YOOKASSA", "185.71.76.31")).toBe(true);
  });

  it("сразу за границей /27 → false", () => {
    expect(isIpAllowed("YOOKASSA", "185.71.76.32")).toBe(false);
  });

  it("точечный IP (неявный /32) → совпадение только с самим собой", () => {
    expect(isIpAllowed("YOOKASSA", "77.75.156.11")).toBe(true);
    expect(isIpAllowed("YOOKASSA", "77.75.156.12")).toBe(false);
  });

  it("другой диапазон YooKassa: 77.75.153.0/25", () => {
    expect(isIpAllowed("YOOKASSA", "77.75.153.100")).toBe(true);
    expect(isIpAllowed("YOOKASSA", "77.75.153.200")).toBe(false);
  });

  it("IP из чужого диапазона → false", () => {
    expect(isIpAllowed("YOOKASSA", "8.8.8.8")).toBe(false);
  });

  it("пробелы вокруг IP обрезаются", () => {
    expect(isIpAllowed("YOOKASSA", " 185.71.76.15 ")).toBe(true);
  });
});

describe("isIpAllowed — IPv6", () => {
  it("точное совпадение строки диапазона → true", () => {
    expect(isIpAllowed("YOOKASSA", "2a02:5180::/32")).toBe(true);
  });

  it("обычный IPv6 из диапазона → false (сравнение только полной строкой)", () => {
    expect(isIpAllowed("YOOKASSA", "2a02:5180::1")).toBe(false);
  });

  it("IPv6 для CloudPayments (нет IPv6-диапазонов) → false", () => {
    expect(isIpAllowed("CLOUDPAYMENTS", "2a02:5180::/32")).toBe(false);
  });
});

describe("isIpAllowed — прочие провайдеры", () => {
  it("Tinkoff 178.248.232.0/21 покрывает 178.248.232.0–239.255", () => {
    expect(isIpAllowed("TINKOFF", "178.248.235.77")).toBe(true);
    expect(isIpAllowed("TINKOFF", "178.248.240.1")).toBe(false);
  });

  it("CloudPayments 130.193.38.0/24", () => {
    expect(isIpAllowed("CLOUDPAYMENTS", "130.193.38.220")).toBe(true);
    expect(isIpAllowed("CLOUDPAYMENTS", "130.193.39.1")).toBe(false);
  });

  it("нижняя граница диапазона (сетевой адрес) входит", () => {
    expect(isIpAllowed("CLOUDPAYMENTS", "185.98.85.0")).toBe(true);
  });
});
