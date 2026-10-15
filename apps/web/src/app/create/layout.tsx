import { PAGE_COPY, pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata('/create', ...PAGE_COPY['/create'].en)

export default function CreateLayout({ children }: { children: React.ReactNode }) {
	return <>{children}</>
}
