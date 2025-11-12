import { gql } from '@apollo/client';

export const GET_HOURLY_SNAPSHOTS = gql`
  query GetHourlySnapshots($first: Int, $after: String, $fromDate: String, $toDate: String) {
    hourlySnapshots(first: $first, after: $after, fromDate: $fromDate, toDate: $toDate) {
      edges {
        node {
          id
          blockNumber
          snapshotTimestamp
          tfuelBackingAmount
          tfuelStakedAmount
          stfuelTotalSupply
          currentHoldersCount
          historicalHoldersCount
          totalReferralRewards
          edgeNodesCount
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_DAILY_SNAPSHOTS = gql`
  query GetDailySnapshots($first: Int, $after: String, $fromDate: String, $toDate: String) {
    dailySnapshots(first: $first, after: $after, fromDate: $fromDate, toDate: $toDate) {
      edges {
        node {
          id
          blockNumber
          snapshotTimestamp
          tfuelBackingAmount
          tfuelStakedAmount
          stfuelTotalSupply
          currentHoldersCount
          historicalHoldersCount
          totalReferralRewards
          edgeNodesCount
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_USER = gql`
  query GetUser($address: String!) {
    user(address: $address) {
      id
      address {
        address
      }
      stfuelBalance
      totalDeposited
      totalWithdrawn
      totalMinted
      totalBurned
      totalKeeperFeesEarned
      totalReferralFeesEarned
      totalEnteringFeesPaid
      totalExitFeesPaid
      creditsAvailable
      firstActivityBlock
      firstActivityTimestamp
      lastActivityBlock
      lastActivityTimestamp
      createdAt
      updatedAt
    }
  }
`;

export const GET_REDEMPTION_QUEUE = gql`
  query GetRedemptionQueue($first: Int, $after: String, $userAddress: String) {
    redemptionQueue(first: $first, after: $after, userAddress: $userAddress) {
      edges {
        node {
          id
          userAddress {
            address
          }
          requestBlock
          requestTimestamp
          stfuelAmountBurned
          tfuelAmountExpected
          keepersTipFee
          unlockBlockNumber
          unlockTimestamp
          queueIndex
          status
          creditedBlock
          creditedTimestamp
          createdAt
          updatedAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_EDGE_NODES = gql`
  query GetEdgeNodes($first: Int, $after: String, $isActive: Boolean, $isFaulty: Boolean, $nodeType: String) {
    edgeNodes(first: $first, after: $after, isActive: $isActive, isFaulty: $isFaulty, nodeType: $nodeType) {
      edges {
        node {
          id
          address {
            address
          }
          registrationBlock
          registrationTimestamp
          isActive
          deactivationBlock
          deactivationTimestamp
          isFaulty
          faultyBlock
          faultyTimestamp
          recoveryBlock
          recoveryTimestamp
          totalStaked
          totalUnstaked
          unstakeBlock
          nodeType
          isLive
          createdAt
          updatedAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_USERS = gql`
  query GetUsers($first: Int, $after: String, $minBalance: String) {
    users(first: $first, after: $after, minBalance: $minBalance) {
      edges {
        node {
          id
          address {
            address
          }
          stfuelBalance
          totalDeposited
          totalWithdrawn
          totalMinted
          totalBurned
          totalKeeperFeesEarned
          totalReferralFeesEarned
          totalEnteringFeesPaid
          totalExitFeesPaid
          creditsAvailable
          firstActivityBlock
          firstActivityTimestamp
          lastActivityBlock
          lastActivityTimestamp
          createdAt
          updatedAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_SYNC_STATUS = gql`
  query GetSyncStatus {
    syncStatus {
      lastBlockNumber
      isScanning
      currentBlockNumber
    }
  }
`;

export const GET_REDEMPTION_QUEUE_FOR_KEEPER = gql`
  query GetRedemptionQueueForKeeper($first: Int, $after: String, $status: String) {
    redemptionQueue(first: $first, after: $after, status: $status) {
      edges {
        node {
          id
          keepersTipFee
          unlockBlockNumber
          creditedBlock
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;
