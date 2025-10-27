# Normalized Tables Implementation

This document describes the implementation of normalized database tables extracted from raw blockchain events.

## Overview

The normalized tables provide structured, queryable data extracted from raw blockchain events. This enables efficient analytics, reporting, and user interfaces without parsing JSONB data.

## Database Schema

### Tables Created

1. **addresses** - Address lookup table
2. **edge_nodes** - Edge node information and lifecycle
3. **users** - User activity and balances
4. **redemption_queue** - Burn queue with FIFO matching

### Entity Files

- `src/database/entities/Address.ts`
- `src/database/entities/EdgeNode.ts`
- `src/database/entities/User.ts`
- `src/database/entities/RedemptionQueue.ts`

### Migration

- `src/database/migrations/1761477515300-CreateNormalizedTables.ts`

## Event Processing

### NormalizedEventProcessor Service

The `NormalizedEventProcessor` service processes raw events and updates normalized tables:

**File**: `src/services/NormalizedEventProcessor.ts`

#### NodeManager Event Handlers

- `processNodeRegistered` - Creates EdgeNode record
- `processNodeDeactivated` - Updates EdgeNode.isActive = false
- `processNodeMarkedAsFaulty` - Updates EdgeNode.isFaulty = true
- `processFaultyNodeRecovered` - Updates EdgeNode.isFaulty = false
- `processTFuelStaked` - Adds to EdgeNode.totalStaked
- `processTFuelUnstaked` - Adds to EdgeNode.totalUnstaked
- `processKeeperPaid` - Adds to EdgeNode.totalKeeperFeesEarned
- `processCreditAssigned` - Matches to pending RedemptionQueue via FIFO
- `processWithdrawalPaid` - Matches to pending RedemptionQueue via FIFO
- `processCreditWithdrawn` - Updates User.creditsAvailable

#### sTFuel Event Handlers

- `processTransfer` - Updates User.stfuelBalance for sender/receiver
- `processMinted` - Updates User.totalMinted, totalEnteringFeesPaid
- `processBurnQueued` - Creates RedemptionQueue entry, updates User.totalBurned
- `processReferralRewarded` - Adds to User.totalReferralFeesEarned
- `processBurnAndDirectRedeemed` - Updates User.totalBurned, totalExitFeesPaid
- `processReferralAddressSet` - Logs referral address changes

### FIFO Matching Logic

The redemption queue uses FIFO (First In, First Out) matching:

1. When `CreditAssigned` or `WithdrawalPaid` events occur
2. Find oldest 'pending' RedemptionQueue entry matching:
   - Same user address
   - Same amount
   - Unlock block has passed
3. Mark as 'credited' and update claim details

## Processing Pipeline

### Real-time Processing

The `BlockScanner` now processes events in two phases:

1. **Raw Event Processing** - Saves events to `node_manager_events` and `stfuel_events`
2. **Normalized Processing** - Updates normalized tables via `NormalizedEventProcessor`

### Backfill Script

**File**: `scripts/backfill-normalized-tables.ts`

Processes all historical events in chronological order:

```bash
npm run backfill
```

Features:
- Processes events in chronological order (blockNumber, transactionIndex, logIndex)
- Batch processing for performance
- Progress tracking
- Error handling and recovery
- Idempotent (can be run multiple times)

## GraphQL API

### New Queries

#### EdgeNodes
```graphql
query {
  edgeNodes(first: 10, isActive: true) {
    edges {
      node {
        id
        address { address }
        isActive
        isFaulty
        totalStaked
        totalKeeperFeesEarned
      }
    }
  }
}

query {
  edgeNode(address: "0x...") {
    address { address }
    isActive
    totalStaked
  }
}
```

#### Users
```graphql
query {
  users(first: 10, minBalance: "1000000000000000000") {
    edges {
      node {
        id
        address { address }
        stfuelBalance
        totalMinted
        totalBurned
        totalReferralFeesEarned
      }
    }
  }
}

query {
  user(address: "0x...") {
    address { address }
    stfuelBalance
    totalMinted
    totalBurned
  }
}
```

#### Redemption Queue
```graphql
query {
  redemptionQueue(first: 10, status: "pending") {
    edges {
      node {
        id
        userAddress { address }
        stfuelAmountBurned
        tfuelAmountExpected
        status
        unlockBlockNumber
      }
    }
  }
}
```

## Setup Instructions

### 1. Run Migration

```bash
npm run migration:run
```

### 2. Test Tables

```bash
npm run test:normalized
```

### 3. Backfill Historical Data

```bash
npm run backfill
```

### 4. Start Backend

```bash
npm run dev
```

## Testing

### Test Script

The test script verifies:
- Entity creation and relationships
- Database constraints
- Query functionality
- Data cleanup

```bash
npm run test:normalized
```

### GraphQL Playground

Access the GraphQL playground at `http://localhost:4000` to test queries.

## Performance Benefits

1. **Faster Queries** - Direct table queries instead of JSONB parsing
2. **Better Indexing** - Optimized indexes on frequently queried fields
3. **Efficient Aggregations** - Built-in totals and balances
4. **Relationship Queries** - Proper joins between related data
5. **Pagination** - Cursor-based pagination for large datasets

## Data Integrity

- **Foreign Key Constraints** - Ensures referential integrity
- **Unique Constraints** - Prevents duplicate addresses
- **Event Ordering** - Processes events in chronological order
- **FIFO Matching** - Ensures correct redemption queue processing
- **Error Handling** - Continues processing even if individual events fail

## Monitoring

The implementation includes comprehensive logging:
- Event processing progress
- Error tracking
- Performance metrics
- Backfill statistics

## Future Enhancements

1. **Node Type Detection** - Automatically detect edge node types
2. **Live Status API** - Endpoint to update edge node live status
3. **Advanced Analytics** - Additional computed fields and aggregations
4. **Real-time Updates** - WebSocket subscriptions for live data
5. **Data Validation** - Cross-reference with on-chain data
