import type { CheckoutCustomer } from './index';

export const CHECKOUT_LIMITS = { name: 80, email: 254, promo: 40, comment: 2000 } as const;
export type CheckoutField = 'name' | 'phone' | 'email' | 'promo' | 'comment';
export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

const text = (value: unknown): string => typeof value === 'string' ? value : '';

/** National Russian numbers are accepted on paste; explicit country codes stay intact. */
export function normalizeCheckoutPhone(value: string): string {
  const trimmed = value.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (!trimmed.startsWith('+')) {
    if (digits.length === 11 && digits.startsWith('8')) digits = '7' + digits.slice(1);
    else if (digits.length === 10) digits = '7' + digits;
  }
  return digits ? '+' + digits : '';
}

export function formatCheckoutPhone(value: string): string {
  const phone = normalizeCheckoutPhone(value);
  if (!phone) return value.trim().startsWith('+') ? '+' : '';
  const digits = phone.slice(1);
  if (digits.startsWith('7') || digits.startsWith('1')) {
    const national = digits.slice(1);
    let formatted = '+' + digits[0];
    if (national.length) formatted += ' (' + national.slice(0, 3);
    if (national.length >= 3) formatted += ')';
    if (national.length > 3) formatted += ' ' + national.slice(3, 6);
    if (national.length > 6) formatted += '-' + (digits[0] === '1' ? national.slice(6) : national.slice(6, 8));
    if (national.length > 8 && digits[0] === '7') formatted += '-' + national.slice(8);
    return formatted;
  }
  // International numbering plans vary: use readable groups without imposing +7.
  return '+' + digits.match(/.{1,3}/g)!.join(' ');
}

export function normalizeCheckoutCustomer(input: Partial<Record<keyof CheckoutCustomer, unknown>>): CheckoutCustomer {
  const email = text(input.email).trim();
  const at = email.lastIndexOf('@');
  return {
    name: text(input.name).trim().replace(/\s+/gu, ' '),
    phone: normalizeCheckoutPhone(text(input.phone)),
    email: at < 0 ? email : email.slice(0, at + 1) + email.slice(at + 1).toLowerCase(),
    delivery: text(input.delivery).trim(),
    comment: text(input.comment).trim() || undefined,
    promo: text(input.promo).trim().toUpperCase() || undefined,
  };
}

export function validateCheckoutCustomer(input: Partial<Record<keyof CheckoutCustomer, unknown>>): CheckoutErrors {
  const customer = normalizeCheckoutCustomer(input);
  const errors: CheckoutErrors = {};
  if (!customer.name) errors.name = 'Укажите имя';
  else if (customer.name.length > CHECKOUT_LIMITS.name) errors.name = 'Имя — не больше 80 символов';
  else if (!/^[\p{L}\p{M}]+(?:[ '\u2019\u02bc-][\p{L}\p{M}]+)*$/u.test(customer.name)
    || (customer.name.match(/\p{L}/gu)?.length ?? 0) < 2) {
    errors.name = 'Имя должно содержать минимум две буквы, без цифр и спецсимволов';
  }

  if (!customer.phone) errors.phone = 'Укажите телефон';
  else if (!/^[+\d\s().-]+$/u.test(text(input.phone).trim())
    || !/^\+[1-9]\d{7,14}$/.test(customer.phone)
    || (/^\+[17]/.test(customer.phone) && customer.phone.length !== 12)) {
    errors.phone = 'Введите полный номер с кодом страны: от 8 до 15 цифр';
  }

  const [local, domain, extra] = customer.email.split('@');
  const labels = domain?.split('.') ?? [];
  if (typeof input.email !== 'string' || customer.email.length > CHECKOUT_LIMITS.email
    || !local || local.length > 64 || extra !== undefined
    || !/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)
    || local.startsWith('.') || local.endsWith('.') || local.includes('..')
    || labels.length < 2 || labels.some(label => label.length > 63 || !/^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u.test(label))
    || !/^(?:[\p{L}]{2,63}|xn--[a-z0-9-]+)$/u.test(labels.at(-1) ?? '')) {
    errors.email = 'Проверьте email';
  }

  if (input.promo !== undefined && typeof input.promo !== 'string') errors.promo = 'Промокод: только буквы, цифры, дефис и подчёркивание';
  else if (customer.promo && (customer.promo.length > CHECKOUT_LIMITS.promo || !/^[\p{L}\p{N}_-]+$/u.test(customer.promo))) {
    errors.promo = 'Промокод: до 40 символов, только буквы, цифры, дефис и подчёркивание';
  }
  if (input.comment !== undefined && typeof input.comment !== 'string') errors.comment = 'Проверьте комментарий';
  else if ((customer.comment?.length ?? 0) > CHECKOUT_LIMITS.comment) errors.comment = 'Комментарий — не больше 2000 символов';
  // Delivery/address is intentionally free-form and has no validation.
  return errors;
}
