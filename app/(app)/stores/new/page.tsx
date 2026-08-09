import { requireAdmin } from "@/lib/auth";
import { StoreForm } from "../store-form";

export default async function NewStorePage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Add store</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Create a store, then add the accounts that will sign in to it.
      </p>
      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <StoreForm />
      </div>
    </div>
  );
}
