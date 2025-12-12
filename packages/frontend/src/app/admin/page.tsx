'use client';
import { useRef } from 'react';
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import { ServerList, ServerListRef } from '@/components/admin/ServerList';
import { NodeList, NodeListRef } from '@/components/admin/NodeList';
import { AddServerForm } from '@/components/admin/AddServerForm';
import { AddNodeForm } from '@/components/admin/AddNodeForm';
import { useAdmin } from '@/contexts/AdminContext';

export default function AdminDashboard() {
  const { logout } = useAdmin();
  const serverListRef = useRef<ServerListRef>(null);
  const nodeListRef = useRef<NodeListRef>(null);

  const handleRefresh = () => {
    serverListRef.current?.refresh();
    nodeListRef.current?.refresh();
  };

  return (
    <ProtectedRoute>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold">Admin Dashboard</h1>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
          >
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <AddServerForm onSuccess={handleRefresh} />
          </div>
          <div>
            <AddNodeForm onSuccess={handleRefresh} />
          </div>
        </div>

        <div>
          <ServerList ref={serverListRef} onRefresh={handleRefresh} />
        </div>

        <div>
          <NodeList ref={nodeListRef} onRefresh={handleRefresh} />
        </div>
      </div>
    </ProtectedRoute>
  );
}

