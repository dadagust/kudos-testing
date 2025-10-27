import type { RentalMode, RentalTier } from '@/entities/product';

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0;

export const calculateRentalTotal = (
  basePrice: number,
  rentalMode: RentalMode,
  tiers: RentalTier[] | undefined,
  days: number
): number => {
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    return 0;
  }
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 0;
  if (safeDays <= 0) {
    return 0;
  }
  if (rentalMode !== 'special') {
    return basePrice * safeDays;
  }

  const sortedTiers = [...(tiers ?? [])].sort((a, b) => a.end_day - b.end_day);
  let total = basePrice;
  if (safeDays === 1) {
    return total;
  }

  let previousEnd = 1;
  let lastPrice = sortedTiers.length
    ? sortedTiers[sortedTiers.length - 1].price_per_day
    : basePrice;

  for (const tier of sortedTiers) {
    const endDay = Math.floor(tier.end_day);
    const pricePerDay = Number(tier.price_per_day);
    if (!isPositiveInteger(endDay) || !Number.isFinite(pricePerDay) || pricePerDay < 0) {
      continue;
    }
    if (endDay <= previousEnd) {
      lastPrice = pricePerDay;
      continue;
    }
    const spanStart = previousEnd + 1;
    const spanEnd = Math.min(endDay, safeDays);
    if (spanEnd >= spanStart) {
      total += pricePerDay * (spanEnd - spanStart + 1);
      previousEnd = endDay;
      lastPrice = pricePerDay;
      if (spanEnd === safeDays) {
        return total;
      }
    } else {
      previousEnd = endDay;
      lastPrice = pricePerDay;
    }
  }

  if (previousEnd < safeDays) {
    const fallbackPrice = Number.isFinite(lastPrice) && lastPrice >= 0 ? lastPrice : basePrice;
    total += fallbackPrice * (safeDays - previousEnd);
  }

  return total;
};

export type { RentalMode, RentalTier };
