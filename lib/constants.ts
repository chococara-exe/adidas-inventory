export const ROLES = ["ADMIN", "STORE"] as const;
export type Role = (typeof ROLES)[number];

export const RECEIPT_TYPES = ["SALE", "SPOIL", "TRANSFER", "STOCK_IN"] as const;
export type ReceiptType = (typeof RECEIPT_TYPES)[number];

export const MOVEMENT_REASONS = [
  "SALE",
  "SPOIL",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "STOCK_IN",
  "ADJUSTMENT",
] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

export const RECEIPT_TYPE_LABELS: Record<ReceiptType, string> = {
  SALE: "Sale",
  SPOIL: "Spoil",
  TRANSFER: "Transfer",
  STOCK_IN: "Stock In",
};
