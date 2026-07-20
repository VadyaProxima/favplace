import fs from 'fs'

const html = fs.readFileSync('screenshots/sketchfab_embed.html', 'utf8')
const m = html.match(/js-dom-data-prefetched-data[^>]*><!--([\s\S]*?)-->/)
if (!m) {
	console.error('no prefetched data')
	process.exit(1)
}
const json = JSON.parse(m[1].replace(/&#34;/g, '"'))
const model = json['/i/models/aca7259eedfa40bda7ec9899b54d0bb8']
console.log(
	JSON.stringify(
		{
			downloadType: model?.downloadType,
			isDownloadable: model?.isDownloadable,
			archives: model?.archives,
			glb: model?.glb,
			files: model?.files?.map(f => ({
				type: f.type,
				url: f.url,
				size: f.size,
				name: f.name,
			})),
		},
		null,
		2,
	),
)
