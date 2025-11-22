import { Router, Request, Response } from 'express';
import AppDataSource from '../database/data-source';
import { Server } from '../database/entities/Server';
import { ManagedNode } from '../database/entities/ManagedNode';
import { Address } from '../database/entities/Address';
import { AdminAuthService } from '../services/AdminAuthService';
import { EdgeNodeManagerService } from '../services/EdgeNodeManagerService';
import { adminAuthMiddleware, AuthenticatedRequest } from '../middleware/adminAuth';

const router = Router();
const adminAuthService = new AdminAuthService();
const edgeNodeManagerService = new EdgeNodeManagerService();

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
    res.cookie('adminSession', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiresAt,
    });

    res.json({ success: true, expiresAt });
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Login failed' });
  }
});

// Logout endpoint
router.post('/logout', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionToken = req.cookies?.adminSession || req.headers['x-admin-session'] as string;
    await adminAuthService.logout(sessionToken);

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

    res.status(201).json({
      id: savedServer.id,
      ipAddress: savedServer.ipAddress,
      isHealthy: savedServer.isHealthy,
      maxEdgeNodes: savedServer.maxEdgeNodes,
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
    const { serverId, name, address, keystore, summary } = req.body;

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

    // Get or create address
    let addressEntity: Address;
    if (address) {
      // Normalize address (remove 0x prefix if present, convert to lowercase)
      const normalizedAddress = address.toLowerCase().replace(/^0x/, '');
      const fullAddress = `0x${normalizedAddress}`;

      let existingAddress = await addressRepo.findOne({ where: { address: fullAddress } });
      if (!existingAddress) {
        addressEntity = addressRepo.create({ address: fullAddress });
        addressEntity = await addressRepo.save(addressEntity);
      } else {
        addressEntity = existingAddress;
      }

      // Check if managed node with this address already exists
      const existingNode = await managedNodeRepo.findOne({ where: { addressId: addressEntity.id } });
      if (existingNode) {
        res.status(400).json({ error: 'A managed node with this address already exists' });
        return;
      }
    } else {
      res.status(400).json({ error: 'address is required' });
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

    // Get keystore if not provided
    let nodeKeystore = keystore;
    if (!nodeKeystore) {
      try {
        nodeKeystore = await edgeNodeManagerService.getNodeKeystore(server.ipAddress, nodeResponse.name);
      } catch (error) {
        console.warn('Failed to fetch keystore:', error);
      }
    }

    // Create managed node record
    const managedNode = managedNodeRepo.create({
      addressId: addressEntity.id,
      serverId: server.id,
      nodeId: nodeResponse.name,
      keystore: nodeKeystore || null,
      summary: summary || null,
    });

    const savedNode = await managedNodeRepo.save(managedNode);

    res.status(201).json({
      id: savedNode.id,
      addressId: savedNode.addressId,
      serverId: savedNode.serverId,
      nodeId: savedNode.nodeId,
      address: addressEntity.address,
      summary: savedNode.summary,
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

    res.json({ success: true, message: 'Node stopped successfully' });
  } catch (error: any) {
    console.error('Error stopping node:', error);
    res.status(500).json({ error: error.message || 'Failed to stop node' });
  }
});

// Set node fee (placeholder)
router.post('/nodes/:id/set-fee', adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const nodeId = parseInt(req.params.id);
    const managedNodeRepo = AppDataSource.getRepository(ManagedNode);

    const node = await managedNodeRepo.findOne({ where: { id: nodeId } });

    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    // Placeholder implementation
    res.json({ success: true, message: 'Node fee update endpoint (placeholder)' });
  } catch (error: any) {
    console.error('Error setting node fee:', error);
    res.status(500).json({ error: error.message || 'Failed to set node fee' });
  }
});

export default router;

