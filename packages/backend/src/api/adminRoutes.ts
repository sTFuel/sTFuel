import { Router, Request, Response } from 'express';
import AppDataSource from '../database/data-source';
import { Server } from '../database/entities/Server';
import { ManagedNode } from '../database/entities/ManagedNode';
import { EdgeNode } from '../database/entities/EdgeNode';
import { Address } from '../database/entities/Address';
import { AdminAuthService } from '../services/AdminAuthService';
import { EdgeNodeManagerService, NodeStatus } from '../services/EdgeNodeManagerService';
import { adminAuthMiddleware, AuthenticatedRequest } from '../middleware/adminAuth';

const router = Router();
const adminAuthService = new AdminAuthService();
const edgeNodeManagerService = new EdgeNodeManagerService();

const normalizeAddress = (rawAddress?: string | null): string | null => {
  if (!rawAddress) return null;
  const address = rawAddress.toLowerCase();
  return address.startsWith('0x') ? address : `0x${address}`;
};

const extractAddressFromStatus = (status: NodeStatus): string | null => {
  return (
    normalizeAddress(status.rpc?.status?.address) ||
    normalizeAddress(status.rpc?.address) ||
    null
  );
};

const extractSummaryFromStatus = (status: NodeStatus): string | null => {
  const summaryObj = status.rpc?.summary;
  if (!summaryObj) return null;
  if (typeof summaryObj.Summary === 'string') {
    return summaryObj.Summary;
  }

  const values = Object.values(summaryObj);
  const firstValue = values.find((value) => typeof value === 'string');
  return (firstValue as string) || null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchNodeStatusWithRetry = async (
  server: Server,
  nodeName: string,
  retries: number = 5,
  delayMs: number = 2000
): Promise<NodeStatus | null> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const status = await edgeNodeManagerService.getNodeStatus(server.ipAddress, nodeName);
      const address = extractAddressFromStatus(status);
      if (address) {
        return status;
      }
    } catch (error) {
      console.warn(
        `Attempt ${attempt + 1} to fetch status for node ${nodeName} on ${server.ipAddress} failed:`,
        error
      );
    }
    await sleep(delayMs);
  }
  return null;
};

const syncExistingNodesForServer = async (server: Server): Promise<void> => {
  const managedNodeRepo = AppDataSource.getRepository(ManagedNode);
  const addressRepo = AppDataSource.getRepository(Address);

  try {
    const nodes = await edgeNodeManagerService.listNodes(server.ipAddress);
    for (const node of nodes) {
      try {
        const status = await edgeNodeManagerService.getNodeStatus(server.ipAddress, node.name);
        const normalizedAddress = extractAddressFromStatus(status);
        if (!normalizedAddress) {
          console.warn(
            `Unable to determine address for node ${node.name} on server ${server.ipAddress}`
          );
          continue;
        }

        let addressEntity = await addressRepo.findOne({ where: { address: normalizedAddress } });
        if (!addressEntity) {
          addressEntity = addressRepo.create({ address: normalizedAddress });
          addressEntity = await addressRepo.save(addressEntity);
        }

        const existingByNode = await managedNodeRepo.findOne({ where: { nodeId: node.name } });
        const existingByAddress = await managedNodeRepo.findOne({ where: { addressId: addressEntity.id } });

        if (existingByNode || existingByAddress) {
          continue;
        }

        let keystore: object | null = null;
        try {
          keystore = await edgeNodeManagerService.getNodeKeystore(server.ipAddress, node.name);
        } catch (error) {
          console.warn(`Failed to fetch keystore for node ${node.name}:`, error);
        }

        const summary = extractSummaryFromStatus(status);

        const managedNode = managedNodeRepo.create({
          addressId: addressEntity.id,
          serverId: server.id,
          nodeId: node.name,
          keystore: keystore || null,
          summary: summary || null,
        });

        await managedNodeRepo.save(managedNode);
      } catch (error) {
        console.error(
          `Failed to sync node ${node.name} for server ${server.ipAddress}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error(`Failed to list nodes for server ${server.ipAddress}:`, error);
  }
};

// Login endpoint (no auth required)
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const { sessionToken, expiresAt } = await adminAuthService.login(username, password);

    // Set session cookie
    // Use 'none' for cross-site requests (frontend on different domain)
    // 'none' requires secure: true
    const isProduction = process.env.NODE_ENV === 'production';
    const isHttps = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';
    
    res.cookie('adminSession', sessionToken, {
      httpOnly: true,
      secure: isHttps, // Must be true for sameSite: 'none', and when using HTTPS
      sameSite: isProduction && isHttps ? 'none' : 'lax', // 'none' for cross-site HTTPS, 'lax' for same-site
      expires: expiresAt,
      path: '/',
    });

    // Also return token in response for cross-site cookie issues
    // Frontend can store in localStorage and send as header
    res.json({ success: true, expiresAt, sessionToken });
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Login failed' });
  }
});

// Logout endpoint (no auth required - just clears session)
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const sessionToken = req.cookies?.adminSession || req.headers['x-admin-session'] as string;
    if (sessionToken) {
      try {
        await adminAuthService.logout(sessionToken);
      } catch (error) {
        // Ignore errors if session doesn't exist
        console.log('Session already invalid or expired');
      }
    }

    res.clearCookie('adminSession');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Logout failed' });
  }
});

// Get all servers with node information
router.get('/servers', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const serverRepo = AppDataSource.getRepository(Server);
    const managedNodeRepo = AppDataSource.getRepository(ManagedNode);

    const servers = await serverRepo.find({
      relations: ['managedNodes', 'managedNodes.address'],
    });

    const serversWithCounts = await Promise.all(
      servers.map(async (server) => {
        const nodeCount = await managedNodeRepo.count({ where: { serverId: server.id } });
        return {
          id: server.id,
          ipAddress: server.ipAddress,
          isHealthy: server.isHealthy,
          maxEdgeNodes: server.maxEdgeNodes,
          currentNodeCount: nodeCount,
          managedNodes: server.managedNodes.map((node) => ({
            id: node.id,
            nodeId: node.nodeId,
            address: node.address?.address,
            summary: node.summary,
            isRunning: node.isRunning,
          })),
          createdAt: server.createdAt,
          updatedAt: server.updatedAt,
        };
      })
    );

    res.json({ servers: serversWithCounts });
  } catch (error: any) {
    console.error('Error fetching servers:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch servers' });
  }
});

// Add new server
router.post('/servers', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ipAddress, maxEdgeNodes } = req.body;

    if (!ipAddress || !maxEdgeNodes) {
      res.status(400).json({ error: 'ipAddress and maxEdgeNodes are required' });
      return;
    }

    if (typeof maxEdgeNodes !== 'number' || maxEdgeNodes <= 0) {
      res.status(400).json({ error: 'maxEdgeNodes must be a positive number' });
      return;
    }

    // Check if server already exists
    const serverRepo = AppDataSource.getRepository(Server);
    const managedNodeRepo = AppDataSource.getRepository(ManagedNode);
    const existing = await serverRepo.findOne({ where: { ipAddress } });
    if (existing) {
      res.status(400).json({ error: 'Server with this IP address already exists' });
      return;
    }

    // Check server health
    const isHealthy = await edgeNodeManagerService.checkServerHealth(ipAddress);

    const server = serverRepo.create({
      ipAddress,
      maxEdgeNodes,
      isHealthy,
    });

    const savedServer = await serverRepo.save(server);

  // Attempt to sync any existing nodes on the server
  await syncExistingNodesForServer(savedServer);

  const refreshedServer = await serverRepo.findOne({
    where: { id: savedServer.id },
    relations: ['managedNodes', 'managedNodes.address'],
  });

  const nodeCount = await managedNodeRepo.count({ where: { serverId: savedServer.id } });

    res.status(201).json({
    id: savedServer.id,
    ipAddress: savedServer.ipAddress,
    isHealthy: savedServer.isHealthy,
    maxEdgeNodes: savedServer.maxEdgeNodes,
    currentNodeCount: nodeCount,
    managedNodes: (refreshedServer?.managedNodes || []).map((node) => ({
      id: node.id,
      nodeId: node.nodeId,
      address: node.address?.address,
      summary: node.summary,
      isRunning: node.isRunning,
    })),
    createdAt: savedServer.createdAt,
    updatedAt: savedServer.updatedAt,
    });
  } catch (error: any) {
    console.error('Error creating server:', error);
    res.status(500).json({ error: error.message || 'Failed to create server' });
  }
});

// Create new node on server
router.post('/nodes', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { serverId, name, keystore } = req.body;

    if (!serverId || !name) {
      res.status(400).json({ error: 'serverId and name are required' });
      return;
    }

    const serverRepo = AppDataSource.getRepository(Server);
    const managedNodeRepo = AppDataSource.getRepository(ManagedNode);
    const addressRepo = AppDataSource.getRepository(Address);

    // Check if server exists
    const server = await serverRepo.findOne({ where: { id: serverId } });
    if (!server) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    // Check if server is healthy
    if (!server.isHealthy) {
      res.status(400).json({ error: 'Server is not healthy' });
      return;
    }

    // Check if max nodes reached
    const nodeCount = await managedNodeRepo.count({ where: { serverId: server.id } });
    if (nodeCount >= server.maxEdgeNodes) {
      res.status(400).json({ error: `Maximum number of nodes (${server.maxEdgeNodes}) reached for this server` });
      return;
    }

    // Create node on the server
    let nodeResponse;
    try {
      nodeResponse = await edgeNodeManagerService.createNode(server.ipAddress, name, keystore);
    } catch (error: any) {
      res.status(500).json({ error: `Failed to create node on server: ${error.message}` });
      return;
    }

    const nodeName = nodeResponse?.name || name;

    const nodeStatus =
      (await fetchNodeStatusWithRetry(server, nodeName)) ||
      (await edgeNodeManagerService.getNodeStatus(server.ipAddress, nodeName));

    const normalizedAddress = extractAddressFromStatus(nodeStatus);
    if (!normalizedAddress) {
      res.status(500).json({ error: 'Unable to determine node address from server response' });
      return;
    }

    let addressEntity =
      (await addressRepo.findOne({ where: { address: normalizedAddress } })) ||
      addressRepo.create({ address: normalizedAddress });

    if (!addressEntity.id) {
      addressEntity = await addressRepo.save(addressEntity);
    }

    const existingByNode = await managedNodeRepo.findOne({ where: { nodeId: nodeName } });
    const existingByAddress = await managedNodeRepo.findOne({ where: { addressId: addressEntity.id } });

    if (existingByNode || existingByAddress) {
      res.status(400).json({ error: 'A managed node with this address or node name already exists' });
      return;
    }

    const summary = extractSummaryFromStatus(nodeStatus);

    // Determine if node is running from status
    const containerStatus = nodeStatus?.container?.status?.toLowerCase();
    const metadataStatus = nodeStatus?.metadata?.status?.toLowerCase();
    const isRunning = containerStatus === 'running' || metadataStatus === 'running';

    // Get keystore if not provided
    let nodeKeystore = keystore;
    if (!nodeKeystore) {
      try {
        nodeKeystore = await edgeNodeManagerService.getNodeKeystore(server.ipAddress, nodeName);
      } catch (error) {
        console.warn('Failed to fetch keystore:', error);
      }
    }

    // Create managed node record
    const managedNode = managedNodeRepo.create({
      addressId: addressEntity.id,
      serverId: server.id,
      nodeId: nodeName,
      keystore: nodeKeystore || null,
      summary: summary || null,
      isRunning: isRunning,
    });

    const savedNode = await managedNodeRepo.save(managedNode);

    res.status(201).json({
      id: savedNode.id,
      addressId: savedNode.addressId,
      serverId: savedNode.serverId,
      nodeId: savedNode.nodeId,
      address: addressEntity.address,
      summary: savedNode.summary,
      isRunning: savedNode.isRunning,
      createdAt: savedNode.createdAt,
      updatedAt: savedNode.updatedAt,
    });
  } catch (error: any) {
    console.error('Error creating node:', error);
    res.status(500).json({ error: error.message || 'Failed to create node' });
  }
});

// Start node
router.post('/nodes/:id/start', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const nodeId = parseInt(req.params.id);
    const managedNodeRepo = AppDataSource.getRepository(ManagedNode);
    const serverRepo = AppDataSource.getRepository(Server);

    const node = await managedNodeRepo.findOne({
      where: { id: nodeId },
      relations: ['server'],
    });

    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    if (!node.server.isHealthy) {
      res.status(400).json({ error: 'Server is not healthy' });
      return;
    }

    await edgeNodeManagerService.startNode(node.server.ipAddress, node.nodeId);

    // Update isRunning status
    node.isRunning = true;
    await managedNodeRepo.save(node);

    res.json({ success: true, message: 'Node started successfully' });
  } catch (error: any) {
    console.error('Error starting node:', error);
    res.status(500).json({ error: error.message || 'Failed to start node' });
  }
});

// Stop node
router.post('/nodes/:id/stop', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const nodeId = parseInt(req.params.id);
    const managedNodeRepo = AppDataSource.getRepository(ManagedNode);
    const serverRepo = AppDataSource.getRepository(Server);

    const node = await managedNodeRepo.findOne({
      where: { id: nodeId },
      relations: ['server'],
    });

    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    if (!node.server.isHealthy) {
      res.status(400).json({ error: 'Server is not healthy' });
      return;
    }

    await edgeNodeManagerService.stopNode(node.server.ipAddress, node.nodeId);

    // Update isRunning status
    node.isRunning = false;
    await managedNodeRepo.save(node);

    res.json({ success: true, message: 'Node stopped successfully' });
  } catch (error: any) {
    console.error('Error stopping node:', error);
    res.status(500).json({ error: error.message || 'Failed to stop node' });
  }
});

// Set node fee
router.post('/nodes/:id/set-fee', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const nodeId = parseInt(req.params.id);
    const { rewardWallet, splitFee } = req.body;

    // Validate inputs
    if (!rewardWallet || typeof rewardWallet !== 'string') {
      res.status(400).json({ error: 'rewardWallet is required and must be a string' });
      return;
    }

    // Validate address format (0x followed by 40 hex characters)
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(rewardWallet)) {
      res.status(400).json({ error: 'Invalid rewardWallet address format' });
      return;
    }

    if (splitFee === undefined || splitFee === null || typeof splitFee !== 'number') {
      res.status(400).json({ error: 'splitFee is required and must be a number' });
      return;
    }

    if (!Number.isInteger(splitFee) || splitFee < 0 || splitFee > 1000) {
      res.status(400).json({ error: 'splitFee must be an integer between 0 and 1000 (0-10%)' });
      return;
    }

    const managedNodeRepo = AppDataSource.getRepository(ManagedNode);
    const serverRepo = AppDataSource.getRepository(Server);

    const node = await managedNodeRepo.findOne({
      where: { id: nodeId },
      relations: ['server'],
    });

    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    if (!node.server.isHealthy) {
      res.status(400).json({ error: 'Server is not healthy' });
      return;
    }

    try {
      const response = await edgeNodeManagerService.setRewardDistribution(
        node.server.ipAddress,
        node.nodeId,
        rewardWallet,
        splitFee
      );

      // Check if the response indicates success or failure
      if (response.success === false) {
        res.status(400).json({
          success: false,
          error: response.error || 'Failed to set reward distribution',
        });
        return;
      }

      // Success response
      res.json({
        success: true,
        transactionHash: response.transactionHash,
        message: response.message || 'Reward distribution set successfully',
      });
    } catch (error: any) {
      // Handle API errors (including insufficient TFuel)
      const errorMessage = error.message || 'Failed to set reward distribution';
      
      // Try to parse error message for insufficient TFuel
      if (errorMessage.includes('Insufficient TFuel')) {
        res.status(400).json({
          success: false,
          error: errorMessage,
        });
      } else {
        console.error('Error setting reward distribution:', error);
        res.status(500).json({
          success: false,
          error: errorMessage,
        });
      }
    }
  } catch (error: any) {
    console.error('Error setting node fee:', error);
    res.status(500).json({ error: error.message || 'Failed to set node fee' });
  }
});

// Refresh server status and node statuses
router.post('/servers/:id/refresh', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const serverId = parseInt(req.params.id);
    const serverRepo = AppDataSource.getRepository(Server);
    const managedNodeRepo = AppDataSource.getRepository(ManagedNode);
    const edgeNodeRepo = AppDataSource.getRepository(EdgeNode);
    const addressRepo = AppDataSource.getRepository(Address);

    const server = await serverRepo.findOne({ where: { id: serverId } });
    if (!server) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    // Check server health
    const isHealthy = await edgeNodeManagerService.checkServerHealth(server.ipAddress);
    server.isHealthy = isHealthy;
    await serverRepo.save(server);

    if (!isHealthy) {
      // If server is unhealthy, set all nodes to not running
      const allManagedNodesOnServer = await managedNodeRepo.find({
        where: { serverId: server.id },
      });
      for (const managedNode of allManagedNodesOnServer) {
        managedNode.isRunning = false;
        await managedNodeRepo.save(managedNode);
      }
    } else {
      // Server is healthy, update node statuses
      try {
        const nodes = await edgeNodeManagerService.listNodes(server.ipAddress);
        const seenNodeIds = new Set<string>();

        for (const node of nodes) {
          try {
            const isRunning = node.status?.toLowerCase() === 'running';
            seenNodeIds.add(node.name);

            let managedNode = await managedNodeRepo.findOne({
              where: { nodeId: node.name, serverId: server.id },
            });

            if (managedNode) {
              managedNode.isRunning = isRunning;
              await managedNodeRepo.save(managedNode);
            } else {
              // Node doesn't exist in database, create it
              let nodeStatus: NodeStatus | null = null;
              try {
                nodeStatus = await edgeNodeManagerService.getNodeStatus(server.ipAddress, node.name);
              } catch (error) {
                console.warn(`Failed to get status for node ${node.name} on ${server.ipAddress}:`, error);
                continue;
              }

              const normalizedAddress = extractAddressFromStatus(nodeStatus);
              if (!normalizedAddress) {
                console.warn(
                  `Unable to determine address for node ${node.name} on server ${server.ipAddress}`
                );
                continue;
              }

              let addressEntity = await addressRepo.findOne({ where: { address: normalizedAddress } });
              if (!addressEntity) {
                addressEntity = addressRepo.create({ address: normalizedAddress });
                addressEntity = await addressRepo.save(addressEntity);
              }

              const existingByAddress = await managedNodeRepo.findOne({
                where: { addressId: addressEntity.id },
              });
              if (existingByAddress) {
                console.warn(
                  `ManagedNode already exists for address ${normalizedAddress}, skipping creation`
                );
                continue;
              }

              let keystore: object | null = null;
              try {
                keystore = await edgeNodeManagerService.getNodeKeystore(server.ipAddress, node.name);
              } catch (error) {
                console.warn(`Failed to fetch keystore for node ${node.name}:`, error);
              }

              const summary = extractSummaryFromStatus(nodeStatus);

              managedNode = managedNodeRepo.create({
                addressId: addressEntity.id,
                serverId: server.id,
                nodeId: node.name,
                keystore: keystore || null,
                summary: summary || null,
                isRunning: isRunning,
              });

              await managedNodeRepo.save(managedNode);
            }
          } catch (error) {
            console.error(`Error processing node ${node.name} on server ${server.ipAddress}:`, error);
          }
        }

        // Update isRunning to false for nodes that exist in database but not on server
        const allManagedNodesOnServer = await managedNodeRepo.find({
          where: { serverId: server.id },
        });

        for (const managedNode of allManagedNodesOnServer) {
          if (!seenNodeIds.has(managedNode.nodeId)) {
            managedNode.isRunning = false;
            await managedNodeRepo.save(managedNode);
          }
        }

        // Update isLive in EdgeNode table for this server's nodes
        for (const managedNode of allManagedNodesOnServer) {
          try {
            const edgeNode = await edgeNodeRepo.findOne({
              where: { addressId: managedNode.addressId },
            });

            if (edgeNode) {
              edgeNode.isLive = managedNode.isRunning;
              await edgeNodeRepo.save(edgeNode);
            }
          } catch (error) {
            console.error(
              `Error updating isLive for EdgeNode with addressId ${managedNode.addressId}:`,
              error
            );
          }
        }
      } catch (error) {
        console.error(`Failed to update node statuses for server ${server.ipAddress}:`, error);
      }
    }

    // Return updated server data
    const refreshedServer = await serverRepo.findOne({
      where: { id: server.id },
      relations: ['managedNodes', 'managedNodes.address'],
    });

    const nodeCount = await managedNodeRepo.count({ where: { serverId: server.id } });

    res.json({
      id: refreshedServer!.id,
      ipAddress: refreshedServer!.ipAddress,
      isHealthy: refreshedServer!.isHealthy,
      maxEdgeNodes: refreshedServer!.maxEdgeNodes,
      currentNodeCount: nodeCount,
      managedNodes: (refreshedServer!.managedNodes || []).map((node) => ({
        id: node.id,
        nodeId: node.nodeId,
        address: node.address?.address,
        summary: node.summary,
        isRunning: node.isRunning,
      })),
      createdAt: refreshedServer!.createdAt,
      updatedAt: refreshedServer!.updatedAt,
    });
  } catch (error: any) {
    console.error('Error refreshing server:', error);
    res.status(500).json({ error: error.message || 'Failed to refresh server' });
  }
});

export default router;

