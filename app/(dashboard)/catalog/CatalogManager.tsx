"use client";

import { useState } from "react";
import type { CatalogProduct, CatalogProductInput } from "@/lib/catalog/types";

type FormState = {
  name: string;
  description: string;
  priceInr: string;
  imageUrl: string;
  sku: string;
  inStock: boolean;
  active: boolean;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  priceInr: "",
  imageUrl: "",
  sku: "",
  inStock: true,
  active: true,
};

function formFor(product: CatalogProduct): FormState {
  return {
    name: product.name,
    description: product.description,
    priceInr: product.priceInr.toFixed(2),
    imageUrl: product.imageUrl ?? "",
    sku: product.sku ?? "",
    inStock: product.inStock,
    active: product.active,
  };
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

const inputClass =
  "w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-whatsapp/50";
const buttonClass =
  "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50";

export function CatalogManager({ initialProducts, canWrite }: { initialProducts: CatalogProduct[]; canWrite: boolean }) {
  const [products, setProducts] = useState<CatalogProduct[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [showDisabled, setShowDisabled] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const query = search.trim().toLowerCase();
  const visible = products.filter((product) => {
    if (!showDisabled && !product.active) return false;
    if (!query) return true;
    return product.name.toLowerCase().includes(query) || (product.sku ?? "").toLowerCase().includes(query);
  });

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError(null);
  }

  function openEdit(product: CatalogProduct) {
    setEditingId(product.id);
    setForm(formFor(product));
    setError(null);
  }

  function closeForm() {
    setForm(null);
    setEditingId(null);
    setError(null);
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function readError(response: Response, fallback: string) {
    const body = await response.json().catch(() => null);
    return typeof body?.error === "string" ? body.error : fallback;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    const payload: CatalogProductInput = {
      name: form.name,
      description: form.description,
      priceInr: form.priceInr as unknown as number,
      imageUrl: form.imageUrl || null,
      sku: form.sku || null,
      inStock: form.inStock,
      active: form.active,
    };
    try {
      const response = await fetch(editingId ? `/api/catalog/products/${editingId}` : "/api/catalog/products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setError(await readError(response, "Product could not be saved."));
        return;
      }
      const { data } = (await response.json()) as { data: CatalogProduct };
      setProducts((current) =>
        editingId ? current.map((item) => (item.id === data.id ? data : item)) : [data, ...current]
      );
      closeForm();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable(product: CatalogProduct) {
    if (!window.confirm(`Disable "${product.name}"? It will stop appearing in active products. You can re-enable it later.`)) {
      return;
    }
    setError(null);
    try {
      const response = await fetch(`/api/catalog/products/${product.id}`, { method: "DELETE" });
      if (!response.ok) {
        setError(await readError(response, "Product could not be disabled."));
        return;
      }
      const { data } = (await response.json()) as { data: CatalogProduct };
      setProducts((current) => current.map((item) => (item.id === data.id ? data : item)));
    } catch {
      setError("Network error. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or SKU"
          aria-label="Search products"
          className={`${inputClass} max-w-xs`}
        />
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={showDisabled} onChange={(event) => setShowDisabled(event.target.checked)} />
          Show disabled
        </label>
        {canWrite && (
          <button type="button" onClick={openNew} className={`${buttonClass} ml-auto bg-whatsapp text-white hover:bg-whatsapp-light`}>
            Add product
          </button>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      {form && canWrite && (
        <form onSubmit={save} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 grid gap-4 md:grid-cols-2">
          <h2 className="md:col-span-2 text-lg font-semibold text-white">{editingId ? "Edit product" : "New product"}</h2>
          <label className="space-y-1 text-sm text-gray-300">
            Name
            <input required maxLength={120} value={form.name} onChange={(e) => update("name", e.target.value)} className={inputClass} />
          </label>
          <label className="space-y-1 text-sm text-gray-300">
            Price (₹)
            <input
              required
              inputMode="decimal"
              placeholder="499.00"
              value={form.priceInr}
              onChange={(e) => update("priceInr", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-sm text-gray-300 md:col-span-2">
            Description
            <textarea
              maxLength={1000}
              rows={3}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-sm text-gray-300">
            Image URL (https)
            <input
              type="url"
              placeholder="https://"
              value={form.imageUrl}
              onChange={(e) => update("imageUrl", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-sm text-gray-300">
            SKU
            <input maxLength={64} value={form.sku} onChange={(e) => update("sku", e.target.value)} className={inputClass} />
          </label>
          <div className="flex gap-6 text-sm text-gray-300 md:col-span-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.inStock} onChange={(e) => update("inStock", e.target.checked)} />
              In stock
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.active} onChange={(e) => update("active", e.target.checked)} />
              Active
            </label>
          </div>
          <div className="md:col-span-2 flex gap-3">
            <button type="submit" disabled={busy} className={`${buttonClass} bg-whatsapp text-white hover:bg-whatsapp-light`}>
              {busy ? "Saving…" : "Save product"}
            </button>
            <button type="button" onClick={closeForm} className={`${buttonClass} border border-white/10 text-gray-300 hover:bg-white/5`}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm text-left">
          <thead className="bg-white/[0.03] text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium text-right">Price</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {canWrite && <th className="px-4 py-3 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-gray-200">
            {visible.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                  {products.length === 0 ? "No products yet." : "No products match your search."}
                </td>
              </tr>
            )}
            {visible.map((product) => (
              <tr key={product.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{product.name}</div>
                  {product.description && <div className="text-xs text-gray-500 line-clamp-1">{product.description}</div>}
                </td>
                <td className="px-4 py-3 text-gray-400">{product.sku ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatPrice(product.priceInr)}</td>
                <td className="px-4 py-3">{product.inStock ? "In stock" : "Out of stock"}</td>
                <td className="px-4 py-3">
                  <span className={product.active ? "text-emerald-400" : "text-gray-500"}>
                    {product.active ? "Active" : "Disabled"}
                  </span>
                </td>
                {canWrite && (
                  <td className="px-4 py-3 text-right space-x-3">
                    <button type="button" onClick={() => openEdit(product)} className="text-whatsapp-light hover:underline">
                      Edit
                    </button>
                    {product.active && (
                      <button type="button" onClick={() => disable(product)} className="text-red-400 hover:underline">
                        Disable
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
