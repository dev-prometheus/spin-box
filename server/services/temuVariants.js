// Only offer variants with an explicit SKU, price, availability and quantity.
export function readTemuVariants(item, fxRate) {
  if (!Array.isArray(item.skus) || !Number.isFinite(fxRate) || fxRate <= 0) return [];
  const variants = new Map();
  for (const sku of item.skus) {
    const id = String(sku?.skuId ?? '').trim();
    const priceUsd = Math.round(Number(sku?.price) * fxRate * 100) / 100;
    const limits = [sku?.stock, sku?.maxPerOrder].filter(value => value != null);
    if (!id || sku.isAvailable !== true || !Number.isFinite(priceUsd) || priceUsd < 0.01 || priceUsd > 99999999.99
        || !Number.isSafeInteger(sku.stock) || limits.some(limit => !Number.isSafeInteger(limit) || limit < 1)) continue;

    const options = Object.fromEntries(Object.entries(sku.specs ?? {})
      .filter(([key, value]) => key.trim() && typeof value === 'string' && value.trim()));
    if (item.skus.length > 1 && !Object.keys(options).length) continue;
    variants.set(id, { id, priceUsd, maxQuantity: Math.min(...limits, 999, Math.floor(9999999999 / Math.round(priceUsd * 100))), options });
  }
  return [...variants.values()];
}
