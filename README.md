# sTFuel Web Application

## About sTFuel

**Smart TFuel (sTFuel)** is a liquid staking solution for TFuel on the Theta blockchain. It allows users to stake their TFuel and receive sTFuel tokens in return, maintaining liquidity while earning staking rewards.

### Key Features

- **Liquid Staking**: Stake TFuel and receive sTFuel tokens that represent your staked position
- **Automatic Rewards**: Your sTFuel balance increases in value as the Price Per Share (PPS) grows from accumulated fees and staking rewards
- **Flexible Redemption**: Redeem your TFuel through a withdrawal queue or direct redemption (with higher fee for immediate liquidity)
- **Initial Exchange Rate**: 1 TFuel = 10 sTFuel (PPS = 0.1 TFuel/share)
- **Fee Structure**: Mint fee (0.1-1%) and direct redeem fee (0.1-5%) that benefit all holders
- **Referral System**: Oties NFT holders can earn referral rewards when users mint sTFuel with their referral ID

### Documentation

- **[White Paper](https://www.notion.so/opentheta/Smart-TFuel-sTFuel-White-Paper-2961c383346f8072adbbfb8fba344c70?source=copy_link)**: Comprehensive technical documentation
- **[Light Paper](https://www.notion.so/opentheta/Smart-TFuel-sTFuel-Lightpaper-29b1c383346f806eba22d4da911391cd?source=copy_link)**: Executive summary and overview

## Project Structure

This is a monorepo containing three main packages:

### 1. Frontend (`packages/frontend`)

A Next.js web application that provides the user interface for interacting with sTFuel. Users can mint, burn, and manage their sTFuel tokens through a modern web interface.

**Features:**
- Wallet connection via Reown (WalletConnect) or Magic Link
- Mint sTFuel by staking TFuel
- Burn sTFuel to redeem TFuel
- View real-time statistics (Total Supply, TFuel Backing, APR, etc.)
- Transaction confirmation modals
- Referral system support
- Stats and wallet pages

**Tech Stack:**
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Apollo Client (GraphQL)
- Ethers.js v6
- Reown AppKit (WalletConnect)

**How to Use:**

1. Install dependencies:
   ```bash
   cd packages/frontend
   npm install
   ```

2. Configure environment variables (if needed):
   - Create a `.env.local` file if you need to override default GraphQL endpoint
   - Default GraphQL endpoint: `http://localhost:4000`

3. Run development server:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`

4. Build for production:
   ```bash
   npm run build
   npm start
   ```

**From the root directory:**
```bash
# Development
npm run dev:frontend

# Build
npm run build:frontend

# Production
npm start:frontend
```

### 2. Backend (`packages/backend`)

A Node.js/TypeScript backend service that tracks events from Theta Blockchain contracts and provides a GraphQL API for querying blockchain data.

**Features:**
- Blockchain event tracking from NodeManager and sTFuel contracts
- Real-time block scanning with automatic recovery
- Hourly snapshots of key metrics
- GraphQL API for flexible data queries
- PostgreSQL database for persistent storage
- Normalized event processing for efficient queries

**Tech Stack:**
- Node.js
- TypeScript
- Express.js
- Apollo Server (GraphQL)
- TypeORM
- PostgreSQL
- Ethers.js v6
- Winston (logging)

**How to Use:**

1. Install dependencies:
   ```bash
   cd packages/backend
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp env.example .env
   ```
   
   Configure your `.env` file:
   ```env
   # Blockchain Configuration
   THETA_RPC_URLS=https://eth-rpc-api.thetatoken.org/rpc,https://eth-rpc-api-testnet.thetatoken.org/rpc
   NODE_MANAGER_ADDRESS=0x...
   STFUEL_ADDRESS=0x...
   START_BLOCK=0

   # Database Configuration
   DATABASE_URL=postgresql://username:password@localhost:5432/stfuel_tracker

   # Server Configuration
   PORT=4000
   NODE_ENV=development
   ```

3. Set up the database:
   ```bash
   # Run migrations
   npm run migration:run
   ```

4. Run development server:
   ```bash
   npm run dev
   ```
   The GraphQL API will be available at `http://localhost:4000`

5. Build for production:
   ```bash
   npm run build
   npm start
   ```

**Available Scripts:**
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run migration:generate` - Generate a new migration
- `npm run migration:run` - Run pending migrations
- `npm run migration:revert` - Revert last migration
- `npm run db:reset` - Reset database (development)
- `npm run db:force-reset` - Force reset database (development)

**From the root directory:**
```bash
# Development
npm run dev:backend

# Build
npm run build:backend

# Production
npm start:backend
```

**GraphQL API:**

The backend exposes a GraphQL API with the following main queries:
- `nodeManagerEvents` - Query NodeManager contract events
- `stfuelEvents` - Query sTFuel contract events
- `hourlySnapshots` - Query hourly aggregated metrics
- `latestSnapshot` - Get the latest snapshot
- `syncStatus` - Get current blockchain sync status

### 3. Smart Contracts (`packages/smart-contracts`)

Solidity smart contracts deployed on the Theta blockchain.

**Contracts:**
- **sTFuel.sol**: ERC20 token contract representing staked TFuel shares
- **nodeManager.sol**: Contract managing TFuel staking across Elite Edge Nodes

**Key Features:**
- ERC20 token standard with burnable functionality
- Price Per Share (PPS) mechanism that increases over time
- Mint/burn functionality with fee structures
- Withdrawal queue system with cooldown periods
- Direct redemption option with liquidity checks
- Referral reward system
- Access control and pause mechanisms
- Reentrancy protection

**Contract Addresses:**
- Set in backend environment variables (`NODE_MANAGER_ADDRESS`, `STFUEL_ADDRESS`)

## Development Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Access to Theta RPC endpoint
- npm or yarn package manager

### Quick Start

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd sTFuel-webapp
   ```

2. Install root dependencies:
   ```bash
   npm install
   ```

3. Set up backend:
   ```bash
   cd packages/backend
   npm install
   cp env.example .env
   # Configure .env file
   npm run migration:run
   ```

4. Set up frontend:
   ```bash
   cd packages/frontend
   npm install
   ```

5. Run both services:
   ```bash
   # From root directory
   npm run dev
   ```

   This will start:
   - Backend GraphQL API at `http://localhost:4000`
   - Frontend web app at `http://localhost:3000`

## Monorepo Scripts

From the root directory, you can run:

```bash
# Development
npm run dev              # Run both frontend and backend
npm run dev:frontend     # Run frontend only
npm run dev:backend      # Run backend only

# Build
npm run build            # Build both packages
npm run build:frontend   # Build frontend only
npm run build:backend    # Build backend only

# Production
npm start:frontend       # Start frontend production server
npm start:backend        # Start backend production server
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Theta RPC     │───▶│   Backend API    │───▶│   PostgreSQL    │
└─────────────────┘    │  (GraphQL)       │    └─────────────────┘
                       └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Frontend App   │
                       │    (Next.js)     │
                       └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Smart Contracts │
                       │  (Theta Chain)   │
                       └──────────────────┘
```

