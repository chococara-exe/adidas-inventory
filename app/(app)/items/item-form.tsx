"use client";

import { useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { saveItem, type ItemFormState } from "./actions";

type CategoryOption = {
  id: string;
  name: string;
  subCategories: { id: string; name: string }[];
};

type ItemData = {
  id: string;
  name: string;
  articleNumber: string;
  categoryName: string;
  subCategoryName: string;
  priceRM: string;
  isNameset: boolean;
  lowStockThreshold: number;
  imageUrl: string | null;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900";

export function ItemForm({
  categories,
  item,
}: {
  categories: CategoryOption[];
  item?: ItemData;
}) {
  const [state, formAction, pending] = useActionState<ItemFormState, FormData>(
    saveItem,
    {}
  );

  const subCategoryNames = [
    ...new Set(categories.flatMap((c) => c.subCategories.map((s) => s.name))),
  ];

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      {item && <input type="hidden" name="id" value={item.id} />}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
          Item name
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={item?.name}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="articleNumber" className="block text-sm font-medium text-zinc-700">
            Article number
          </label>
          <input
            id="articleNumber"
            name="articleNumber"
            required
            defaultValue={item?.articleNumber}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="priceRM" className="block text-sm font-medium text-zinc-700">
            Price (RM)
          </label>
          <input
            id="priceRM"
            name="priceRM"
            required
            inputMode="decimal"
            placeholder="129.90"
            defaultValue={item?.priceRM}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="categoryName" className="block text-sm font-medium text-zinc-700">
            Category
          </label>
          <input
            id="categoryName"
            name="categoryName"
            required
            list="category-options"
            defaultValue={item?.categoryName}
            placeholder="Select or type new…"
            className={inputClass}
          />
          <datalist id="category-options">
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="subCategoryName" className="block text-sm font-medium text-zinc-700">
            Sub-category <span className="text-zinc-400">(optional)</span>
          </label>
          <input
            id="subCategoryName"
            name="subCategoryName"
            list="subcategory-options"
            defaultValue={item?.subCategoryName}
            placeholder="Select or type new…"
            className={inputClass}
          />
          <datalist id="subcategory-options">
            {subCategoryNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="lowStockThreshold" className="block text-sm font-medium text-zinc-700">
            Low-stock alert threshold
          </label>
          <input
            id="lowStockThreshold"
            name="lowStockThreshold"
            type="number"
            min={0}
            defaultValue={item?.lowStockThreshold ?? 5}
            className={inputClass}
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              name="isNameset"
              defaultChecked={item?.isNameset}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Nameset item
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="image" className="block text-sm font-medium text-zinc-700">
          Image {item?.imageUrl && <span className="text-zinc-400">(replaces current)</span>}
        </label>
        {item?.imageUrl && (
          <Image
            src={item.imageUrl}
            alt=""
            width={80}
            height={80}
            className="mt-2 h-20 w-20 rounded-lg border border-zinc-200 object-cover"
          />
        )}
        <input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mt-2 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
        />
        <p className="mt-1 text-xs text-zinc-400">JPG, PNG or WebP, max 5 MB.</p>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : item ? "Save changes" : "Create item"}
        </button>
        <Link
          href="/items"
          className="rounded-lg px-5 py-2.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
