import 'reflect-metadata';
import AppDataSource from '../src/database/data-source';
import { AdminAuthService } from '../src/services/AdminAuthService';

async function createAdminUser() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.error('Usage: ts-node scripts/create-admin-user.ts <username> <password>');
    process.exit(1);
  }

  try {
    await AppDataSource.initialize();
    const adminAuthService = new AdminAuthService();
    const user = await adminAuthService.createAdminUser(username, password);
    console.log(`✅ Admin user "${username}" created successfully with ID: ${user.id}`);
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error creating admin user:', error.message);
    await AppDataSource.destroy();
    process.exit(1);
  }
}

createAdminUser();