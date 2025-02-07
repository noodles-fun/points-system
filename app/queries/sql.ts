'use server'
import { neon } from '@neondatabase/serverless'
import BigNumber from 'bignumber.js'
import { checkValidAddress, getPeriod } from '../lib/utils'

const sql = neon(process.env.DATABASE_URL as string)

export type ClaimablePoints = {
  merkleRoot: string | null
  day: Date
  decimals: number
  totalPoints: BigNumber
  effectivePoints: BigNumber
}

export type UserClaimablePoints = {
  userAddress: string
  points: BigNumber
  merkleProof: string[] | null
}

export type ClaimablePointsForUser = {
  userAddress: string
  day: Date
  merkleRoot: string
  decimals: number
  points: BigNumber
  merkleProof: string[]
}

export async function getClaimablePointsForUser(
  address: string,
  from?: string,
  to?: string
): Promise<ClaimablePointsForUser[]> {
  checkValidAddress(address)
  const { fromDateUTC, toDateUTC } = getPeriod(from, to, 'past-week')

  try {
    const result = await sql`
      SELECT 
        ucp.user_address,
        cp.day,
        cp.merkle_root,
        cp.decimals,
        ucp.points,
        ucp.merkle_proof
      FROM user_claimable_points ucp
      JOIN claimable_points cp ON ucp.claimable_points_id = cp.id
      WHERE ucp.user_address = ${address.toLowerCase().trim()}
      AND cp.day BETWEEN ${fromDateUTC} AND ${toDateUTC}
      ORDER BY cp.day DESC;
    `

    return result.map((row) => {
      return {
        userAddress: row.user_address,
        day: new Date(row.day), // Ensure it's returned as a Date object
        merkleRoot: row.merkle_root,
        decimals: row.decimals,
        points: new BigNumber(row.points),
        merkleProof: row.merkle_proof
      }
    })
  } catch (error) {
    console.error('Error fetching claimable points for user:', error)
    throw new Error('Failed to retrieve claimable points.')
  }
}

/**
 * Inserts claimable points into the database safely.
 */
export async function insertClaimablePoints(
  data: ClaimablePoints
): Promise<number | null> {
  if (!data?.merkleRoot) {
    console.error('Invalid claimable points data')
    return null
  }

  try {
    const result = await sql`
      INSERT INTO claimable_points (merkle_root, day, decimals, total_points, effective_points)
      VALUES (
        ${data.merkleRoot},
        ${data.day.toISOString()}::TIMESTAMP WITH TIME ZONE,  
        ${data.decimals},
        ${data.totalPoints.toFixed(data.decimals)},
        ${data.effectivePoints.toFixed(data.decimals)}
      )
      ON CONFLICT (day) DO UPDATE 
      SET merkle_root = EXCLUDED.merkle_root,
          total_points = EXCLUDED.total_points,
          effective_points = EXCLUDED.effective_points
      RETURNING id;
    `
    return result.length > 0 ? result[0].id : null
  } catch (error) {
    console.error('Error inserting claimable points:', error)
    return null
  }
}

/**
 * Inserts user claimable points in batch chunks to handle large data efficiently.
 */
export async function insertUserClaimablePoints(
  claimablePointsId: number,
  userData: UserClaimablePoints[],
  pointsDecimals: number
) {
  if (!claimablePointsId || userData.length === 0) return

  try {
    const CHUNK_SIZE = 1000 // Set batch size to 1000 rows per insert

    for (let i = 0; i < userData.length; i += CHUNK_SIZE) {
      const chunk = userData.slice(i, i + CHUNK_SIZE)

      const values = chunk.map((user) => [
        claimablePointsId,
        user.userAddress.trim().toLowerCase(), // Normalize address case
        user.points.toFixed(pointsDecimals, BigNumber.ROUND_DOWN),
        user.merkleProof
          ? `{${user.merkleProof.map((p) => `"${p}"`).join(',')}}`
          : null
      ])

      // Create parameterized placeholders dynamically
      const placeholders = values
        .map(
          (_, rowIndex) =>
            `($${rowIndex * 4 + 1}, $${rowIndex * 4 + 2}, $${
              rowIndex * 4 + 3
            }, $${rowIndex * 4 + 4})`
        )
        .join(',')

      // Flatten values into a single array for parameterized query
      const flattenedValues = values.flat()

      await sql(
        `INSERT INTO user_claimable_points (claimable_points_id, user_address, points, merkle_proof)
         VALUES ${placeholders}
         ON CONFLICT (claimable_points_id, user_address) DO UPDATE 
         SET points = EXCLUDED.points,
             merkle_proof = EXCLUDED.merkle_proof;`,
        flattenedValues
      )
    }
  } catch (error) {
    console.error('Error inserting user claimable points:', error)
  }
}

/**
 * Safely stores claimable points and user claimable points.
 * Ensures database integrity even with large datasets.
 */
export async function storeClaimablePointsAndUsers(
  claimablePoints: ClaimablePoints,
  users: UserClaimablePoints[]
) {
  try {
    const claimablePointsId = await insertClaimablePoints(claimablePoints)
    if (!claimablePointsId) {
      throw new Error('Failed to insert claimable points')
    }

    await insertUserClaimablePoints(
      claimablePointsId,
      users,
      claimablePoints.decimals
    )
  } catch (error) {
    console.error('Error storing claimable points and users:', error)
  }
}
