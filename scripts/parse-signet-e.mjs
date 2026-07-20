import fs from 'fs'

const html = fs.readFileSync('screenshots/signet_e_embed.html', 'utf8')
const m = html.match(/js-dom-data-prefetched-data[^>]*><!--([\s\S]*?)-->/)
const j = JSON.parse(m[1].replace(/&#34;/g, '"'))
const model = j['/i/models/d0d27abf870f4300b755ca72721da3d6']
console.log(model.name, model.downloadType)
console.log(JSON.stringify(model.files, null, 2))
