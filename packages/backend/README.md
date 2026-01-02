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

## Docker

### Building the Docker Image

Build the Docker image:
```bash
docker build -t stfuel-backend:latest -f packages/backend/Dockerfile packages/backend/
```

### Running the Container

**Option A: Using Host Network Mode (Linux - Recommended for local PostgreSQL)**

When running on Linux with PostgreSQL on the host machine, use `--network host` to allow the container to access the host's network directly:

```bash
docker run -d \
  --name stfuel-backend \
  --network host \
  --env-file packages/backend/.env \
  --restart unless-stopped \
  stfuel-backend:latest
```

**Option B: Using Bridge Network with Port Mapping**

For Docker Desktop (Mac/Windows) or when using a remote database:

```bash
docker run -d \
  --name stfuel-backend \
  -p 4000:4000 \
  -e DATABASE_URL="postgresql://username:password@host:5432/stfuel_tracker" \
  -e THETA_RPC_URLS="https://eth-rpc-api.thetatoken.org/rpc,https://eth-rpc-api-testnet.thetatoken.org/rpc" \
  -e NODE_MANAGER_ADDRESS="0x..." \
  -e STFUEL_ADDRESS="0x..." \
  -e PORT="4000" \
  -e NODE_ENV="production" \
  -e LOG_LEVEL="info" \
  -e START_BLOCK="0" \
  --restart unless-stopped \
  stfuel-backend:latest
```

**Note:** With `--network host`, the `-p 4000:4000` flag is not needed as the container uses the host's network directly. Your `.env` file can use `localhost` in the `DATABASE_URL` when using host network mode.

### Environment Variables

All environment variables from `env.example` must be provided when running the container:

**Required:**
- `DATABASE_URL` - PostgreSQL connection string (external database)
- `THETA_RPC_URLS` - Comma-separated RPC endpoints
- `NODE_MANAGER_ADDRESS` - NodeManager contract address
- `STFUEL_ADDRESS` - sTFuel contract address

**Optional (with defaults):**
- `PORT` - Server port (default: 4000)
- `NODE_ENV` - Environment mode (default: development)
- `LOG_LEVEL` - Logging level (default: info)
- `START_BLOCK` - Starting block number (default: 0)
- `RPC_RETRY_ATTEMPTS` - RPC retry attempts (default: 3)
- `RPC_RETRY_DELAY` - RPC retry delay in ms (default: 5000)
- `RPC_TIMEOUT` - RPC timeout in ms (default: 30000)
- `BATCH_SIZE` - Block batch size (default: 10)
- `MAX_CONCURRENT_BATCHES` - Max concurrent batches (default: 3)
- `BATCH_DELAY` - Batch delay in ms (default: 100)

### Using Environment File

There are two ways to provide environment variables:

**Option 1: Include .env in Docker image (for convenience)**
- Ensure `.env` file exists in the build context (not excluded in `.dockerignore`)
- The `.env` file will be copied into the image during build
- Runtime environment variables (via `-e` or `--env-file`) will override values from the image's `.env` file

```bash
# Build with .env file included
docker build -t stfuel-backend:latest -f packages/backend/Dockerfile packages/backend/

# Run (can still override with -e flags)
docker run -d \
  --name stfuel-backend \
  -p 4000:4000 \
  stfuel-backend:latest
```

**Option 2: Use --env-file at runtime (recommended for production)**
- Exclude `.env` from build (it's excluded by default in `.dockerignore`)
- Pass environment variables at container startup
- More secure as secrets aren't baked into the image

```bash
# Build without .env (default)
docker build -t stfuel-backend:latest -f packages/backend/Dockerfile packages/backend/

# Run with environment file (Linux with host network)
docker run -d \
  --name stfuel-backend \
  --network host \
  --env-file packages/backend/.env \
  --restart unless-stopped \
  stfuel-backend:latest

# Run with environment file (Docker Desktop or bridge network)
docker run -d \
  --name stfuel-backend \
  -p 4000:4000 \
  --env-file packages/backend/.env \
  --restart unless-stopped \
  stfuel-backend:latest

# Or use individual -e flags
docker run -d \
  --name stfuel-backend \
  -p 4000:4000 \
  -e DATABASE_URL="postgresql://..." \
  -e THETA_RPC_URLS="https://..." \
  --restart unless-stopped \
  stfuel-backend:latest
```

**Note:** Runtime environment variables (via `-e` or `--env-file`) always take precedence over any `.env` file in the image.

### Health Checks

The container includes a built-in health check that monitors the GraphQL endpoint. The health check:
- Runs every 30 seconds
- Has a 10 second timeout
- Allows 40 seconds for initial startup
- Retries 3 times before marking as unhealthy

Check container health status:
```bash
docker ps  # Shows health status
docker inspect --format='{{.State.Health.Status}}' stfuel-backend
```

### Database Migrations

Database migrations run automatically on container startup (see `src/index.ts`). Ensure your PostgreSQL database is:
- Accessible from the container network
- Pre-configured with the correct connection string
- Has appropriate permissions for the database user

**Database Connection Notes:**
- When using `--network host` (Linux): Use `localhost` in your `DATABASE_URL` (e.g., `postgresql://user:pass@localhost:5432/stfuel_tracker`)
- When using bridge network: Use the host's IP address or `host.docker.internal` in your `DATABASE_URL`
- Ensure PostgreSQL is configured to accept connections (check `postgresql.conf` and `pg_hba.conf`)

### Logs

View container logs:
```bash
docker logs stfuel-backend
docker logs -f stfuel-backend  # Follow logs
```

### Stopping the Container

The container handles graceful shutdown on SIGTERM/SIGINT signals:
```bash
docker stop stfuel-backend  # Sends SIGTERM
docker rm stfuel-backend     # Remove container
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
