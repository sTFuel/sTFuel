'use client';
import { useState } from 'react';
import { adminApi } from '@/lib/adminApi';
import toast from 'react-hot-toast';

interface AddServerFormProps {
  onSuccess: () => void;
}

export const AddServerForm = ({ onSuccess }: AddServerFormProps) => {
  const [ipAddress, setIpAddress] = useState('');
  const [maxEdgeNodes, setMaxEdgeNodes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ipAddress || !maxEdgeNodes) {
      toast.error('Please fill in all fields');
      return;
    }

    const maxNodes = parseInt(maxEdgeNodes);
    if (isNaN(maxNodes) || maxNodes <= 0) {
      toast.error('Max edge nodes must be a positive number');
      return;
    }

    try {
      setLoading(true);
      await adminApi.addServer({
        ipAddress,
        maxEdgeNodes: maxNodes,
      });
      toast.success('Server added successfully');
      setIpAddress('');
      setMaxEdgeNodes('');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-xl font-semibold mb-4">Add New Server</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            IP Address
          </label>
          <input
            type="text"
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            placeholder="192.168.1.100"
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Max Edge Nodes
          </label>
          <input
            type="number"
            value={maxEdgeNodes}
            onChange={(e) => setMaxEdgeNodes(e.target.value)}
            placeholder="10"
            min="1"
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          {loading ? 'Adding...' : 'Add Server'}
        </button>
      </form>
    </div>
  );
};

