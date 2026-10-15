import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { calcPrice, formFromPrice, formatDisplayPrice } = require('../dist');

test('USD has independent fixed whole-dollar prices and RUB pricing stays unchanged', () => {
  for (const [reliefDetail, dollars, rubles] of [['low', 210, 16400], ['medium', 220, 17300], ['high', 230, 18200]]) {
    const input = { ringForm: 'mountain', material: 'silver', reliefDetail };
    const usd = calcPrice(input, 'USD');
    assert.equal(usd.total, dollars);
    assert.equal(usd.lines.reduce((sum, line) => sum + line.amount, 0), dollars);
    assert.equal(calcPrice(input, 'RUB').total, rubles);
    assert.equal(calcPrice(input).total, rubles, 'older callers keep RUB');
  }
  assert.equal(formFromPrice('mountain', 'USD'), 210);
});

test('dollar formatting has no cents or exchange-rate conversion', () => {
  assert.equal(formatDisplayPrice(210, 'USD'), '$210');
  assert.equal(formatDisplayPrice(20, 'USD'), '$20');
  assert.equal(formatDisplayPrice(230, 'USD'), '$230');
  assert.equal(formatDisplayPrice(0, 'USD'), '$0');
  assert.equal(formatDisplayPrice(16400, 'RUB').replace(/\s/g, ' '), '16 400 ₽');
});
