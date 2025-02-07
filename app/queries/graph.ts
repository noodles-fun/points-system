import {
  BlockInfosQuery,
  BlockInfosDocument,
  execute,
  ActivityForDayDocument,
  ActivityForDayQuery,
  Protocol,
  Maybe,
  VisibilityBalance,
  User,
  UsersDayActivity,
  UserDayActivity,
  Visibility
} from '../../.graphclient'

export type ActivityForDay = {
  protocol: Pick<Protocol, 'id' | 'totalValueLocked'>
  visibilityBalances: Array<
    Pick<VisibilityBalance, 'balance' | 'cursorId'> & {
      user: Pick<User, 'id'>
    } & {
      visibility: Pick<Visibility, 'totalSupply'>
    }
  >
  usersDayActivities:
    | Maybe<
        Pick<
          UsersDayActivity,
          'nbActiveUsers' | 'protocolFees' | 'referrerFees'
        >
      >
    | undefined
  userDayActivities: Array<
    Pick<
      UserDayActivity,
      'isActiveUser' | 'protocolFees' | 'referrerFees' | 'cursorId'
    > & {
      user: Pick<User, 'id'>
    }
  >
}

export type BlockInfos = {
  currentGraphTimestamp: Maybe<number> | undefined
  firstTradeBlockNumber: number | undefined
  lastTradeBlockNumber: number | undefined
}

export const getActivityForDay = async (
  blockNumberSnapshot: number,
  dayTimestamp: number
) => {
  let visibilityBalancesCursorId = '0'
  let userDayActivitiesCursorId = '0'

  let needToFetchMoreUserDayActivities = true
  let needToFetchMoreVisibilityBalances = true

  const result: ActivityForDay = {
    protocol: { id: '', totalValueLocked: '' },
    visibilityBalances: [],
    usersDayActivities: null,
    userDayActivities: []
  }

  while (
    needToFetchMoreUserDayActivities ||
    needToFetchMoreVisibilityBalances
  ) {
    const { data } = await execute(ActivityForDayDocument, {
      blockNumberSnapshot,
      dayTimestamp: dayTimestamp.toString(),
      visibilityBalancesCursorId,
      userDayActivitiesCursorId
    })

    if (!data) {
      throw new Error('No data returned from the ActivityForDay query')
    }

    const {
      protocol,
      visibilityBalances,
      userDayActivities,
      usersDayActivities
    } = data as ActivityForDayQuery

    if (!protocol) {
      throw new Error('No protocol data returned')
    }

    result.protocol = protocol

    if (needToFetchMoreVisibilityBalances)
      result.visibilityBalances =
        result.visibilityBalances.concat(visibilityBalances)

    result.usersDayActivities = usersDayActivities[0]

    if (needToFetchMoreUserDayActivities)
      result.userDayActivities =
        result.userDayActivities.concat(userDayActivities)

    if (visibilityBalances.length)
      visibilityBalancesCursorId = visibilityBalances.slice(-1)[0]?.cursorId
    if (userDayActivities.length)
      userDayActivitiesCursorId = userDayActivities.slice(-1)[0]?.cursorId

    needToFetchMoreUserDayActivities =
      userDayActivities && userDayActivities.length === 6000
    needToFetchMoreVisibilityBalances =
      visibilityBalances && visibilityBalances.length === 6000
  }

  return result
}

export const getBlockInfos = async (
  from: number,
  to: number
): Promise<BlockInfos> => {
  const result = await execute(BlockInfosDocument, {
    fromGraphTimestamp: from.toString(),
    toGraphTimestamp: to.toString()
  })

  const { _meta, firstTrade, lastTrade } = result.data as BlockInfosQuery

  return {
    currentGraphTimestamp: _meta?.block.timestamp,
    firstTradeBlockNumber: firstTrade?.length
      ? parseInt(firstTrade[0].blockNumber)
      : undefined,
    lastTradeBlockNumber: lastTrade?.length
      ? parseInt(lastTrade[0].blockNumber)
      : undefined
  }
}
