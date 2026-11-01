import { describe, expect, it } from "vitest";
import { buildCourseReceipt } from "./receipts";

describe("buildCourseReceipt", () => {
  it("базовый чек: service / full_payment / quantity 1", () => {
    const receipt = buildCourseReceipt({
      courseTitle: "Курс по Python",
      amount: 4990,
      customer: { email: "student@example.com" },
    });

    expect(receipt.items).toHaveLength(1);
    const item = receipt.items[0];
    expect(item).toMatchObject({
      description: "Курс по Python",
      amount: 4990,
      quantity: 1,
      vatCode: 4, // УСН — без НДС по умолчанию
      paymentMode: "full_payment",
      paymentSubject: "service",
    });
    expect(receipt.customer.email).toBe("student@example.com");
  });

  it("сумма округляется до копеек (54-ФЗ требует 2 знака)", () => {
    const receipt = buildCourseReceipt({
      courseTitle: "Курс",
      amount: 999.987,
      customer: {},
    });
    expect(receipt.items[0].amount).toBe(999.99);
  });

  it("цена со скидкой передаётся как есть (уже нетто)", () => {
    const receipt = buildCourseReceipt({
      courseTitle: "Курс",
      amount: 3992, // 4990 − 20%
      customer: {},
    });
    expect(receipt.items[0].amount).toBe(3992);
  });

  it("vatCode и taxSystemCode прокидываются", () => {
    const receipt = buildCourseReceipt({
      courseTitle: "Курс",
      amount: 1000,
      customer: {},
      vatCode: 1,
      taxSystemCode: 2,
    });
    expect(receipt.items[0].vatCode).toBe(1);
    expect(receipt.taxSystemCode).toBe(2);
  });

  it("taxSystemCode не задан → поле отсутствует", () => {
    const receipt = buildCourseReceipt({
      courseTitle: "Курс",
      amount: 1000,
      customer: {},
    });
    expect(receipt.taxSystemCode).toBeUndefined();
  });

  it("все поля покупателя прокидываются", () => {
    const receipt = buildCourseReceipt({
      courseTitle: "Курс",
      amount: 1000,
      customer: { email: "a@b.ru", phone: "+79001234567", fullName: "Иванов Иван" },
    });
    expect(receipt.customer).toEqual({
      email: "a@b.ru",
      phone: "+79001234567",
      fullName: "Иванов Иван",
    });
  });
});
