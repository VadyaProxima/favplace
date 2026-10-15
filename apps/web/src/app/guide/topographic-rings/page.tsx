import { RingGuide } from '../../_components/RingGuide'
import { GUIDE_COPY } from '@/lib/ringGuide'
import { GUIDE_PATH, guideAlternates, pageMetadata } from '@/lib/seo'

export const metadata = {
	...pageMetadata(GUIDE_PATH, GUIDE_COPY.en.title, GUIDE_COPY.en.description),
	alternates: { canonical: GUIDE_PATH, languages: guideAlternates },
}

export default function GuidePage() { return <RingGuide language="en" /> }
