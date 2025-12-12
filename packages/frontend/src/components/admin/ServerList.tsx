'use client';
import { useState, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { adminApi, Server } from '@/lib/adminApi';
import toast from 'react-hot-toast';

export interface ServerListRef {
  refresh: () => void;
}

export const ServerList = forwardRef<ServerListRef, { onRefresh?: () => void }>(
  ({ onRefresh }, ref) => {
  const [servers, setServers] = useState<Server[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshingServerId, setRefreshingServerId] = useState<number | null>(null);

  const fetchServers = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsInitialLoad(true);
      }
      const response = await adminApi.getServers();
      setServers(response.servers);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch servers');
    } finally {
      setIsInitialLoad(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  useImperativeHandle(ref, () => ({
    refresh: () => fetchServers(true),
  }), [fetchServers]);

  useEffect(() => {
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchServers(true), 30000);
    return () => clearInterval(interval);
  }, [fetchServers]);

  const handleRefreshServer = async (serverId: number) => {
    try {
      setRefreshingServerId(serverId);
      const updatedServer = await adminApi.refreshServer(serverId);
      
      // Update the server in the list
      setServers((prevServers) =>
        prevServers.map((server) =>
          server.id === serverId ? updatedServer : server
        )
      );
      
      toast.success('Server refreshed successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh server');
    } finally {
      setRefreshingServerId(null);
    }
  };

  if (isInitialLoad) {
    return <div className="text-center py-8">Loading servers...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Servers</h2>
        {isRefreshing && (
          <span className="text-sm text-gray-400 flex items-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
            Refreshing...
          </span>
        )}
      </div>
      
      {servers.length === 0 && !isInitialLoad && (
        <div className="text-center py-8 text-gray-400">
          No servers found. Add a server to get started.
        </div>
      )}
      <div className="grid gap-4">
        {servers.map((server) => (
          <div
            key={server.id}
            className="bg-gray-800 rounded-lg p-6 border border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold">{server.ipAddress}</h3>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    server.isHealthy
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {server.isHealthy ? 'Healthy' : 'Unhealthy'}
                </span>
              </div>
              <button
                onClick={() => handleRefreshServer(server.id)}
                disabled={refreshingServerId === server.id}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition cursor-pointer"
                title="Refresh server status and node statuses"
              >
                {refreshingServerId === server.id ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Max Nodes</div>
                <div className="text-lg font-semibold">{server.maxEdgeNodes}</div>
              </div>
              <div>
                <div className="text-gray-400">Current Nodes</div>
                <div className="text-lg font-semibold">
                  {server.currentNodeCount}
                </div>
              </div>
              <div>
                <div className="text-gray-400">Available</div>
                <div className="text-lg font-semibold">
                  {server.maxEdgeNodes - server.currentNodeCount}
                </div>
              </div>
              <div>
                <div className="text-gray-400">Status</div>
                <div className="text-lg font-semibold">
                  {server.currentNodeCount >= server.maxEdgeNodes
                    ? 'Full'
                    : 'Available'}
                </div>
              </div>
            </div>
            {server.managedNodes.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="text-sm text-gray-400 mb-2">Managed Nodes:</div>
                <div className="flex flex-wrap gap-2">
                  {server.managedNodes.map((node) => (
                    <span
                      key={node.id}
                      className={`px-2 py-1 rounded text-xs ${
                        node.isRunning ? 'bg-gray-700' : 'bg-red-500/30 text-red-300'
                      }`}
                    >
                      {node.nodeId}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
  }
);

ServerList.displayName = 'ServerList';

