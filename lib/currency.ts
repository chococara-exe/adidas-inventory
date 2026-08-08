// All monetary values are stored as integer sen. RM 129.90 = 12990 sen.

const fmt = new Intl.NumberFormat("ms-MY", {
  style: "currency",
  currency: "MYR",
});

export function formatRM(sen: number): string {
  return fmt.format(sen / 100);
}

/** Parse a user-entered ringgit string ("129.90") into sen. Returns null if invalid. */
export function parseRM(input: string): number | null {
  const cleaned = input.replace(/[RM\s,]/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}
