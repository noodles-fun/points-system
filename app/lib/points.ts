import { BigNumber } from 'bignumber.js'
import { formatEther, keccak256 } from 'ethers'
import MerkleTree from 'merkletreejs'
import Web3 from 'web3'
import {
  ActivityForDay,
  getActivityForDay,
  getBlockInfos
} from '../queries/graph'
import {
  ClaimablePoints,
  storeClaimablePointsAndUsers,
  UserClaimablePoints
} from '../queries/sql'
import { computeTradeCost, getPeriod } from './utils'

const web3 = new Web3()

class Points {
  private readonly basePoints = BigNumber(100_000)
  private readonly pointsPerProtocolFeeETH = BigNumber(50_000)
  private readonly decimals = 18

  private readonly protocolFeesPointsShare = BigNumber(0.75)
  private readonly holdingsPointsShare = BigNumber(0.15)
  private readonly referralsPointsShare = BigNumber(0.04)
  private readonly dailyActiveUsersPointsShare = BigNumber(0.06)

  private activityForDay: ActivityForDay

  private addFromProtocolFees
  private addFromHoldings
  private addFromReferrals
  private addFromDailyActiveUsers

  private userPoints: Map<string, BigNumber>
  private claimablePoints: ClaimablePoints
  private userClaimablePoints: UserClaimablePoints[]

  constructor(
    activityForDay: ActivityForDay,
    day: Date,
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

    const totalProtocolFees = BigInt(
      this.activityForDay.usersDayActivities?.protocolFees || '0'
    )

    this.userPoints = new Map()
    this.claimablePoints = {
      merkleRoot: null,
      day: day,
      decimals: this.decimals,
      totalPoints: this.basePoints.plus(
        this.pointsPerProtocolFeeETH.times(formatEther(totalProtocolFees))
      ),
      effectivePoints: BigNumber(0)
    }

    this.userClaimablePoints = []

    this._addFromDailyActivity()
    this._addFromHoldings()
    this._addFromProtocolFees()
    this._addFromReferralFees()

    this._generateMerkleData()
  }

  public getResults() {
    return {
      claimablePoints: this.claimablePoints,
      userClaimablePoints: this.userClaimablePoints
    }
  }

  private _addFromDailyActivity() {
    if (this.addFromDailyActiveUsers) {
      const { userDayActivities, usersDayActivities } = this.activityForDay

      if (usersDayActivities) {
        const nbActiveUsers = BigNumber(usersDayActivities.nbActiveUsers)

        if (nbActiveUsers.isGreaterThan(0)) {
          const nbPointsForActiveUsers = this.claimablePoints.totalPoints.times(
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
              this._addPoints(userAddress, nbPointsPerActiveUser)
            }
          }
        }
      }
    }
  }

  private _addFromHoldings() {
    if (this.addFromHoldings) {
      const { visibilityBalances, protocol } = this.activityForDay

      const totalHoldingsETH = BigNumber(protocol.totalValueLocked)

      const nbPointsForHoldings = this.claimablePoints.totalPoints.times(
        this.holdingsPointsShare
      )

      for (const visibilityBalance of visibilityBalances) {
        const {
          balance,
          user: { id: userAddress },
          visibility: { totalSupply }
        } = visibilityBalance

        const balanceBigInt = BigInt(balance)

        if (balanceBigInt > 0) {
          const totalHoldingsWei = computeTradeCost(
            BigInt(totalSupply),
            BigInt(totalSupply),
            false
          )
          const balanceShare = BigNumber(balance).div(totalSupply)

          const userHoldingsETH = BigNumber(
            formatEther(totalHoldingsWei)
          ).times(balanceShare)

          const userHoldingsETHPercentage =
            userHoldingsETH.div(totalHoldingsETH)

          const nbPointsToAdd = nbPointsForHoldings.times(
            userHoldingsETHPercentage
          )
          this._addPoints(userAddress, nbPointsToAdd)
        }
      }
    }
  }
  private _addFromProtocolFees() {
    if (this.addFromProtocolFees) {
      const { userDayActivities, usersDayActivities } = this.activityForDay

      if (usersDayActivities) {
        const totalProtocolFees = BigNumber(usersDayActivities.protocolFees)

        if (totalProtocolFees.isGreaterThan(0)) {
          const nbPointsForProtocolFees =
            this.claimablePoints.totalPoints.times(this.protocolFeesPointsShare)

          for (const userActivity of userDayActivities) {
            const {
              user: { id: userAddress },
              protocolFees: userProtocolFees
            } = userActivity

            const userProtocolFeesPercentage =
              BigNumber(userProtocolFees).div(totalProtocolFees)

            const nbPointsToAdd = nbPointsForProtocolFees.times(
              userProtocolFeesPercentage
            )
            this._addPoints(userAddress, nbPointsToAdd)
          }
        }
      }
    }
  }

  private _addFromReferralFees() {
    if (this.addFromReferrals) {
      const { userDayActivities, usersDayActivities } = this.activityForDay

      if (usersDayActivities) {
        const totalReferrerFees = BigNumber(usersDayActivities.referrerFees)

        if (totalReferrerFees.isGreaterThan(0)) {
          const nbPointsForReferrerFees =
            this.claimablePoints.totalPoints.times(this.referralsPointsShare)

          for (const userActivity of userDayActivities) {
            const {
              user: { id: userAddress },
              referrerFees: userReferrerFees
            } = userActivity

            const userReferrerFeesPercentage =
              BigNumber(userReferrerFees).div(totalReferrerFees)

            const nbPointsToAdd = nbPointsForReferrerFees.times(
              userReferrerFeesPercentage
            )
            this._addPoints(userAddress, nbPointsToAdd)
          }
        }
      }
    }
  }

  private _addPoints(userAddress: string, nbPointsToAdd: BigNumber) {
    if (nbPointsToAdd.isGreaterThan(0)) {
      this.userPoints.set(
        userAddress,
        (this.userPoints.get(userAddress) || BigNumber(0)).plus(nbPointsToAdd)
      )
    }
  }

  private _generateMerkleData() {
    const leafNodes = [...this.userPoints.entries()].map(
      ([userAddress, points]) => {
        return keccak256(
          Buffer.concat([
            Buffer.from(userAddress.toLowerCase().replace('0x', ''), 'hex'),
            Buffer.from(
              web3.eth.abi
                .encodeParameter(
                  'uint256',
                  points
                    .times(10 ** this.decimals)
                    .toFixed(0, BigNumber.ROUND_DOWN)
                )
                .replace('0x', ''),
              'hex'
            )
          ])
        )
      }
    )

    const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true })

    this.claimablePoints.merkleRoot = merkleTree.getHexRoot()

    this.userClaimablePoints = [...this.userPoints.entries()].map(
      ([userAddress, _points], index) => {
        const points = _points.decimalPlaces(
          this.decimals,
          BigNumber.ROUND_DOWN
        )
        this.claimablePoints.effectivePoints =
          this.claimablePoints.effectivePoints.plus(points)
        const merkleProof = merkleTree.getHexProof(leafNodes[index])

        return {
          userAddress: userAddress.toLowerCase(),
          points,
          merkleProof
        }
      }
    )

    const eRounded = this.claimablePoints.effectivePoints.decimalPlaces(
      0,
      BigNumber.ROUND_UP
    )
    const tRounded = this.claimablePoints.totalPoints.decimalPlaces(
      0,
      BigNumber.ROUND_UP
    )

    console.log({ pointsResults: this.claimablePoints, eRounded, tRounded })

    if (eRounded.isGreaterThan(tRounded)) {
      throw new Error('Effective points are greater than total')
    }
  }
}

export async function computePoints(from?: string, to?: string) {
  const { days } = getPeriod(from, to, 'past-day')

  let fromBlockNumber: number | undefined
  let toBlockNumber: number | undefined

  for (const {
    fromDate,
    fromTimestamp,
    fromGraphTimestamp,
    toGraphTimestamp
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

    const points = new Points(activityForDay, fromDate, {
      addFromProtocolFees: true,
      addFromHoldings: true,
      addFromReferrals: true,
      addFromDailyActiveUsers: true
    })

    const { claimablePoints, userClaimablePoints } = points.getResults()

    await storeClaimablePointsAndUsers(claimablePoints, userClaimablePoints)
  }
}

export function verifyMerkleProof(
  userAddress: string,
  points: string, // Should be passed as a string to avoid JS floating point issues
  decimals: number,
  merkleRoot: string,
  merkleProof: string[]
): boolean {
  const normalizedAddress = userAddress.toLowerCase()

  const formattedPoints = new BigNumber(points)
    .times(new BigNumber(10).pow(decimals)) // Convert to `uint256` scale
    .decimalPlaces(0, BigNumber.ROUND_DOWN) // Ensure integer value
    .toFixed(0) // Convert to string

  // Encode points as `uint256` using Web3 ABI
  const encodedPoints = web3.eth.abi
    .encodeParameter('uint256', formattedPoints)
    .replace('0x', '')

  const leaf = keccak256(
    Buffer.concat([
      Buffer.from(normalizedAddress.replace('0x', ''), 'hex'),
      Buffer.from(encodedPoints, 'hex')
    ])
  )

  const proofBuffers = merkleProof.map((proof) =>
    Buffer.from(proof.replace(/^0x/, ''), 'hex')
  )
  const rootBuffer = Buffer.from(merkleRoot.replace(/^0x/, ''), 'hex')

  return MerkleTree.verify(proofBuffers, leaf, rootBuffer, keccak256, {
    sortPairs: true
  })
}
