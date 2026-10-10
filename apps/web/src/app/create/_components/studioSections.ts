import type { Step } from '@/store/useAppStore'

export const STUDIO_SECTIONS: { title: string; description: string; steps: Step[] }[] = [
	{ title: 'Ландшафт', description: 'Место и рельеф', steps: ['place', 'relief'] },
	{ title: 'Кольцо', description: 'Форма, металл и размер', steps: ['form', 'material', 'size'] },
	{ title: 'Заявка', description: 'Проверка и контакты', steps: ['order'] },
]

export const STUDIO_STEP_TITLES: Record<Step, string> = {
	place: 'Выбрать место',
	relief: 'Настроить рельеф',
	form: 'Форма кольца',
	material: 'Металл и отделка',
	size: 'Размер',
	order: 'Оформить заявку',
}
