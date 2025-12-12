const getBaseUrl = () => {
  const graphqlUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql';
  return graphqlUrl.replace('/graphql', '');
};

const API_BASE = `${getBaseUrl()}/api/admin`;

export interface Server {
  id: number;
  ipAddress: string;
  isHealthy: boolean;
  maxEdgeNodes: number;
  currentNodeCount: number;
  managedNodes: ManagedNode[];
  createdAt: string;
  updatedAt: string;
}

export interface ManagedNode {
  id: number;
  nodeId: string;
  address?: string;
  summary?: string;
  isRunning?: boolean;
}

export interface NodeWithDetails extends ManagedNode {
  serverId: number;
  serverIp: string;
  addressId: number;
}

export interface LoginResponse {
  success: boolean;
  expiresAt: string;
  sessionToken: string;
}

export interface CreateServerRequest {
  ipAddress: string;
  maxEdgeNodes: number;
}

export interface CreateNodeRequest {
  serverId: number;
  name: string;
  keystore?: object;
}

export interface SetNodeFeeRequest {
  rewardWallet: string;
  splitFee: number;
}

export interface SetNodeFeeResponse {
  success: boolean;
  transactionHash?: {
    hash: string;
    block?: any;
  };
  message?: string;
  error?: string;
}

class AdminApi {
  private getSessionToken(): string | null {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('adminSessionToken');
    if (process.env.NODE_ENV === 'development') {
      console.log('Retrieved session token from localStorage:', token ? 'Found' : 'Not found');
    }
    return token;
  }

  private setSessionToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('adminSessionToken', token);
    }
  }

  private clearSessionToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('adminSessionToken');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const sessionToken = this.getSessionToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Add session token as header if available (fallback for cross-site cookies)
    if (sessionToken) {
      headers['x-admin-session'] = sessionToken;
    }

    // Debug logging (remove in production)
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('Admin API Request:', {
        url,
        hasToken: !!sessionToken,
        headers: Object.keys(headers),
      });
    }

    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Include cookies
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    // Store session token in localStorage as fallback for cross-site cookies
    if (response.sessionToken) {
      this.setSessionToken(response.sessionToken);
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log('Session token stored in localStorage');
      }
    } else {
      console.warn('Login response did not include sessionToken');
    }
    
    return response;
  }

  async logout(): Promise<{ success: boolean }> {
    try {
      const result = await this.request<{ success: boolean }>('/logout', {
        method: 'POST',
      });
      this.clearSessionToken();
      return result;
    } catch (error) {
      this.clearSessionToken();
      throw error;
    }
  }

  async getServers(): Promise<{ servers: Server[] }> {
    return this.request<{ servers: Server[] }>('/servers', {
      method: 'GET',
    });
  }

  async addServer(data: CreateServerRequest): Promise<Server> {
    return this.request<Server>('/servers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createNode(data: CreateNodeRequest): Promise<NodeWithDetails> {
    return this.request<NodeWithDetails>('/nodes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async startNode(nodeId: number): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/nodes/${nodeId}/start`, {
      method: 'POST',
    });
  }

  async stopNode(nodeId: number): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/nodes/${nodeId}/stop`, {
      method: 'POST',
    });
  }

  async refreshServer(serverId: number): Promise<Server> {
    return this.request<Server>(`/servers/${serverId}/refresh`, {
      method: 'POST',
    });
  }

  async setNodeFee(nodeId: number, data: SetNodeFeeRequest): Promise<SetNodeFeeResponse> {
    return this.request<SetNodeFeeResponse>(`/nodes/${nodeId}/set-fee`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const adminApi = new AdminApi();

