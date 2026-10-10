import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { normalizeCheckoutCustomer, normalizeCheckoutPhone, formatCheckoutPhone, validateCheckoutCustomer } = require('../dist');
const valid = { name: 'Анна-Мария', phone: '+7 (900) 000-00-00', email: 'anna@example.com', delivery: '' };

test('phone formatting and normalization preserve international country codes', () => {
  for (const [input, expected] of [
    ['8 (900) 000-00-00', '+79000000000'], ['9000000000', '+79000000000'],
    ['+44 7700 900123', '+447700900123'], ['+1 (202) 555-0123', '+12025550123'],
    ['+49 1512 3456789', '+4915123456789'], ['+86 138 0013 8000', '+8613800138000'],
    ['+33 6 12 34 56 78', '+33612345678'], ['+971 50 123 4567', '+971501234567'],
  ]) {
    assert.equal(normalizeCheckoutPhone(input), expected);
    assert.equal(normalizeCheckoutPhone(formatCheckoutPhone(input)), expected);
    assert.equal(validateCheckoutCustomer({ ...valid, phone: input }).phone, undefined);
  }
  assert.equal(formatCheckoutPhone('79000000000'), '+7 (900) 000-00-00');
  assert.equal(formatCheckoutPhone(''), '');
  assert.equal(formatCheckoutPhone('+'), '+');
});

test('invalid or incomplete contact details are rejected', () => {
  for (const name of ['', 'А', 'Иван123', '<script>', 'a'.repeat(81), 42, null]) {
    assert.ok(validateCheckoutCustomer({ ...valid, name }).name, `name ${name}`);
  }
  for (const phone of ['', '+7 (900)', '+790000000001', '+0123456789', '+1234567890123456', '+44abc7700900123', {}, null]) {
    assert.ok(validateCheckoutCustomer({ ...valid, phone }).phone, `phone ${phone}`);
  }
  for (const email of ['', 'a@b', 'a..b@example.com', '.a@example.com', 'a.@example.com',
    'a b@example.com', 'a@example..com', 'a@-example.com', 'a@example-.com', 'a@example.com@x.com',
    'a'.repeat(65) + '@example.com', {}, null]) {
    assert.ok(validateCheckoutCustomer({ ...valid, email }).email, `email ${email}`);
  }
});

test('international names and email aliases work; normalization preserves email local-part case', () => {
  for (const name of ['Анна Мария', "O'Connor", 'Jean-Luc', 'José García', '李明', 'A\u0301na', 'О’Брайен']) {
    assert.deepEqual(validateCheckoutCustomer({ ...valid, name }), {});
  }
  assert.deepEqual(validateCheckoutCustomer({ ...valid, email: 'Anna+orders@пример.рф' }), {});
  const input = { ...valid, name: '  Анна   Мария  ', email: ' Anna+orders@EXAMPLE.COM ', promo: ' summer-10 ', comment: ' привет ', delivery: ' x ' };
  const normalized = normalizeCheckoutCustomer(input);
  assert.equal(normalized.name, 'Анна Мария');
  assert.equal(normalized.email, 'Anna+orders@example.com');
  assert.equal(normalized.promo, 'SUMMER-10');
  assert.equal(normalized.comment, 'привет');
  assert.equal(normalized.delivery, 'x');
  assert.equal(input.name, '  Анна   Мария  ');
});

test('optional fields have bounds; addresses remain free-form and optional', () => {
  for (const delivery of ['', 'X', '🏔', undefined, 'a'.repeat(3000)]) {
    assert.deepEqual(validateCheckoutCustomer({ ...valid, delivery }), {});
  }
  assert.deepEqual(validateCheckoutCustomer({ ...valid, promo: 'ЛЕТО-10_ABC', comment: 'a'.repeat(2000) }), {});
  assert.ok(validateCheckoutCustomer({ ...valid, promo: 'bad code' }).promo);
  assert.ok(validateCheckoutCustomer({ ...valid, promo: 'a'.repeat(41) }).promo);
  assert.ok(validateCheckoutCustomer({ ...valid, promo: {} }).promo);
  assert.ok(validateCheckoutCustomer({ ...valid, comment: 'a'.repeat(2001) }).comment);
  assert.ok(validateCheckoutCustomer({ ...valid, comment: [] }).comment);
});
