export type CatalogProduct = {
  id: string;
  name: string;
  description: string;
  priceInr: number;
  currency: "INR";
  imageUrl: string | null;
  sku: string | null;
  inStock: boolean;
  active: boolean;
  updatedAt: string;
};

export type CatalogProductInput = {
  name: string;
  description: string;
  priceInr: number;
  imageUrl: string | null;
  sku: string | null;
  inStock: boolean;
  active: boolean;
};

export type CatalogProductListFilter = {
  search?: string;
  active?: boolean;
  inStock?: boolean;
  limit?: number;
  offset?: number;
};
