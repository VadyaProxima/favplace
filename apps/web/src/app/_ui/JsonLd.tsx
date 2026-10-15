/** Escape HTML delimiters even when a future field contains user-supplied text. */
export function JsonLd({ data }: { data: unknown }) {
	return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
}
