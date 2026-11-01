import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectProviderFromWebhook,
  getAvailablePaymentOptions,
  getConfiguredProviders,
  getProvider,
  methodLabel,
  parseProviderName,
  pickProviderForMethod,
} from "./registry";

/**
 * Провайдеры замоканы целиком: регистру важно только `isConfigured()` и
 * `supportedMethods`. Конфигурация переключается в каждом тесте через
 * общий `state.configured` — инстансы кэшируются как singleton, поэтому
 * их isConfigured читает состояние на момент вызова.
 */
const state = vi.hoisted(() => {
  const configured = new Set<string>();
  const makeProviderClass = (name: string, supportedMethods: string[]) =>
    class MockProvider {
      supportedMethods = supportedMethods;
      isConfigured = vi.fn(() => configured.has(name));
    };
  return { configured, makeProviderClass };
});

vi.mock("./providers/yookassa", () => ({
  YooKassaProvider: state.makeProviderClass("YOOKASSA", [
    "CARD", "SBP", "YOOMONEY", "SBERPAY", "TPAY", "YANDEX_PAY",
  ]),
}));
vi.mock("./providers/tinkoff", () => ({
  TinkoffProvider: state.makeProviderClass("TINKOFF", ["CARD", "SBP", "TPAY", "SBERPAY"]),
}));
vi.mock("./providers/cloudpayments", () => ({
  CloudPaymentsProvider: state.makeProviderClass("CLOUDPAYMENTS", ["CARD"]),
}));
vi.mock("./providers/sberbank", () => ({
  SberbankProvider: state.makeProviderClass("SBER", ["CARD", "SBERPAY"]),
}));
vi.mock("./providers/ozon", () => ({
  OzonProvider: state.makeProviderClass("OZON", ["CARD", "OZON_CARD"]),
}));
vi.mock("./providers/vtb", () => ({
  VtbProvider: state.makeProviderClass("VTB", ["CARD"]),
}));
vi.mock("./providers/mkb", () => ({
  MkbProvider: state.makeProviderClass("MKB", ["CARD"]),
}));

beforeEach(() => {
  state.configured.clear();
});

describe("parseProviderName", () => {
  it("валиное имя регистронезависимо", () => {
    expect(parseProviderName("yookassa")).toBe("YOOKASSA");
    expect(parseProviderName("Tinkoff")).toBe("TINKOFF");
    expect(parseProviderName("SBER")).toBe("SBER");
  });

  it("неизвестное имя → null", () => {
    expect(parseProviderName("STRIPE")).toBeNull();
  });

  it("пустые значения → null", () => {
    expect(parseProviderName("")).toBeNull();
    expect(parseProviderName(null)).toBeNull();
    expect(parseProviderName(undefined)).toBeNull();
  });
});

describe("getProvider", () => {
  it("возвращает инстанс провайдера", () => {
    const provider = getProvider("YOOKASSA");
    expect(provider.isConfigured()).toBe(false);
  });

  it("кэширует инстанс (singleton)", () => {
    expect(getProvider("TINKOFF")).toBe(getProvider("TINKOFF"));
  });

  it("неизвестный провайдер бросает ошибку", () => {
    expect(() => getProvider("UNKNOWN" as never)).toThrow("Unknown payment provider");
  });
});

describe("getConfiguredProviders", () => {
  it("возвращает только настроенных провайдеров", () => {
    state.configured.add("YOOKASSA");
    state.configured.add("OZON");
    expect(getConfiguredProviders()).toEqual(["YOOKASSA", "OZON"]);
  });

  it("ничего не настроено → пустой список", () => {
    expect(getConfiguredProviders()).toEqual([]);
  });
});

describe("pickProviderForMethod", () => {
  it("bindings без проверки конфигурации", () => {
    expect(pickProviderForMethod("YOOMONEY", false)).toBe("YOOKASSA");
    expect(pickProviderForMethod("YANDEX_PAY", false)).toBe("YOOKASSA");
    expect(pickProviderForMethod("SBERPAY", false)).toBe("SBER");
    expect(pickProviderForMethod("TPAY", false)).toBe("TINKOFF");
    expect(pickProviderForMethod("OZON_CARD", false)).toBe("OZON");
  });

  it("метод без привязки → YOOKASSA по умолчанию", () => {
    expect(pickProviderForMethod("CARD", false)).toBe("YOOKASSA");
    expect(pickProviderForMethod("SBP", false)).toBe("YOOKASSA");
  });

  it("предпочтительный провайдер настроен → он и возвращается", () => {
    state.configured.add("YOOKASSA");
    expect(pickProviderForMethod("CARD")).toBe("YOOKASSA");
  });

  it("предпочтительный не настроен → фолбэк на любого настроенного", () => {
    state.configured.add("TINKOFF");
    expect(pickProviderForMethod("CARD")).toBe("TINKOFF");
  });

  it("фолбэк идёт по списку приоритетов (SBER после OZON)", () => {
    state.configured.add("SBER");
    expect(pickProviderForMethod("CARD")).toBe("SBER");
  });

  it("ничего не настроено → preferred (осмысленная ошибка у вызывающего)", () => {
    expect(pickProviderForMethod("CARD")).toBe("YOOKASSA");
  });

  it("YOOMONEY при настроенном TINKOFF уходит в фолбэк TINKOFF", () => {
    state.configured.add("TINKOFF");
    expect(pickProviderForMethod("YOOMONEY")).toBe("TINKOFF");
  });
});

describe("getAvailablePaymentOptions", () => {
  it("ничего не настроено → один тестовый вариант CARD", () => {
    const options = getAvailablePaymentOptions();
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      provider: "YOOKASSA",
      method: "CARD",
      testMode: true,
    });
    expect(options[0].label).toContain("тестовый режим");
  });

  it("настроенный провайдер отдаёт все свои методы", () => {
    state.configured.add("YOOKASSA");
    const options = getAvailablePaymentOptions();
    expect(options.map((o) => o.method)).toEqual([
      "CARD", "SBP", "YOOMONEY", "SBERPAY", "TPAY", "YANDEX_PAY",
    ]);
    expect(options.every((o) => o.provider === "YOOKASSA")).toBe(true);
    expect(options.every((o) => !o.testMode)).toBe(true);
  });

  it("дедупликация: метод берётся от первого настроенного провайдера", () => {
    state.configured.add("YOOKASSA");
    state.configured.add("TINKOFF");
    const options = getAvailablePaymentOptions();
    // CARD/SBP/TPAY/SBERPAY уже от YOOKASSA — от TINKOFF ничего не добавляется
    expect(options.filter((o) => o.provider === "TINKOFF")).toHaveLength(0);
  });

  it("OZON добавляет OZON_CARD к общим методам", () => {
    state.configured.add("TINKOFF");
    state.configured.add("OZON");
    const options = getAvailablePaymentOptions();
    expect(options.map((o) => `${o.provider}:${o.method}`)).toEqual([
      "TINKOFF:CARD",
      "TINKOFF:SBP",
      "TINKOFF:TPAY",
      "TINKOFF:SBERPAY",
      "OZON:OZON_CARD",
    ]);
  });
});

describe("methodLabel", () => {
  it("человеческие русские названия", () => {
    expect(methodLabel("CARD")).toBe("Банковская карта");
    expect(methodLabel("SBP")).toContain("СБП");
    expect(methodLabel("YOOMONEY")).toBe("ЮMoney");
    expect(methodLabel("OZON_CARD")).toBe("Ozon Card");
  });
});

describe("detectProviderFromWebhook", () => {
  const detect = (body: unknown, headers: Record<string, string> = {}) =>
    detectProviderFromWebhook(headers, body);

  it("заголовок x-content-hmac → CLOUDPAYMENTS", () => {
    expect(detect({}, { "x-content-hmac": "abc" })).toBe("CLOUDPAYMENTS");
  });

  it("заголовок x-ozon-signature → OZON", () => {
    expect(detect({}, { "x-ozon-signature": "sig" })).toBe("OZON");
  });

  it("T-Bank: TerminalKey + Token", () => {
    expect(detect({ TerminalKey: "t1", Token: "tok", Amount: 100 })).toBe("TINKOFF");
  });

  it("CloudPayments: InvoiceId + Status", () => {
    expect(detect({ InvoiceId: "pay_1", Status: "Completed" })).toBe("CLOUDPAYMENTS");
  });

  it("CloudPayments: InvoiceId + TransactionId", () => {
    expect(detect({ InvoiceId: "pay_1", TransactionId: "12345" })).toBe("CLOUDPAYMENTS");
  });

  it("Ozon Pay: payment_id + order_id", () => {
    expect(detect({ payment_id: "x", order_id: "y", webhook_id: "w" })).toBe("OZON");
  });

  it("Sberbank: mdOrder", () => {
    expect(detect({ mdOrder: "abc", orderNumber: "pay_1" })).toBe("SBER");
  });

  it("VTB: transaction_id + order_id", () => {
    expect(detect({ transaction_id: "a", order_id: "b" })).toBe("VTB");
  });

  it("YooKassa: объект в поле object", () => {
    expect(detect({ type: "notification", object: { status: "succeeded" } })).toBe("YOOKASSA");
  });

  it("не распознанные данные → null", () => {
    expect(detect({})).toBeNull();
    expect(detect({ foo: "bar" })).toBeNull();
    expect(detect(null)).toBeNull();
    expect(detect("строка")).toBeNull();
  });
});
