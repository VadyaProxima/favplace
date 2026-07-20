/**
 * Подготовка GLB из Sketchfab «classic signet ring»
 * https://sketchfab.com/3d-models/classic-signet-ring-aca7259eedfa40bda7ec9899b54d0bb8
 *
 * Модель на Sketchfab не отдаётся через Download API (downloadType: no).
 * Нужен экспорт в GLB любым способом (Ripper / Blender / автор включил download).
 *
 * Положи файл сюда:
 *   apps/web/public/models/classic-signet-ring.glb
 *
 * В GLB должны быть материалы:
 *   White_gold_14K — корпус кольца
 *   Yellow_gold_14K — вставка (будет удалена, вместо неё — DEM)
 */
import fs from 'fs'
import path from 'path'

const target = path.join(
	'apps/web/public/models/classic-signet-ring.glb',
)

if (fs.existsSync(target)) {
	const stat = fs.statSync(target)
	console.log(`OK: ${target} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`)
} else {
	console.log(`Нет файла: ${target}`)
	console.log('')
	console.log('1. Экспортируй GLB с Sketchfab (classic signet ring aca7259)')
	console.log('2. Переименуй в classic-signet-ring.glb')
	console.log('3. Положи в apps/web/public/models/')
	process.exit(1)
}
