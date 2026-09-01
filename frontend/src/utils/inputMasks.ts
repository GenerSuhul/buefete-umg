const digits = (value: string) => value.replace(/\D/g, "");

export const cuiDigits = (value: string) => digits(value).slice(0, 13);

export function formatCui(value: string) {
  const valueDigits = cuiDigits(value);
  return [
    valueDigits.slice(0, 4),
    valueDigits.slice(4, 9),
    valueDigits.slice(9, 13),
  ]
    .filter(Boolean)
    .join(" ");
}

export const isCompleteCui = (value: string) => cuiDigits(value).length === 13;

export function formatGuatemalaPhone(value: string) {
  const valueDigits = digits(value);
  const international = value.trim().startsWith("+") || valueDigits.length > 8;
  if (international && valueDigits.startsWith("502")) {
    const local = valueDigits.slice(3, 11);
    return `+502${local ? ` ${local.slice(0, 4)}` : ""}${local.length > 4 ? ` ${local.slice(4)}` : ""}`;
  }

  const local = valueDigits.slice(0, 8);
  return local.length > 4 ? `${local.slice(0, 4)} ${local.slice(4)}` : local;
}

export function isCompleteGuatemalaPhone(value: string) {
  if (!value.trim()) return true;
  const valueDigits = digits(value);
  return valueDigits.length === 8 || (valueDigits.startsWith("502") && valueDigits.length === 11);
}
