import fs from 'fs'

const html = fs.readFileSync('screenshots/sketchfab_embed.html', 'utf8')
const m = html.match(/js-dom-data-prefetched-data[^>]*><!--([\s\S]*?)-->/)
const json = JSON.parse(m[1].replace(/&#34;/g, '"'))
const model = json['/i/models/aca7259eedfa40bda7ec9899b54d0bb8']
fs.writeFileSync(
	'screenshots/sketchfab_model.json',
	JSON.stringify(model, null, 2),
)
console.log('keys', Object.keys(model))
console.log('files', model.files?.length)
for (const f of model.files ?? []) console.log(f)
if (model.version) console.log('version keys', Object.keys(model.version))
if (model.gltf) console.log('gltf', model.gltf)
