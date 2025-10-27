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

      // Apply date filters
      if (fromDate) {
        query = query.andWhere('snapshot.snapshotTimestamp >= :fromDate', { fromDate });
      }
      if (toDate) {
        query = query.andWhere('snapshot.snapshotTimestamp <= :toDate', { toDate });
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

      // Apply filters
      if (minBalance) {
        query = query.andWhere('CAST(user.stfuelBalance AS bigint) >= :minBalance', { minBalance });
      }

      // Apply cursor-based pagination
      if (after) {
        const afterId = parseInt(after);
        query = query.andWhere('user.id > :afterId', { afterId });
      }

      // Get total count
      const totalCount = await query.getCount();

      // Apply ordering and limit
      query = query
        .orderBy('user.stfuelBalance', 'DESC')
        .limit(first);

      const users = await query.getMany();

      const edges = users.map((user) => ({
        node: user,
        cursor: user.id.toString(),
      }));

      const hasNextPage = users.length === first;
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

    async user(_: any, { address }: { address: string }) {
      const repo = AppDataSource.getRepository(User);
      return await repo.createQueryBuilder('user')
        .leftJoinAndSelect('user.address', 'address')
        .where('address.address = :address', { address })
        .getOne();
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
        query = query.andWhere('address.address = :userAddress', { userAddress });
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
        .orderBy('redemption.requestBlock', 'DESC')
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
