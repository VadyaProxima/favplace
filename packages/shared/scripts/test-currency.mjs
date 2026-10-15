import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { parseCbrUsdRate, formatDisplayPrice, DEFAULT_USD_EXCHANGE_RATE } = require('../dist');

test('the USD quote is selected by currency code and divided by its nominal', () => {
  const xml = '<ValCurs Date="15.10.2026"><Valute ID="EUR"><Nominal>1</Nominal><CharCode>EUR</CharCode><Value>99,99</Value></Valute>'
    + '<Valute ID="USD"><Nominal>10</Nominal><CharCode>USD</CharCode><Value>839,4970</Value><VunitRate>83,9497</VunitRate></Valute></ValCurs>';
  const quote = parseCbrUsdRate(xml);
  assert.equal(quote.date, DEFAULT_USD_EXCHANGE_RATE.date);
  assert.ok(Math.abs(quote.rubPerUsd - DEFAULT_USD_EXCHANGE_RATE.rubPerUsd) < 1e-10);
  for (const invalid of [xml.replace('<CharCode>USD', '<CharCode>JPY'), xml.replace('Date=', 'Missing='), xml.replace('<Nominal>10', '<Nominal>0'), xml.replace('839,4970', '-1'), 'not xml']) {
    assert.throws(() => parseCbrUsdRate(invalid), /Invalid CBR/);
  }
});

test('English prices convert RUB amounts into USD across line items and order totals', () => {
  assert.equal(formatDisplayPrice(16400, 'en', 80), '$205.00');
  assert.equal(formatDisplayPrice(1800, 'en', 80), '$22.50');
  assert.equal(formatDisplayPrice(18200, 'en', 80), '$227.50');
  assert.equal(formatDisplayPrice(0, 'en', 80), '$0.00');
  assert.equal(formatDisplayPrice(16400, 'ru', 80).replace(/\s/g, ' '), '16 400 ₽');
  assert.equal(formatDisplayPrice(16400, 'en', 0), formatDisplayPrice(16400, 'en'));
});
