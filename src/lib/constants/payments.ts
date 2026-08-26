import type { PaymentMethod } from "@/types";
import type { Language } from "@/lib/i18n/config";

export const PAYMENT_METHODS: { key: PaymentMethod; label: string }[] = [
  { key: "cash", label: "Espèces" },
  { key: "wave", label: "Wave" },
  { key: "orange_money", label: "Orange Money" },
  { key: "bank_transfer", label: "Virement" },
];

const PAYMENT_METHOD_LABELS_AR: Record<string, string> = {
  cash: "نقدًا",
  wave: "Wave",
  orange_money: "Orange Money",
  bank_transfer: "تحويل بنكي",
};

export function paymentMethodLabel(key: string, language: Language = "fr"): string {
  if (language === "ar") return PAYMENT_METHOD_LABELS_AR[key] ?? key;
  return PAYMENT_METHODS.find((m) => m.key === key)?.label ?? key;
}
