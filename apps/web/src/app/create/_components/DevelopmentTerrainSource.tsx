'use client'

import { useT } from '@/lib/preferences'
import type { TerrainProvider } from '@/lib/referenceTerrainRequests'
import { encodeConfigParams } from '@/lib/configUrl'
import { useAppStore } from '@/store/useAppStore'
import styles from './CreateStudio.module.css'

export function DevelopmentTerrainSource({ provider }: { provider: TerrainProvider }) {
	const t = useT()
	const params = useAppStore(state => encodeConfigParams(state).toString())
	const target = provider === 'mapbox' ? '/create-terrarium' : '/create-mapbox'
	const other = provider === 'mapbox' ? 'Terrarium' : 'Mapbox'
	return <div className={styles.developmentSource}>
		<span>{t('Сравнение рельефа')} · <strong>{provider === 'mapbox' ? <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer">© Mapbox Terrain-RGB</a> : 'Terrarium'}</strong></span>
		<a href={`${target}?${params}`}>{t('Сравнить с')} {other} ↗</a>
	</div>
}
