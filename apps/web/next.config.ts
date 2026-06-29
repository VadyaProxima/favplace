import type { NextConfig } from 'next'

const config: NextConfig = {
	transpilePackages: ['@favplace/shared'],
	async rewrites() {
		return [
			{
				source: '/api/:path*',
				destination: 'http://localhost:4000/api/:path*',
			},
		]
	},
}

export default config
