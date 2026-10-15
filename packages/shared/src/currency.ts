export interface UsdExchangeRate {
  /** Russian rubles for one US dollar. */
  rubPerUsd: number;
  /** Effective date supplied by the Bank of Russia, DD.MM.YYYY. */
  date: string;
}

/** Last verified official quote, used while fetching or if the provider is unavailable. */
export const DEFAULT_USD_EXCHANGE_RATE: Readonly<UsdExchangeRate> = Object.freeze({
  rubPerUsd: 83.9497,
  date: '15.10.2026',
});

export function isUsdExchangeRate(value: unknown): value is UsdExchangeRate {
  if (!value || typeof value !== 'object') return false;
  const quote = value as Partial<UsdExchangeRate>;
  return typeof quote.rubPerUsd === 'number' && Number.isFinite(quote.rubPerUsd)
    && quote.rubPerUsd > 0 && typeof quote.date === 'string'
    && /^\d{2}\.\d{2}\.\d{4}$/.test(quote.date);
}

export function parseCbrUsdRate(xml: string): UsdExchangeRate {
  const date = xml.match(/<ValCurs\b[^>]*\bDate="([^"]+)"/)?.[1];
  const usd = [...xml.matchAll(/<Valute\b[^>]*>([\s\S]*?)<\/Valute>/g)]
    .find(block => /<CharCode>USD<\/CharCode>/.test(block[1]))?.[1];
  const number = (value?: string) => Number(value?.replace(/\s/g, '').replace(',', '.'));
  const nominal = number(usd?.match(/<Nominal>([^<]+)<\/Nominal>/)?.[1]);
  const value = number(usd?.match(/<Value>([^<]+)<\/Value>/)?.[1]);
  if (!Number.isInteger(nominal) || nominal <= 0 || !Number.isFinite(value) || value <= 0) {
    throw new Error('Invalid CBR USD exchange rate');
  }
  const quote = { date, rubPerUsd: value / nominal };
  if (!isUsdExchangeRate(quote)) throw new Error('Invalid CBR USD exchange rate');
  return quote;
}

/** Internal prices stay in RUB; convert every English display using the same quote. */
export function formatDisplayPrice(amountRub: number, language: 'ru' | 'en', rubPerUsd = DEFAULT_USD_EXCHANGE_RATE.rubPerUsd): string {
  if (language === 'ru') return `${Math.round(amountRub).toLocaleString('ru-RU')} ₽`;
  const rate = Number.isFinite(rubPerUsd) && rubPerUsd > 0 ? rubPerUsd : DEFAULT_USD_EXCHANGE_RATE.rubPerUsd;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountRub / rate);
}
