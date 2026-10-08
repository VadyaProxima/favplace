import {
	Body,
	Controller,
	Get,
	HttpCode,
	Post,
	Req,
	Res,
	ServiceUnavailableException,
	UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ADMIN_COOKIE, AdminService } from "./admin.service";

/** Простой счётчик попыток: пароль один, и подбирать его никто не должен. */
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;

@Controller("api/admin")
export class AdminController {
	private readonly attempts = new Map<string, { count: number; resetAt: number }>();

	constructor(private readonly admin: AdminService) {}

	@Post("login")
	@HttpCode(200)
	login(
		@Body() body: { password?: string },
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	) {
		if (!this.admin.configured) {
			throw new ServiceUnavailableException(
				"Админ-доступ не настроен: нет ADMIN_PASSWORD или SESSION_SECRET",
			);
		}
		if (this.rateLimited(req)) {
			throw new UnauthorizedException("Слишком много попыток, подождите 5 минут");
		}

		if (!this.admin.checkPassword(body?.password ?? "")) {
			this.countAttempt(req);
			throw new UnauthorizedException("Неверный пароль");
		}

		this.attempts.delete(this.clientKey(req));
		res.cookie(ADMIN_COOKIE, this.admin.issueToken(), {
			httpOnly: true,
			sameSite: "lax",
			// В разработке сайт открыт по http — с secure кука бы не сохранилась.
			secure: process.env.NODE_ENV === "production",
			maxAge: this.admin.cookieMaxAge,
			path: "/",
		});
		return { authenticated: true };
	}

	@Post("logout")
	@HttpCode(200)
	logout(@Res({ passthrough: true }) res: Response) {
		res.clearCookie(ADMIN_COOKIE, { path: "/" });
		return { authenticated: false };
	}

	@Get("session")
	session(@Req() req: Request) {
		const token = readCookie(req.headers.cookie, ADMIN_COOKIE);
		return { authenticated: this.admin.verifyToken(token) };
	}

	private clientKey(req: Request): string {
		return req.ip ?? "unknown";
	}

	private rateLimited(req: Request): boolean {
		const entry = this.attempts.get(this.clientKey(req));
		if (!entry) return false;
		if (Date.now() > entry.resetAt) {
			this.attempts.delete(this.clientKey(req));
			return false;
		}
		return entry.count >= MAX_ATTEMPTS;
	}

	private countAttempt(req: Request): void {
		const key = this.clientKey(req);
		const entry = this.attempts.get(key);
		if (!entry || Date.now() > entry.resetAt) {
			this.attempts.set(key, { count: 1, resetAt: Date.now() + ATTEMPT_WINDOW_MS });
			return;
		}
		entry.count += 1;
	}
}

/** Своя разборка Cookie вместо cookie-parser: нужна ровно одна кука. */
function readCookie(header: string | undefined, name: string): string | undefined {
	if (!header) return undefined;
	for (const part of header.split(";")) {
		const eq = part.indexOf("=");
		if (eq < 0) continue;
		if (part.slice(0, eq).trim() !== name) continue;
		return decodeURIComponent(part.slice(eq + 1).trim());
	}
	return undefined;
}
