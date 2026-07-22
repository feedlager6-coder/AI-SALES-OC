import type { ParsedIntent, ClarifyingQuestion } from './types'

// ─── Industry map ──────────────────────────────────────────────────────────────

const INDUSTRY_MAP: Array<{ keywords: string[]; label: string }> = [
  { keywords: ['строит', 'строительн', 'застройщик', 'подрядчик'], label: 'Строительство' },
  { keywords: ['юрид', 'адвокат', 'нотариус', 'правов'], label: 'Юридические услуги' },
  { keywords: ['логист', 'транспорт', 'перевоз', 'грузовик', 'доставк', 'экспедиц'], label: 'Логистика и транспорт' },
  { keywords: ['рестор', 'кафе', 'общепит', 'пиццер', 'столов', 'кофейн'], label: 'Общепит' },
  { keywords: ['медицин', 'клиник', 'стоматол', 'больниц', 'здравоохр', 'фармац'], label: 'Медицина' },
  { keywords: ['it ', 'it-', 'разработ', 'программ', 'software', 'digital', 'веб', 'web'], label: 'IT и разработка' },
  { keywords: ['производств', 'завод', 'фабрик', 'промышленн'], label: 'Производство' },
  { keywords: ['торговл', 'магазин', 'розниц', 'опт', 'дистрибьютор'], label: 'Торговля' },
  { keywords: ['консалтинг', 'консультац', 'аудит'], label: 'Консалтинг' },
  { keywords: ['реклам', 'маркетинг', 'pr', 'агентств'], label: 'Маркетинг и реклама' },
  { keywords: ['недвижим', 'риэлтор', 'аренд'], label: 'Недвижимость' },
  { keywords: ['образован', 'учебн', 'школ', 'курс', 'обучен'], label: 'Образование' },
]

// ─── Region map ────────────────────────────────────────────────────────────────

const REGION_MAP: Array<{ keywords: string[]; label: string }> = [
  { keywords: ['москв'], label: 'Москва' },
  { keywords: ['казан'], label: 'Казань' },
  { keywords: ['екатеринбург', ' екб'], label: 'Екатеринбург' },
  { keywords: ['санкт-петербург', 'питере', 'питер', ' спб', 'петербург'], label: 'Санкт-Петербург' },
  { keywords: ['новосибирск'], label: 'Новосибирск' },
  { keywords: ['краснодар'], label: 'Краснодар' },
  { keywords: ['нижний новгород', 'нижнем новгороде', 'нижнего новгорода'], label: 'Нижний Новгород' },
  { keywords: ['уфе', ' уфа'], label: 'Уфа' },
  { keywords: ['ростов'], label: 'Ростов-на-Дону' },
  { keywords: ['воронеж'], label: 'Воронеж' },
  { keywords: ['перми', ' пермь'], label: 'Пермь' },
  { keywords: ['самар'], label: 'Самара' },
  { keywords: ['челябинск'], label: 'Челябинск' },
  { keywords: ['омск'], label: 'Омск' },
  { keywords: ['красноярск'], label: 'Красноярск' },
]

// ─── Clarifying questions by industry ─────────────────────────────────────────

const INDUSTRY_QUESTIONS: Record<string, ClarifyingQuestion> = {
  'Строительство': {
    text: 'Вас интересуют только активно растущие компании?',
    options: [
      { label: 'Да, растущие', value: 'growing' },
      { label: 'Нет, любые', value: 'any' },
    ],
  },
  'Юридические услуги': {
    text: 'Вас интересуют компании, работающие с корпоративными клиентами?',
    options: [
      { label: 'Да', value: 'corporate' },
      { label: 'Нет, любые', value: 'any' },
    ],
  },
  'Логистика и транспорт': {
    text: 'Вас интересуют компании с межгородскими перевозками?',
    options: [
      { label: 'Да', value: 'intercity' },
      { label: 'Нет, любые', value: 'any' },
    ],
  },
  'IT и разработка': {
    text: 'Вас интересуют только аутсорсинговые компании?',
    options: [
      { label: 'Да, аутсорс', value: 'outsource' },
      { label: 'Нет, любые', value: 'any' },
    ],
  },
  'Медицина': {
    text: 'Вас интересуют только частные клиники?',
    options: [
      { label: 'Да, частные', value: 'private' },
      { label: 'Нет, любые', value: 'any' },
    ],
  },
}

const DEFAULT_QUESTION: ClarifyingQuestion = {
  text: 'Вас интересуют только недавно открывшиеся компании?',
  options: [
    { label: 'Да, новые', value: 'new' },
    { label: 'Нет, любые', value: 'any' },
  ],
}

// ─── Parser ────────────────────────────────────────────────────────────────────

/**
 * Mock Intent Interpreter — parses a natural-language query into structured
 * parameters without any LLM or network calls.
 *
 * REPLACING THIS IN THE FUTURE:
 * Swap this function for a real implementation that calls your Intent Interpreter
 * API (e.g. POST /api/v1/intent/parse) and returns a Promise<ParsedIntent>.
 * The InteractiveIntentCard component accepts ParsedIntent and does not care
 * how it was produced. No UI changes required.
 */
export function parseIntentMock(query: string): ParsedIntent {
  const lower = ' ' + query.toLowerCase() + ' '

  // Industry
  let industry: string | null = null
  for (const { keywords, label } of INDUSTRY_MAP) {
    if (keywords.some((k) => lower.includes(k))) {
      industry = label
      break
    }
  }

  // Region
  let region: string | null = null
  for (const { keywords, label } of REGION_MAP) {
    if (keywords.some((k) => lower.includes(k))) {
      region = label
      break
    }
  }

  // Company size — try "N–M сотрудников/человек" pattern first
  let companySize: string | null = null
  const rangeMatch = query.match(/(\d[\d\s]*)\s*[–\-—]\s*(\d[\d\s]*)\s*(сотрудник|человек|чел\.?|раб\.?)/i)
  if (rangeMatch) {
    const from = rangeMatch[1].trim()
    const to = rangeMatch[2].trim()
    companySize = `${from}–${to} сотрудников`
  } else {
    const fromMatch = query.match(/(?:от|более|свыше)\s+(\d+)\s*(сотрудник|человек)/i)
    const toMatch = query.match(/(?:до|не более)\s+(\d+)\s*(сотрудник|человек)/i)
    if (fromMatch && toMatch) {
      companySize = `${fromMatch[1]}–${toMatch[1]} сотрудников`
    } else if (fromMatch) {
      companySize = `от ${fromMatch[1]} сотрудников`
    } else if (toMatch) {
      companySize = `до ${toMatch[1]} сотрудников`
    }
  }

  // Clarifying question — skip if query already mentions newness
  const mentionsNewness = /новых?|недавн|только что|открыл/i.test(query)
  const clarifyingQuestion: ClarifyingQuestion | null = mentionsNewness
    ? null
    : (industry ? (INDUSTRY_QUESTIONS[industry] ?? DEFAULT_QUESTION) : DEFAULT_QUESTION)

  return { industry, region, companySize, clarifyingQuestion }
}
