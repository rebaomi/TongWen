import { FREE_DAILY_LIMIT } from '@/shared/types'
import { getUsage, isProActive } from './storage'

export interface UsageStatus {
  used: number
  limit: number | null   // null = unlimited (Pro)
  remaining: number | null
  isPro: boolean
  isExhausted: boolean
}

export async function getUsageStatus(): Promise<UsageStatus> {
  const [usage, pro] = await Promise.all([getUsage(), isProActive()])
  if (pro) {
    return {
      used: usage.count,
      limit: null,
      remaining: null,
      isPro: true,
      isExhausted: false,
    }
  }
  const remaining = Math.max(0, FREE_DAILY_LIMIT - usage.count)
  return {
    used: usage.count,
    limit: FREE_DAILY_LIMIT,
    remaining,
    isPro: false,
    isExhausted: remaining === 0,
  }
}

export async function canTranslate(): Promise<boolean> {
  const status = await getUsageStatus()
  return !status.isExhausted
}
