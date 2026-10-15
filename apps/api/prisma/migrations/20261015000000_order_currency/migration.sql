-- Existing orders and older clients retain ruble amounts.
ALTER TABLE "Order" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'RUB';
