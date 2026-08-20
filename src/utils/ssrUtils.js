const CATEGORY_BY_CODE = Object.freeze({
  WCHR: "PRM",
  WCHS: "PRM",
  WCHC: "PRM",
  WCMP: "PRM",
  WCBD: "PRM",
  WCLB: "PRM",
  BLND: "PRM",
  DEAF: "PRM",
  UMNR: "UM",
  UM_DECLINED: "UM",
  MAAS: "ASSISTANCE",
  LPPS: "PPS_SOLITAIRE",
  QPPS: "PPS_SOLITAIRE",
  TPPS: "PPS_SOLITAIRE",
  KFEG: "ELITE",
  KFES: "ELITE",
  HCIP: "VIP_PARTICULAR",
  IMPT: "VIP_PARTICULAR",
  VIP: "VIP_PARTICULAR",
  SVAN: "ANIMAL",
  ESAN: "ANIMAL",
  AVIH: "ANIMAL",
  BOOKABLE_STAFF: "STAFF",
  REBATE_STAFF: "STAFF",
  CHLD: "CHILD",
});

export const SSR_CATEGORY_BY_CODE = CATEGORY_BY_CODE;

export function classifySsrCode(code, { isSpecialMeal = false } = {}) {
  if (typeof code !== "string" || code.length === 0) {
    throw new TypeError("SSR code must be a non-empty string");
  }

  const lookupCode = code.trim().toUpperCase();

  if (isSpecialMeal) {
    return { category: "MEAL", code };
  }

  return {
    category: CATEGORY_BY_CODE[lookupCode] ?? "OTHER",
    code,
  };
}
