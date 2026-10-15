import { ImageResponse } from 'next/og'

export const dynamic = 'force-static'

export function GET() {
	return new ImageResponse(
		<div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '70px 80px', background: '#141418', color: '#f1f1f4' }}>
			<div style={{ display: 'flex', fontSize: 28, letterSpacing: 5 }}>MESTO METAL</div>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
				<div style={{ fontSize: 76, lineHeight: 1.08 }}>Your place. Cast in silver.</div>
				<div style={{ fontSize: 30, color: '#acacb9' }}>Custom topographic rings · Design yours in 3D</div>
			</div>
			<div style={{ display: 'flex', fontSize: 23, color: '#acacb9' }}>mestometal.ru</div>
		</div>,
		{ width: 1200, height: 630 },
	)
}
