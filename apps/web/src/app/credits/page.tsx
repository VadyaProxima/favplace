import { PAGE_COPY, pageMetadata } from '@/lib/seo'
import { CreditsContent } from './CreditsContent'

export const metadata = pageMetadata('/credits', ...PAGE_COPY['/credits'].en)

export default function CreditsPage() {
	return <CreditsContent />
}
