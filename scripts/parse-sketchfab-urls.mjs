import fs from 'fs'

const html = fs.readFileSync('screenshots/sketchfab_embed.html', 'utf8')
const urls = [...html.matchAll(/https:\/\/media\.sketchfab\.com[^"'\s\\]+/g)].map(m =>
	m[0].replace(/\\u002F/g, '/'),
)
const unique = [...new Set(urls)]
for (const u of unique.filter(u => /glb|gltf|bin|draco|geometry|model/i.test(u))) {
	console.log(u)
}
console.log('--- all model urls ---')
for (const u of unique.filter(u => u.includes('aca7259eedfa40bda7ec9899b54d0bb8'))) {
	console.log(u)
}
