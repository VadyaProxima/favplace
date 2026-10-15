import HomeContent from './_components/HomeContent'
import { PAGE_COPY, pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata('/', ...PAGE_COPY['/'].en)

export default function HomePage() { return <HomeContent /> }
