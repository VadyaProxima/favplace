import { Injectable } from '@nestjs/common'
import { DEFAULT_USD_EXCHANGE_RATE, parseCbrUsdRate, type UsdExchangeRate } from '@favplace/shared'

@Injectable()
export class CurrencyService {
	private quote: UsdExchangeRate = { ...DEFAULT_USD_EXCHANGE_RATE }
	private retryAfter = 0
	private pending: Promise<UsdExchangeRate> | null = null

	getRate(): Promise<UsdExchangeRate> {
		if (Date.now() < this.retryAfter) return Promise.resolve(this.quote)
		if (this.pending) return this.pending
		this.pending = this.refresh().finally(() => { this.pending = null })
		return this.pending
	}

	private async refresh(): Promise<UsdExchangeRate> {
		try {
			const response = await fetch('https://www.cbr.ru/scripts/XML_daily.asp', {
				signal: AbortSignal.timeout(4000),
			})
			if (!response.ok) throw new Error(`CBR HTTP ${response.status}`)
			this.quote = parseCbrUsdRate(await response.text())
			this.retryAfter = Date.now() + 60 * 60 * 1000
		} catch {
			// Keep the last good quote and retry later, including a cold-start fallback.
			this.retryAfter = Date.now() + 60 * 1000
		}
		return this.quote
	}
}
