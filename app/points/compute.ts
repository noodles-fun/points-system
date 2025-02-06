import { BigNumber } from 'bignumber.js'

import {
  ActivityForDay,
  getActivityForDay,
  getBlockInfos
} from '../queries/graph'
import { getPeriod } from '../utils'

class Points {
  private basePoints = BigNumber(100_000)
  private pointsPerProtocolFeeETH = BigNumber(50_000)

  private protocolFeesPointsShare = BigNumber(0.75)
  private holdingsPointsShare = BigNumber(0.15)
  private referralsPointsShare = BigNumber(0.04)
  private dailyActiveUsersPointsShare = BigNumber(0.06)

  private activityForDay: ActivityForDay
  private totalPointsToReward: BigNumber
  private points: Record<string, BigNumber>

  private addFromProtocolFees = false
  private addFromHoldings = false
  private addFromReferrals = false
  private addFromDailyActiveUsers = false

  constructor(
    activityForDay: ActivityForDay,
    {
      addFromProtocolFees = true,
      addFromHoldings = true,
      addFromReferrals = true,
      addFromDailyActiveUsers = true
    }
  ) {
    this.activityForDay = activityForDay
    this.addFromProtocolFees = addFromProtocolFees
    this.addFromHoldings = addFromHoldings
    this.addFromReferrals = addFromReferrals
    this.addFromDailyActiveUsers = addFromDailyActiveUsers

    this.points = {}
    this.totalPointsToReward = this.basePoints.plus(
      this.pointsPerProtocolFeeETH.times(
        BigNumber(activityForDay.protocol.totalValueLocked)
      )
    )
    this._addFromDailyActivity()
    this._addFromHoldings()
    this._addFromProtocolFees()
    this._addFromReferralFees()
  }

  public get() {
    return this.points
  }

  private async _addFromDailyActivity() {
    if (this.addFromDailyActiveUsers) {
      const { userDayActivities, usersDayActivities } = this.activityForDay

      if (usersDayActivities) {
        const nbActiveUsers = BigNumber(usersDayActivities.nbActiveUsers)

        if (nbActiveUsers.isGreaterThan(0)) {
          const nbPointsForActiveUsers = this.totalPointsToReward.times(
            this.dailyActiveUsersPointsShare
          )
          const nbPointsPerActiveUser =
            nbPointsForActiveUsers.div(nbActiveUsers)

          for (const userActivity of userDayActivities) {
            const {
              user: { id: userAddress },
              isActiveUser
            } = userActivity

            if (isActiveUser) {
              this._addPoint(userAddress, nbPointsPerActiveUser)
            }
          }
        }
      }
    }
  }

  private async _addFromHoldings() {
    if (this.addFromHoldings) {
      // TODO
    }
  }
  private async _addFromProtocolFees() {
    if (this.addFromProtocolFees) {
      // TODO
    }
  }

  private async _addFromReferralFees() {
    if (this.addFromReferrals) {
      // TODO
    }
  }

  private _addPoint(userAddress: string, point: BigNumber) {
    if (!this.points[userAddress]) {
      this.points[userAddress] = point
    } else {
      this.points[userAddress] = this.points[userAddress].plus(point)
    }
  }
}

export async function computePoints(from?: string, to?: string) {
  const { days } = getPeriod(from, to, 'past-day')

  let fromBlockNumber: number | undefined
  let toBlockNumber: number | undefined

  const results = []

  for (const {
    fromTimestamp,
    fromGraphTimestamp,
    toGraphTimestamp,
    fromDateUTC
  } of days) {
    const {
      currentGraphTimestamp,
      firstTradeBlockNumber,
      lastTradeBlockNumber
    } = await getBlockInfos(fromGraphTimestamp, toGraphTimestamp)

    if (!currentGraphTimestamp || currentGraphTimestamp < toGraphTimestamp) {
      throw new Error(
        `Graph data is not up-to-date (current: ${currentGraphTimestamp}, requested: ${toGraphTimestamp})`
      )
    }

    if (firstTradeBlockNumber) {
      fromBlockNumber = firstTradeBlockNumber
    }
    if (!fromBlockNumber) {
      throw new Error('No starting block number found')
    }

    if (lastTradeBlockNumber) {
      toBlockNumber = lastTradeBlockNumber
    }
    if (!toBlockNumber) {
      throw new Error('No ending block number found')
    }

    const activityForDay: ActivityForDay = await getActivityForDay(
      toBlockNumber,
      fromTimestamp
    )

    const points = new Points(activityForDay, {
      addFromProtocolFees: true,
      addFromHoldings: true,
      addFromReferrals: true,
      addFromDailyActiveUsers: true
    })

    // compute merkle root & merkle proofs for each user

    // store user address, day , points, merkle root & merkle proofs in database

    results.push({ fromDateUTC, points })
  }

  return results
}
