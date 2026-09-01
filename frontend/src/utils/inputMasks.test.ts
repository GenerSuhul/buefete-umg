import { describe, expect, it } from "vitest";
import {
  formatCui,
  formatGuatemalaPhone,
  isCompleteCui,
  isCompleteGuatemalaPhone,
} from "./inputMasks";

describe("máscaras de identificación y contacto", () => {
  it("mantiene el CUI en grupos 4-5-4 mientras se escribe o pega", () => {
    expect(formatCui("3306074481712")).toBe("3306 07448 1712");
    expect(formatCui("3306-07448-1712-extra")).toBe("3306 07448 1712");
    expect(isCompleteCui("3306 07448 1712")).toBe(true);
  });

  it("formatea teléfonos locales e internacionales de Guatemala", () => {
    expect(formatGuatemalaPhone("46637327")).toBe("4663 7327");
    expect(formatGuatemalaPhone("+502 46637327")).toBe("+502 4663 7327");
    expect(isCompleteGuatemalaPhone("4663 7327")).toBe(true);
    expect(isCompleteGuatemalaPhone("123")).toBe(false);
  });
});
