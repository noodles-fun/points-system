export const checkValidAddress = (address: string) => {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error('Invalid address')
  }
}

export type Period = {
  fromDate: Date
  fromTimestamp: number
  fromGraphTimestamp: number
  fromDateUTC: string
  toDate: Date
  toTimestamp: number
  toGraphTimestamp: number
  toDateUTC: string
}

export const getPeriod = (
  from?: string,
  to?: string,
  mode: 'past-day' | 'past-week' = 'past-week' // Default to past week
): Period & {
  days: Period[]
} => {
  let fromDate: Date
  let toDate: Date

  if (!from || !to) {
    const now = new Date()

    if (mode === 'past-day') {
      // Default to **yesterday**
      fromDate = new Date(now)
      fromDate.setUTCDate(now.getUTCDate() - 1) // Yesterday
      fromDate.setUTCHours(0, 0, 0, 0)

      toDate = new Date(fromDate)
      toDate.setUTCHours(23, 59, 59, 999) // End of yesterday
    } else {
      // Default to **previous full week (Monday → Sunday)**
      const dayOfWeek = now.getUTCDay() // 0 (Sunday) to 6 (Saturday)

      // Compute last week's Monday
      fromDate = new Date(now)
      fromDate.setUTCDate(now.getUTCDate() - dayOfWeek - 6) // Previous Monday
      fromDate.setUTCHours(0, 0, 0, 0)

      // Compute last week's Sunday
      toDate = new Date(fromDate)
      toDate.setUTCDate(fromDate.getUTCDate() + 6) // Following Sunday
      toDate.setUTCHours(23, 59, 59, 999)
    }
  } else {
    // Use provided dates
    fromDate = new Date(from)
    fromDate.setUTCHours(0, 0, 0, 0) // Normalize to start of day UTC
    toDate = new Date(to)
    toDate.setUTCHours(23, 59, 59, 999) // Normalize to end of day UTC
  }

  // Convert to timestamps
  const fromTimestamp = fromDate.getTime()
  const toTimestamp = toDate.getTime()

  // Convert to YYYY-MM-DD for PostgreSQL query
  const fromDateUTC = fromDate.toISOString().split('T')[0]
  const toDateUTC = toDate.toISOString().split('T')[0]

  // Ensure `fromDateUTC` is before or equal to `toDateUTC`
  if (fromDateUTC > toDateUTC) {
    throw new Error("Invalid date range: 'from' must be before 'to'")
  }

  // Generate a list of days in the range with both `fromDate` (00:00) and `toDate` (23:59)
  const days: Period[] = []

  const currentFromDate = new Date(fromDate)
  while (currentFromDate <= toDate) {
    const currentToDate = new Date(currentFromDate)
    currentToDate.setUTCHours(23, 59, 59, 999) // End of that day

    days.push({
      fromDate: new Date(currentFromDate),
      fromTimestamp: currentFromDate.getTime(),
      fromGraphTimestamp: Math.ceil(currentFromDate.getTime() / 1000),
      fromDateUTC: currentFromDate.toISOString().split('T')[0],
      toDate: new Date(currentToDate),
      toTimestamp: currentToDate.getTime(),
      toGraphTimestamp: Math.floor(currentToDate.getTime() / 1000),
      toDateUTC: currentToDate.toISOString().split('T')[0]
    })

    // Move to the next day (00:00 UTC)
    currentFromDate.setUTCDate(currentFromDate.getUTCDate() + 1)
    currentFromDate.setUTCHours(0, 0, 0, 0)
  }

  return {
    fromDate,
    fromTimestamp,
    fromGraphTimestamp: Math.ceil(fromTimestamp / 1000),
    fromDateUTC,
    toDate,
    toTimestamp,
    toGraphTimestamp: Math.floor(toTimestamp / 1000),
    toDateUTC,
    days // Array of each day's full range (00:00 → 23:59 UTC)
  }
}

export const A = 15n
export const B = 25_000n
export const BASE_PRICE = 10_000_000n

export function computeTradeCost(
  totalSupply: bigint,
  amount: bigint,
  isBuy: boolean
) {
  const fromSupply = isBuy ? totalSupply : totalSupply - amount

  if (amount === 0n) {
    throw new Error('InvalidAmount')
  }

  const toSupply = fromSupply + amount - 1n
  let sumSquares
  let sumFirstN

  if (fromSupply === 0n) {
    sumSquares = (toSupply * (toSupply + 1n) * (2n * toSupply + 1n)) / 6n
    sumFirstN = (toSupply * (toSupply + 1n)) / 2n
  } else {
    const sumSquaresTo =
      (toSupply * (toSupply + 1n) * (2n * toSupply + 1n)) / 6n
    const sumSquaresFrom =
      ((fromSupply - 1n) * fromSupply * (2n * fromSupply - 1n)) / 6n
    sumSquares = sumSquaresTo - sumSquaresFrom

    const sumFirstNTo = (toSupply * (toSupply + 1n)) / 2n
    const sumFirstNFrom = ((fromSupply - 1n) * fromSupply) / 2n
    sumFirstN = sumFirstNTo - sumFirstNFrom
  }

  return BASE_PRICE * amount + A * sumSquares + B * sumFirstN
}
