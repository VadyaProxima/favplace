import { Controller, Get, Header, Module } from '@nestjs/common'
import { CurrencyService } from './currency.service'

@Controller('api/currency')
class CurrencyController {
	constructor(private readonly currency: CurrencyService) {}

	@Get('usd')
	@Header('Cache-Control', 'public, max-age=60')
	getUsd() { return this.currency.getRate() }
}

@Module({ controllers: [CurrencyController], providers: [CurrencyService] })
export class CurrencyModule {}
