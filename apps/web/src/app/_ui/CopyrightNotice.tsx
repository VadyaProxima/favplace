'use client'

import { useT } from '@/lib/preferences'

export function CopyrightNotice({ compact = false }: { compact?: boolean }) {
	const t = useT()
	return <span>© {new Date().getFullYear()} {t('Место Металл')}{!compact && <>. {t('Все права защищены.')}</>}</span>
}
