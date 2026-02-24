import { Cat, Coffee, Medal, Scale, Zap } from 'lucide-react'

export const DEFAULT_JUDGE_ID = 'swift'

export const LEGACY_JUDGE_ID_MAP = {
  fast: 'classic',
  logical: 'swift',
  best: 'wise'
}

export const JUDGE_METADATA = {
  classic: {
    id: 'classic',
    nameKey: 'court.judges.classic.name',
    subtitleKey: 'court.judges.classic.subtitle',
    descriptionKey: 'court.judges.classic.description',
    model: 'DeepSeek v3.2',
    avatar: '/assets/avatars/judge_mochi.png',
    accentColor: 'bg-amber-400',
    borderColor: 'border-amber-300',
    icon: Scale,
    detailIcon: Coffee
  },
  swift: {
    id: 'swift',
    nameKey: 'court.judges.swift.name',
    subtitleKey: 'court.judges.swift.subtitle',
    descriptionKey: 'court.judges.swift.description',
    model: 'Gemini 3 Flash',
    avatar: '/assets/avatars/judge_dash.png',
    accentColor: 'bg-teal-500',
    borderColor: 'border-teal-400',
    icon: Zap,
    detailIcon: Zap
  },
  wise: {
    id: 'wise',
    nameKey: 'court.judges.wise.name',
    subtitleKey: 'court.judges.wise.subtitle',
    descriptionKey: 'court.judges.wise.description',
    model: 'Gemini 3.1 Pro',
    avatar: '/assets/avatars/judge_whiskers.png',
    accentColor: 'bg-purple-500',
    borderColor: 'border-purple-400',
    icon: Medal,
    detailIcon: Cat
  }
}

export const JUDGE_OPTIONS = Object.values(JUDGE_METADATA)

export const normalizeJudgeId = (judgeId) => {
  if (typeof judgeId !== 'string' || !judgeId) return DEFAULT_JUDGE_ID
  const normalized = LEGACY_JUDGE_ID_MAP[judgeId] || judgeId
  return JUDGE_METADATA[normalized] ? normalized : DEFAULT_JUDGE_ID
}

export const getJudgeMetadata = (judgeId) => JUDGE_METADATA[normalizeJudgeId(judgeId)]
