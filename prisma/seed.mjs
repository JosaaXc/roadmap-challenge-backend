// Idempotent RBAC + base-data seed. Plain JS (ESM) on purpose: seeding
// doesn't need a TS toolchain (ts-node/tsx), and @prisma/client already
// ships fully typed for everywhere else in the app.
//
// Usage:
//   npm run db:seed
//   npx prisma migrate reset   (runs this automatically via prisma.seed)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROLES = {
  ADMIN: 'Full administrative access over the platform.',
  USER: 'Standard authenticated end-user.',
  SYSTEM: 'Service-to-service / machine principal (integrations, OAuth providers).',
};

// action naming convention: '<resource>:<verb>'
const PERMISSIONS = [
  // Identity & access management
  'users:read',
  'users:update',
  'users:delete',
  'roles:manage',
  'permissions:manage',
  // Domain: learning paths
  'paths:create',
  'paths:read',
  'paths:update',
  'paths:delete',
  // Domain: catalog
  'catalog:create',
  'catalog:read',
  'catalog:update',
  'catalog:delete',
];

const ROLE_PERMISSIONS = {
  ADMIN: PERMISSIONS,
  SYSTEM: PERMISSIONS,
  USER: ['paths:read', 'catalog:read'],
};

async function main() {
  console.log('[SEED] Upserting roles...');
  const roles = {};
  for (const [name, description] of Object.entries(ROLES)) {
    roles[name] = await prisma.role.upsert({
      where: { name },
      update: { description },
      create: { name, description },
    });
  }

  console.log('[SEED] Upserting permissions...');
  const permissions = {};
  for (const action of PERMISSIONS) {
    permissions[action] = await prisma.permission.upsert({
      where: { action },
      update: {},
      create: { action },
    });
  }

  console.log('[SEED] Linking role <-> permissions...');
  for (const [roleName, actions] of Object.entries(ROLE_PERMISSIONS)) {
    for (const action of actions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roles[roleName].id,
            permissionId: permissions[action].id,
          },
        },
        update: {},
        create: {
          roleId: roles[roleName].id,
          permissionId: permissions[action].id,
        },
      });
    }
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@codequest.local';
  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? 'admin';

  console.log(`[SEED] Upserting base admin user (${adminEmail})...`);
  // passwordHash is intentionally null: password/OAuth login is not
  // implemented yet (see AuthController TODO). Set it via the password
  // reset flow once login lands.
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { roleId: roles.ADMIN.id },
    create: {
      email: adminEmail,
      username: adminUsername,
      displayName: 'Administrator',
      passwordHash: null,
      isActive: true,
      roleId: roles.ADMIN.id,
    },
  });

  console.log('[SEED] Done.');
}

main()
  .catch((err) => {
    console.error('[SEED] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
