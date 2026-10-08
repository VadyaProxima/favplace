-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "configJson" TEXT,
    "shareUrl" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "delivery" TEXT,
    "comment" TEXT,
    "promo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");


-- Атомарная выдача человекочитаемых номеров заказа (FP-000123).
-- Без секвенции два параллельных чекаута могут выбрать один номер.
CREATE SEQUENCE "order_number_seq" START 1;
