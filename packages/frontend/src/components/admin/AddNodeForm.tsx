'use client';
import { useState, useEffect } from 'react';
import { adminApi, Server } from '@/lib/adminApi';
import toast from 'react-hot-toast';

interface AddNodeFormProps {
  onSuccess: () => void;
}

export const AddNodeForm = ({ onSuccess }: AddNodeFormProps) => {
  const [servers, setServers] = useState<Server[]>([]);
  const [serverId, setServerId] = useState('');
  const [name, setName] = useState('');
  const [keystoreJson, setKeystoreJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingServers, setLoadingServers] = useState(true);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const response = await adminApi.getServers();
        const availableServers = response.servers.filter(
          (s) => s.isHealthy && s.currentNodeCount < s.maxEdgeNodes
        );
        setServers(availableServers);
        if (availableServers.length > 0) {
          setServerId(availableServers[0].id.toString());
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to fetch servers');
      } finally {
        setLoadingServers(false);
      }
    };

    fetchServers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!serverId || !name) {
      toast.error('Please fill in all required fields');
      return;
    }

    let keystore: object | undefined;
    if (keystoreJson) {
      try {
        keystore = JSON.parse(keystoreJson);
      } catch (error) {
        toast.error('Invalid JSON in keystore field');
        return;
      }
    }

    try {
      setLoading(true);
      await adminApi.createNode({
        serverId: parseInt(serverId),
        name,
        keystore,
      });
      toast.success('Node created successfully');
      setName('');
      setKeystoreJson('');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create node');
    } finally {
      setLoading(false);
    }
  };

  if (loadingServers) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="text-center py-4">Loading servers...</div>
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="text-center py-4 text-gray-400">
          No healthy servers with available capacity found. Add a server first.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-xl font-semibold mb-4">Add New Node</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Server <span className="text-red-400">*</span>
          </label>
          <select
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            {servers.map((server) => (
              <option key={server.id} value={server.id}>
                {server.ipAddress} ({server.currentNodeCount}/{server.maxEdgeNodes} nodes)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Node Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="node-001"
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Keystore (JSON, optional)
          </label>
          <textarea
            value={keystoreJson}
            onChange={(e) => setKeystoreJson(e.target.value)}
            placeholder='{"version":3,"id":"...","address":"..."}'
            rows={4}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
          />
          <p className="mt-2 text-xs text-gray-400">
            Leave empty to auto-generate a keystore on the server. Address and summary are fetched automatically.
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          {loading ? 'Creating...' : 'Create Node'}
        </button>
      </form>
    </div>
  );
};

