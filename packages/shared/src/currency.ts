export type PriceCurrency = 'RUB' | 'USD';

/** Amounts already belong to their price list; there is no exchange-rate conversion. */
export function formatDisplayPrice(amount: number, currency: PriceCurrency): string {
  if (currency === 'RUB') return `${Math.round(amount).toLocaleString('ru-RU')} ₽`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}
