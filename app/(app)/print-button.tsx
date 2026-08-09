"use client";

/**
 * Opens the browser print dialog, whose "Save as PDF" destination is how both
 * receipts and reports become PDFs — no server-side renderer needed.
 */
export function PrintButton({ label = "Print / save PDF" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 print:hidden"
    >
      {label}
    </button>
  );
}
