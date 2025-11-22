import { config } from '../config/environment';

export interface NodeStatus {
  container: {
    status: string;
    name: string;
  };
  rpc: {
    isReachable: boolean;
    url?: string;
  };
  metadata: {
    name: string;
    ports: number[];
    network: string;
  };
}

export interface NodeInfo {
  name: string;
  status: NodeStatus;
}

export interface CreateNodeResponse {
  name: string;
  status: NodeStatus;
}

export class EdgeNodeManagerService {
  private apiKey: string;

  constructor() {
    this.apiKey = config.edgeNodeManagerApiKey || '';
  }

  private async makeRequest(
    ipAddress: string,
    method: string,
    endpoint: string,
    body?: any
  ): Promise<any> {
    const url = `http://${ipAddress}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge Node Manager API error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async checkServerHealth(ipAddress: string): Promise<boolean> {
    try {
      const response = await fetch(`http://${ipAddress}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async createNode(
    ipAddress: string,
    name: string,
    keystore?: object
  ): Promise<CreateNodeResponse> {
    const endpoint = keystore ? '/nodes/new-with-keystore' : '/nodes/new';
    const body = keystore
      ? { name, keystore }
      : { name };

    return this.makeRequest(ipAddress, 'POST', endpoint, body);
  }

  async getNodeStatus(ipAddress: string, nodeId: string): Promise<NodeStatus> {
    const response = await this.makeRequest(ipAddress, 'GET', `/nodes/${nodeId}/status`);
    return response.status;
  }

  async startNode(ipAddress: string, nodeId: string): Promise<void> {
    await this.makeRequest(ipAddress, 'POST', `/nodes/${nodeId}/start`);
  }

  async stopNode(ipAddress: string, nodeId: string): Promise<void> {
    await this.makeRequest(ipAddress, 'POST', `/nodes/${nodeId}/stop`);
  }

  async getNodeKeystore(ipAddress: string, nodeId: string): Promise<object> {
    return this.makeRequest(ipAddress, 'GET', `/nodes/${nodeId}/keystore`);
  }

  async listNodes(ipAddress: string): Promise<NodeInfo[]> {
    const response = await this.makeRequest(ipAddress, 'GET', '/nodes');
    return response.nodes || [];
  }
}

