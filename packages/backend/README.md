# sTFuel Backend - Theta Blockchain Event Tracker

A Node.js/TypeScript backend service that tracks events from Theta Blockchain contracts and provides a GraphQL API for querying the data.

## Features

- **Blockchain Event Tracking**: Scans every block on Theta Blockchain for contract events
- **Contract Support**: Tracks events from NodeManager and sTFuel contracts
- **Hourly Snapshots**: Creates hourly snapshots of key metrics
- **GraphQL API**: Provides a comprehensive GraphQL API for querying data
- **PostgreSQL Storage**: Stores all events and snapshots in PostgreSQL
- **Resilient Scanning**: Handles restarts and continues from last scanned block

## Contract Events Tracked

### NodeManager Contract
- NodeRegistered, NodeDeactivated
- TFuelDeposited, WithdrawalEnqueued, WithdrawalPaid
- KeeperPaid, TFuelStaked, TFuelUnstaked
- ParamsUpdated, StakingPauseChanged, MaxNodesPerStakingCallUpdated
- TNT20Withdrawn, CreditAssigned, CreditWithdrawn
- DirectRedeemPaid, NodeMarkedAsFaulty, FaultyNodeRecovered
- KeeperTipSurplus

### sTFuel Contract
- Minted, BurnQueued, Claimed
- MintFeeUpdated, ReferralAddressSet, ReferralRewarded
- DirectRedeemFeeUpdated, BurnAndDirectRedeemed
- Transfer

## Hourly Snapshots

The service creates hourly snapshots containing:
- TFuel Amount (backing sTFuel)
- Amount of TFuel staked
- sTFuel totalSupply
- Number of Holders (current and historical)
- Total Referrals Rewards paid
- Number of EdgeNodes staked

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Theta RPC access

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp env.example .env
```

3. Configure your `.env` file:
```env
# Blockchain Configuration
THETA_RPC_URL=https://eth-rpc-api.thetatoken.org/rpc
NODE_MANAGER_ADDRESS=0x...
STFUEL_ADDRESS=0x...
START_BLOCK=0

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/stfuel_tracker

# Server Configuration
PORT=4000
NODE_ENV=development
```

4. Run database migrations:
```bash
npm run migration:run
```

### Development

Start the development server:
```bash
npm run dev
```

### Production

Build and start:
```bash
npm run build
npm start
```

## GraphQL API

The service exposes a GraphQL API at `http://localhost:4000` with the following queries:

### Events
- `nodeManagerEvents`: Query NodeManager contract events
- `stfuelEvents`: Query sTFuel contract events

### Snapshots
- `hourlySnapshots`: Query hourly snapshots
- `latestSnapshot`: Get the latest snapshot

### Status
- `syncStatus`: Get current sync status

### Example Queries

```graphql
# Get latest NodeManager events
query {
  nodeManagerEvents(first: 10) {
    edges {
      node {
        eventName
        blockNumber
        timestamp
        args
      }
    }
  }
}

# Get hourly snapshots for the last 24 hours
query {
  hourlySnapshots(
    first: 24
    fromDate: "2024-01-01T00:00:00Z"
    toDate: "2024-01-02T00:00:00Z"
  ) {
    edges {
      node {
        snapshotTimestamp
        stfuelTotalSupply
        currentHoldersCount
        edgeNodesCount
      }
    }
  }
}

# Get latest snapshot
query {
  latestSnapshot {
    snapshotTimestamp
    tfuelBackingAmount
    stfuelTotalSupply
    currentHoldersCount
    historicalHoldersCount
    totalReferralRewards
    edgeNodesCount
  }
}
```

## Database Schema

### Tables
- `sync_state`: Tracks last scanned block
- `node_manager_events`: All NodeManager contract events
- `stfuel_events`: All sTFuel contract events
- `hourly_snapshots`: Hourly aggregated metrics

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Theta RPC     │───▶│   Block Scanner  │───▶│   PostgreSQL    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Snapshot Service│
                       └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │  GraphQL Server  │◀───│   Client Apps   │
                       └──────────────────┘    └─────────────────┘
```

## Monitoring

The service includes comprehensive logging and error handling:
- Winston logger with structured logging
- Graceful shutdown handling
- Database connection monitoring
- Block scanning progress tracking

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT
