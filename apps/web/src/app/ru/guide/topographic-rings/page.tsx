import { RingGuide } from '../../../_components/RingGuide'
import { GUIDE_COPY } from '@/lib/ringGuide'
import { RU_GUIDE_PATH, guideAlternates, pageMetadata } from '@/lib/seo'

export const metadata = {
	...pageMetadata(RU_GUIDE_PATH, GUIDE_COPY.ru.title, GUIDE_COPY.ru.description, 'ru'),
	alternates: { canonical: RU_GUIDE_PATH, languages: guideAlternates },
}

export default function GuidePage() { return <RingGuide language="ru" /> }
