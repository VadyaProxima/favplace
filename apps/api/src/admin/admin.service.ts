import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";

/** Сколько живёт сессия админа. Заходить каждый день не хочется. */
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export const ADMIN_COOKIE = "favplace_admin";

/**
 * Доступ администратора: один пароль из окружения и подписанная кука.
 *
 * Полноценной таблицы пользователей здесь нет намеренно — админ ровно один,
 * а хранить его в БД значит тащить обратно регистрацию, хеши и миграции
 * ради единственной строки.
 */
@Injectable()
export class AdminService {
	private readonly secret = process.env.SESSION_SECRET ?? "";
	private readonly password = process.env.ADMIN_PASSWORD ?? "";

	/** Без обеих переменных вход невозможен — это не «пустой пароль подойдёт». */
	get configured(): boolean {
		return this.password.length > 0 && this.secret.length > 0;
	}

	/**
	 * Сравниваем не пароли, а их HMAC: дайджесты всегда одной длины, поэтому
	 * timingSafeEqual не бросает исключение и по времени ответа нельзя
	 * узнать даже длину настоящего пароля.
	 */
	checkPassword(candidate: string): boolean {
		if (!this.configured) return false;
		const a = Buffer.from(this.sign(candidate ?? ""), "hex");
		const b = Buffer.from(this.sign(this.password), "hex");
		return timingSafeEqual(a, b);
	}

	issueToken(): string {
		const payload = String(Date.now() + SESSION_TTL_MS);
		return `${payload}.${this.sign(payload)}`;
	}

	verifyToken(token: string | undefined): boolean {
		if (!token || !this.configured) return false;

		const dot = token.indexOf(".");
		if (dot <= 0) return false;
		const payload = token.slice(0, dot);
		const signature = token.slice(dot + 1);

		const expected = this.sign(payload);
		if (signature.length !== expected.length) return false;
		if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
			return false;
		}

		const expiresAt = Number(payload);
		return Number.isFinite(expiresAt) && expiresAt > Date.now();
	}

	get cookieMaxAge(): number {
		return SESSION_TTL_MS;
	}

	private sign(payload: string): string {
		return createHmac("sha256", this.secret).update(payload).digest("hex");
	}
}
