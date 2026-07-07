export const COMPUTER_PLAYER_IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000005',
] as const

export function isComputerPlayerId(id: string | null | undefined): boolean {
  return !!id && COMPUTER_PLAYER_IDS.includes(id as typeof COMPUTER_PLAYER_IDS[number])
}

export function computerPlayerId(index: number): string {
  return COMPUTER_PLAYER_IDS[Math.max(0, Math.min(index, COMPUTER_PLAYER_IDS.length - 1))]
}

export function computerPlayerName(id: string | null | undefined): string {
  if (!id) return 'Computer'
  const index = COMPUTER_PLAYER_IDS.indexOf(id as typeof COMPUTER_PLAYER_IDS[number])
  return index >= 0 ? `Computer ${index + 1}` : 'Computer'
}

export function computerPlayerIds(count: number): string[] {
  return COMPUTER_PLAYER_IDS.slice(0, Math.max(0, Math.min(count, COMPUTER_PLAYER_IDS.length)))
}
