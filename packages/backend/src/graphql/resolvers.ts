import { Repository } from 'typeorm';
import AppDataSource from '../database/data-source';
import { NodeManagerEvent } from '../database/entities/NodeManagerEvent';
import { StfuelEvent } from '../database/entities/StfuelEvent';
import { HourlySnapshot } from '../database/entities/HourlySnapshot';
import { SyncState } from '../database/entities/SyncState';
import { Address } from '../database/entities/Address';
import { EdgeNode } from '../database/entities/EdgeNode';
import { User } from '../database/entities/User';
import { RedemptionQueue } from '../database/entities/RedemptionQueue';
import { SnapshotService } from '../services/SnapshotService';
import { GraphQLScalarType, Kind } from 'graphql';

// Custom scalar resolvers
const BigIntScalar = new GraphQLScalarType({
  name: 'BigInt',
  description: 'BigInt custom scalar type',
  serialize(value: any) {
    return value.toString();
  },
  parseValue(value: any) {
    return BigInt(value);
  },
  parseLiteral(ast: any) {
    if (ast.kind === Kind.STRING) {
      return BigInt(ast.value);
    }
    return null;
  },
});

const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON custom scalar type',
  serialize(value: any) {
    return value;
  },
  parseValue(value: any) {
    return value;
  },
  parseLiteral(ast: any) {
    return ast.value;
  },
});

export const resolvers = {
  BigInt: BigIntScalar,
  JSON: JSONScalar,
  
  // Field resolvers to convert Unix timestamps to ISO strings
  NodeManagerEvent: {
    timestamp: (parent: any) => new Date(parent.timestamp * 1000).toISOString(),
    createdAt: (parent: any) => parent.createdAt.toISOString(),
  },
  
  StfuelEvent: {
    timestamp: (parent: any) => new Date(parent.timestamp * 1000).toISOString(),
    createdAt: (parent: any) => parent.createdAt.toISOString(),
  },
  
  HourlySnapshot: {
    snapshotTimestamp: (parent: any) => new Date(parent.snapshotTimestamp * 1000).toISOString(),
    createdAt: (parent: any) => parent.createdAt.toISOString(),
  },
  
  EdgeNode: {
    registrationTimestamp: (parent: any) => new Date(parent.registrationTimestamp * 1000).toISOString(),
    deactivationTimestamp: (parent: any) => parent.deactivationTimestamp ? new Date(parent.deactivationTimestamp * 1000).toISOString() : null,
    faultyTimestamp: (parent: any) => parent.faultyTimestamp ? new Date(parent.faultyTimestamp * 1000).toISOString() : null,
    recoveryTimestamp: (parent: any) => parent.recoveryTimestamp ? new Date(parent.recoveryTimestamp * 1000).toISOString() : null,
    createdAt: (parent: any) => parent.createdAt.toISOString(),
    updatedAt: (parent: any) => parent.updatedAt.toISOString(),
  },
  
  User: {
    firstActivityTimestamp: (parent: any) => parent.firstActivityTimestamp ? new Date(parent.firstActivityTimestamp * 1000).toISOString() : null,
    lastActivityTimestamp: (parent: any) => parent.lastActivityTimestamp ? new Date(parent.lastActivityTimestamp * 1000).toISOString() : null,
    createdAt: (parent: any) => parent.createdAt.toISOString(),
    updatedAt: (parent: any) => parent.updatedAt.toISOString(),
  },
  
  RedemptionQueue: {
    requestTimestamp: (parent: any) => new Date(parent.requestTimestamp * 1000).toISOString(),
    unlockTimestamp: (parent: any) => parent.unlockTimestamp ? new Date(parent.unlockTimestamp * 1000).toISOString() : null,
    creditedTimestamp: (parent: any) => parent.creditedTimestamp ? new Date(parent.creditedTimestamp * 1000).toISOString() : null,
    createdAt: (parent: any) => parent.createdAt.toISOString(),
    updatedAt: (parent: any) => parent.updatedAt.toISOString(),
  },
  
  Address: {
    createdAt: (parent: any) => parent.createdAt.toISOString(),
    updatedAt: (parent: any) => parent.updatedAt.toISOString(),
  },
  
  Query: {
    async nodeManagerEvents(
      _: any,
      {
        first = 50,
        after,
        eventName,
        address,
        fromBlock,
        toBlock,
      }: {
        first: number;
        after?: string;
        eventName?: string;
        address?: string;
        fromBlock?: string;
        toBlock?: string;
      }
    ) {
      const repo = AppDataSource.getRepository(NodeManagerEvent);
      let query = repo.createQueryBuilder('event');

      // Apply filters
      if (eventName) {
        query = query.andWhere('event.eventName = :eventName', { eventName });
      }
      if (address) {
        query = query.andWhere('event.address = :address', { address });
      }
      if (fromBlock) {
        query = query.andWhere('CAST(event.blockNumber AS bigint) >= :fromBlock', { fromBlock });
      }
      if (toBlock) {
        query = query.andWhere('CAST(event.blockNumber AS bigint) <= :toBlock', { toBlock });
      }

      // Apply cursor-based pagination
      if (after) {
        const afterId = parseInt(after);
        query = query.andWhere('event.id > :afterId', { afterId });
      }

      // Get total count
      const totalCount = await query.getCount();

      // Apply ordering and limit
      query = query
        .orderBy('event.blockNumber', 'DESC')
        .addOrderBy('event.transactionIndex', 'DESC')
        .addOrderBy('event.logIndex', 'DESC')
        .limit(first);

      const events = await query.getMany();

      const edges = events.map((event, index) => ({
        node: event,
        cursor: event.id.toString(),
      }));

      const hasNextPage = events.length === first;
      const hasPreviousPage = !!after;

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    async stfuelEvents(
      _: any,
      {
        first = 50,
        after,
        eventName,
        address,
        fromBlock,
        toBlock,
      }: {
        first: number;
        after?: string;
        eventName?: string;
        address?: string;
        fromBlock?: string;
        toBlock?: string;
      }
    ) {
      const repo = AppDataSource.getRepository(StfuelEvent);
      let query = repo.createQueryBuilder('event');

      // Apply filters
      if (eventName) {
        query = query.andWhere('event.eventName = :eventName', { eventName });
      }
      if (address) {
        query = query.andWhere('event.address = :address', { address });
      }
      if (fromBlock) {
        query = query.andWhere('CAST(event.blockNumber AS bigint) >= :fromBlock', { fromBlock });
      }
      if (toBlock) {
        query = query.andWhere('CAST(event.blockNumber AS bigint) <= :toBlock', { toBlock });
      }

      // Apply cursor-based pagination
      if (after) {
        const afterId = parseInt(after);
        query = query.andWhere('event.id > :afterId', { afterId });
      }

      // Get total count
      const totalCount = await query.getCount();

      // Apply ordering and limit
      query = query
        .orderBy('event.blockNumber', 'DESC')
        .addOrderBy('event.transactionIndex', 'DESC')
        .addOrderBy('event.logIndex', 'DESC')
        .limit(first);

      const events = await query.getMany();

      const edges = events.map((event, index) => ({
        node: event,
        cursor: event.id.toString(),
      }));

      const hasNextPage = events.length === first;
      const hasPreviousPage = !!after;

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    async hourlySnapshots(
      _: any,
      {
        first = 50,
        after,
        fromDate,
        toDate,
      }: {
        first: number;
        after?: string;
        fromDate?: string;
        toDate?: string;
      }
    ) {
      const repo = AppDataSource.getRepository(HourlySnapshot);
      let query = repo.createQueryBuilder('snapshot');

      // Apply date filters - convert ISO date strings to Unix timestamps
      if (fromDate) {
        const fromTimestamp = Math.floor(new Date(fromDate).getTime() / 1000);
        query = query.andWhere('snapshot.snapshotTimestamp >= :fromTimestamp', { fromTimestamp });
      }
      if (toDate) {
        const toTimestamp = Math.floor(new Date(toDate).getTime() / 1000);
        query = query.andWhere('snapshot.snapshotTimestamp <= :toTimestamp', { toTimestamp });
      }

      // Apply cursor-based pagination
      if (after) {
        const afterId = parseInt(after);
        query = query.andWhere('snapshot.id > :afterId', { afterId });
      }

      // Get total count
      const totalCount = await query.getCount();

      // Apply ordering and limit
      query = query
        .orderBy('snapshot.snapshotTimestamp', 'DESC')
        .limit(first);

      const snapshots = await query.getMany();

      const edges = snapshots.map((snapshot) => ({
        node: snapshot,
        cursor: snapshot.id.toString(),
      }));

      const hasNextPage = snapshots.length === first;
      const hasPreviousPage = !!after;

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    async dailySnapshots(
      _: any,
      {
        first = 50,
        after,
        fromDate,
        toDate,
      }: {
        first: number;
        after?: string;
        fromDate?: string;
        toDate?: string;
      }
    ) {
      const repo = AppDataSource.getRepository(HourlySnapshot);
      
      // Build the base query with date filters - convert ISO date strings to Unix timestamps
      let baseQuery = repo.createQueryBuilder('snapshot');
      
      if (fromDate) {
        const fromTimestamp = Math.floor(new Date(fromDate).getTime() / 1000);
        baseQuery = baseQuery.andWhere('snapshot.snapshotTimestamp >= :fromTimestamp', { fromTimestamp });
      }
      if (toDate) {
        const toTimestamp = Math.floor(new Date(toDate).getTime() / 1000);
        baseQuery = baseQuery.andWhere('snapshot.snapshotTimestamp <= :toTimestamp', { toTimestamp });
      }

      // Get all snapshots in the date range, ordered by timestamp DESC
      const allSnapshots = await baseQuery
        .orderBy('snapshot.snapshotTimestamp', 'DESC')
        .getMany();

      // Group snapshots by day and select the first (most recent) snapshot of each day
      const dailySnapshotsMap = new Map();
      
      allSnapshots.forEach((snapshot) => {
        const snapshotDate = new Date(Number(snapshot.snapshotTimestamp) * 1000);
        const dayKey = snapshotDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        if (!dailySnapshotsMap.has(dayKey)) {
          dailySnapshotsMap.set(dayKey, snapshot);
        }
      });

      // Convert map to array and sort by timestamp DESC
      const dailySnapshots = Array.from(dailySnapshotsMap.values())
        .sort((a, b) => Number(b.snapshotTimestamp) - Number(a.snapshotTimestamp));

      // Apply pagination
      let startIndex = 0;
      if (after) {
        const afterId = parseInt(after);
        const afterIndex = dailySnapshots.findIndex(s => s.id === afterId);
        if (afterIndex !== -1) {
          startIndex = afterIndex + 1;
        }
      }

      const paginatedSnapshots = dailySnapshots.slice(startIndex, startIndex + first);

      const edges = paginatedSnapshots.map((snapshot) => ({
        node: snapshot,
        cursor: snapshot.id.toString(),
      }));

      const hasNextPage = startIndex + first < dailySnapshots.length;
      const hasPreviousPage = !!after;

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount: dailySnapshots.length,
      };
    },

    async latestSnapshot() {
      const snapshotService = new SnapshotService();
      return await snapshotService.getLatestSnapshot();
    },

    async syncStatus() {
      const syncStateRepo = AppDataSource.getRepository(SyncState);
      const syncState = await syncStateRepo.findOne({ where: { key: 'main' } });
      
      return {
        lastBlockNumber: syncState?.lastBlockNumber || '0',
        isScanning: true, // This would be tracked by the scanner
        currentBlockNumber: syncState?.lastBlockNumber || '0',
      };
    },

    // Normalized table queries
    async edgeNodes(
      _: any,
      {
        first = 50,
        after,
        isActive,
        isFaulty,
        nodeType,
      }: {
        first: number;
        after?: string;
        isActive?: boolean;
        isFaulty?: boolean;
        nodeType?: string;
      }
    ) {
      const repo = AppDataSource.getRepository(EdgeNode);
      let query = repo.createQueryBuilder('edgeNode')
        .leftJoinAndSelect('edgeNode.address', 'address');

      // Apply filters
      if (isActive !== undefined) {
        query = query.andWhere('edgeNode.isActive = :isActive', { isActive });
      }
      if (isFaulty !== undefined) {
        query = query.andWhere('edgeNode.isFaulty = :isFaulty', { isFaulty });
      }
      if (nodeType) {
        query = query.andWhere('edgeNode.nodeType = :nodeType', { nodeType });
      }

      // Apply cursor-based pagination
      if (after) {
        const afterId = parseInt(after);
        query = query.andWhere('edgeNode.id > :afterId', { afterId });
      }

      // Get total count
      const totalCount = await query.getCount();

      // Apply ordering and limit
      query = query
        .orderBy('edgeNode.registrationBlock', 'DESC')
        .limit(first);

      const edgeNodes = await query.getMany();

      const edges = edgeNodes.map((edgeNode) => ({
        node: edgeNode,
        cursor: edgeNode.id.toString(),
      }));

      const hasNextPage = edgeNodes.length === first;
      const hasPreviousPage = !!after;

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },

    async edgeNode(_: any, { address }: { address: string }) {
      const repo = AppDataSource.getRepository(EdgeNode);
      return await repo.createQueryBuilder('edgeNode')
        .leftJoinAndSelect('edgeNode.address', 'address')
        .where('address.address = :address', { address })
        .getOne();
    },

    async users(
      _: any,
      {
        first = 50,
        after,
        minBalance,
      }: {
        first: number;
        after?: string;
        minBalance?: string;
      }
    ) {
      const repo = AppDataSource.getRepository(User);
      let query = repo.createQueryBuilder('user')
        .leftJoinAndSelect('user.address', 'address');

      // Apply filters - handle negative balances and use proper numeric comparison
      if (minBalance) {
        // Convert minBalance to a more reasonable format for comparison
        const minBalanceNum = parseFloat(minBalance);
        if (!isNaN(minBalanceNum) && minBalanceNum > 0) {
          // Filter out negative balances and zero address, then apply minimum balance filter
          query = query
            .andWhere('CAST(user.stfuelBalance AS numeric) >= 0') // Exclude negative balances
            .andWhere('CAST(user.stfuelBalance AS numeric) >= :minBalanceNum', { minBalanceNum });
        }
      } else {
        // Even without minBalance filter, exclude negative balances
        query = query.andWhere('CAST(user.stfuelBalance AS numeric) >= 0');
      }

      // Apply cursor-based pagination
      if (after) {
        const afterId = parseInt(after);
        query = query.andWhere('user.id > :afterId', { afterId });
      }

      // Limit to maximum 100 users and order by balance descending
      const maxFirst = Math.min(first, 100);
      
      // Apply ordering and limit
      query = query
        .orderBy('CAST(user.stfuelBalance AS numeric)', 'DESC')
        .limit(maxFirst);

      const users = await query.getMany();

      const edges = users.map((user) => ({
        node: user,
        cursor: user.id.toString(),
      }));

      const hasNextPage = users.length === maxFirst;
      const hasPreviousPage = !!after;

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount: users.length, // Return actual count instead of total count to avoid expensive queries
      };
    },

    async user(_: any, { address }: { address: string }) {
      console.log('User resolver called with address:', address);
      const repo = AppDataSource.getRepository(User);
      
      // Try case-insensitive search first
      const user = await repo.createQueryBuilder('user')
        .leftJoinAndSelect('user.address', 'address')
        .where('LOWER(address.address) = LOWER(:address)', { address })
        .getOne();
      
      console.log('User found:', user ? 'Yes' : 'No');
      if (user) {
        console.log('User data:', {
          id: user.id,
          address: user.address?.address,
          stfuelBalance: user.stfuelBalance
        });
      }
      
      return user;
    },

    async redemptionQueue(
      _: any,
      {
        first = 50,
        after,
        status,
        userAddress,
      }: {
        first: number;
        after?: string;
        status?: string;
        userAddress?: string;
      }
    ) {
      const repo = AppDataSource.getRepository(RedemptionQueue);
      let query = repo.createQueryBuilder('redemption')
        .leftJoinAndSelect('redemption.userAddress', 'address');

      // Apply filters
      if (status) {
        query = query.andWhere('redemption.status = :status', { status });
      }
      if (userAddress) {
        query = query.andWhere('LOWER(address.address) = LOWER(:userAddress)', { userAddress });
      }

      // Apply cursor-based pagination
      if (after) {
        const afterId = parseInt(after);
        query = query.andWhere('redemption.id > :afterId', { afterId });
      }

      // Get total count
      const totalCount = await query.getCount();

      // Apply ordering and limit
      query = query
        .orderBy('redemption.requestBlock', 'ASC')
        .limit(first);

      const redemptions = await query.getMany();

      const edges = redemptions.map((redemption) => ({
        node: redemption,
        cursor: redemption.id.toString(),
      }));

      const hasNextPage = redemptions.length === first;
      const hasPreviousPage = !!after;

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges[0]?.cursor || null,
          endCursor: edges[edges.length - 1]?.cursor || null,
        },
        totalCount,
      };
    },
  },
};

export default resolvers;
