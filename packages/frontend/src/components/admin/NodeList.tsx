'use client';
import { useState, useEffect, useMemo, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { adminApi } from '@/lib/adminApi';
import { GET_EDGE_NODE_BY_ADDRESS } from '@/graphql/queries';
import toast from 'react-hot-toast';
import { NodeDetailModal } from './NodeDetailModal';

interface EdgeNodeData {
  id: string;
  address: {
    address: string;
  };
  registrationBlock: string;
  registrationTimestamp: string;
  isActive: boolean;
  deactivationBlock: string | null;
  deactivationTimestamp: string | null;
  isFaulty: boolean;
  faultyBlock: string | null;
  faultyTimestamp: string | null;
  recoveryBlock: string | null;
  recoveryTimestamp: string | null;
  totalStaked: string;
  totalUnstaked: string;
  unstakeBlock: string | null;
  nodeType: string | null;
  isLive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EdgeNodeQueryData {
  edgeNode: EdgeNodeData | null;
}

export interface NodeWithEdgeData {
  id: number;
  nodeId: string;
  address?: string;
  serverId: number;
  serverIp: string;
  summary?: string | null;
  keystore?: object | null;
  isRunning?: boolean;
  edgeNodeData?: EdgeNodeData | null;
}

const shortenAddress = (address?: string) => {
  if (!address) return 'N/A';
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export interface NodeListRef {
  refresh: () => void;
}

export const NodeList = forwardRef<NodeListRef, { onRefresh?: () => void }>(
  ({ onRefresh }, ref) => {
  const [nodes, setNodes] = useState<NodeWithEdgeData[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NodeWithEdgeData | null>(null);
  const [filters, setFilters] = useState({
    server: 'all',
    status: 'all',
    nodeType: 'all',
    faulty: 'all',
  });
  const client = useApolloClient();

  const fetchNodes = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsInitialLoad(true);
      }
      const response = await adminApi.getServers();
      const allNodes: NodeWithEdgeData[] = [];

      for (const server of response.servers) {
        for (const node of server.managedNodes) {
          allNodes.push({
            ...node,
            serverId: server.id,
            serverIp: server.ipAddress,
          });
        }
      }

      const nodesWithEdgeData = await Promise.all(
        allNodes.map(async (node) => {
          if (!node.address) {
            return node;
          }

          try {
            const { data } = await client.query<EdgeNodeQueryData>({
              query: GET_EDGE_NODE_BY_ADDRESS,
              variables: { address: node.address },
              fetchPolicy: 'network-only',
            });
            return {
              ...node,
              edgeNodeData: data?.edgeNode,
            };
          } catch (error) {
            console.warn(`Failed to fetch edge node data for ${node.nodeId}:`, error);
            return node;
          }
        })
      );

      setNodes(nodesWithEdgeData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch nodes');
    } finally {
      setIsInitialLoad(false);
      setIsRefreshing(false);
    }
  }, [client]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  useImperativeHandle(ref, () => ({
    refresh: () => fetchNodes(true),
  }));

  useEffect(() => {
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchNodes(true), 30000);
    return () => clearInterval(interval);
  }, [fetchNodes]);

  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      const matchesServer = filters.server === 'all' || node.serverIp === filters.server;
      const statusValue = node.edgeNodeData
        ? node.edgeNodeData.isActive
          ? 'active'
          : 'inactive'
        : 'unregistered';
      const matchesStatus =
        filters.status === 'all' || filters.status === statusValue;

      const nodeTypeValue = (node.edgeNodeData?.nodeType || 'N/A').toLowerCase();
      const matchesNodeType =
        filters.nodeType === 'all' ||
        filters.nodeType.toLowerCase() === nodeTypeValue;

      const matchesFaulty =
        filters.faulty === 'all' ||
        (filters.faulty === 'faulty' && node.edgeNodeData?.isFaulty) ||
        (filters.faulty === 'ok' && node.edgeNodeData && !node.edgeNodeData.isFaulty);

      return matchesServer && matchesStatus && matchesNodeType && matchesFaulty;
    });
  }, [nodes, filters]);

  const uniqueServerIps = useMemo(
    () => Array.from(new Set(nodes.map((node) => node.serverIp))),
    [nodes]
  );
  const uniqueNodeTypes = useMemo(
    () => Array.from(new Set(nodes.map((node) => node.edgeNodeData?.nodeType || 'N/A'))),
    [nodes]
  );

  const NodeRow = ({ node }: { node: NodeWithEdgeData }) => {
    const edgeNode = node.edgeNodeData;
    const isActive = edgeNode?.isActive ?? false;
    const isFaulty = edgeNode?.isFaulty ?? false;
    const nodeType = edgeNode?.nodeType ?? 'N/A';
    const statusLabel = edgeNode ? (isActive ? 'Active' : 'Inactive') : 'N/A';
    const isRunning = node.isRunning ?? false;

    return (
      <tr
        className="border-b border-gray-700 hover:bg-gray-800/50 cursor-pointer"
        onClick={() => setSelectedNode(node)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                isRunning ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            {node.nodeId}
          </div>
        </td>
        <td className="px-4 py-3">{node.serverIp}</td>
        <td className="px-4 py-3 font-mono text-sm">{shortenAddress(node.address)}</td>
        <td className="px-4 py-3">
          <span
            className={`px-2 py-1 rounded text-xs ${
              statusLabel === 'Active'
                ? 'bg-green-500/20 text-green-400'
                : statusLabel === 'Inactive'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-gray-600/40 text-gray-300'
            }`}
          >
            {statusLabel}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-200">{nodeType}</td>
        <td className="px-4 py-3">
          {edgeNode ? (
            <span
              className={`px-2 py-1 rounded text-xs ${
                isFaulty ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
              }`}
            >
              {isFaulty ? 'Faulty' : 'OK'}
            </span>
          ) : (
            <span className="text-gray-400">N/A</span>
          )}
        </td>
      </tr>
    );
  };

  if (isInitialLoad) {
    return <div className="text-center py-8">Loading nodes...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Managed Nodes</h2>
        {isRefreshing && (
          <span className="text-sm text-gray-400 flex items-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
            Refreshing...
          </span>
        )}
      </div>
      
      {nodes.length === 0 && !isInitialLoad && (
        <div className="text-center py-8 text-gray-400">
          No managed nodes found. Add a node to get started.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
          value={filters.server}
          onChange={(e) => setFilters((f) => ({ ...f, server: e.target.value }))}
        >
          <option value="all">All Servers</option>
          {uniqueServerIps.map((serverIp) => (
            <option key={serverIp} value={serverIp}>
              {serverIp}
            </option>
          ))}
        </select>

        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="unregistered">Not Registered</option>
        </select>

        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
          value={filters.nodeType}
          onChange={(e) => setFilters((f) => ({ ...f, nodeType: e.target.value }))}
        >
          <option value="all">All Node Types</option>
          {uniqueNodeTypes.map((nodeType) => (
            <option key={nodeType} value={nodeType}>
              {nodeType}
            </option>
          ))}
        </select>

        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
          value={filters.faulty}
          onChange={(e) => setFilters((f) => ({ ...f, faulty: e.target.value }))}
        >
          <option value="all">Faulty: All</option>
          <option value="ok">OK</option>
          <option value="faulty">Faulty</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-4 py-3 text-left">Node Name</th>
              <th className="px-4 py-3 text-left">Server</th>
              <th className="px-4 py-3 text-left">Address</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Node Type</th>
              <th className="px-4 py-3 text-left">Faulty</th>
            </tr>
          </thead>
          <tbody>
            {filteredNodes.map((node) => (
              <NodeRow key={node.id} node={node} />
            ))}
          </tbody>
        </table>
        {filteredNodes.length === 0 && (
          <div className="text-center py-6 text-gray-400">
            No nodes match the selected filters.
          </div>
        )}
      </div>

      {selectedNode && (
        <NodeDetailModal
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onUpdated={fetchNodes}
        />
      )}
    </div>
  );
  }
);

NodeList.displayName = 'NodeList';

