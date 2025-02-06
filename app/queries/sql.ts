'use server'
import { neon } from '@neondatabase/serverless'
import { checkValidAddress, getPeriod } from '../utils'

export async function getPointsData(
  address: string,
  from?: string,
  to?: string
) {
  checkValidAddress(address)
  const { fromDateUTC, toDateUTC } = getPeriod(from, to, 'past-week')

  const sql = neon(process.env.DATABASE_URL as string)
  const data = await sql`SELECT * FROM daily_points 
              WHERE user_address = ${address} 
              AND day BETWEEN ${fromDateUTC} AND ${toDateUTC}`

  return data
}
