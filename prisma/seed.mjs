// Idempotent RBAC + base-data seed. Plain JS (ESM) on purpose: seeding
// doesn't need a TS toolchain (ts-node/tsx), and @prisma/client already
// ships fully typed for everywhere else in the app.
//
// Usage:
//   npm run db:seed
//   npx prisma migrate reset   (runs this automatically via prisma.seed)

import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

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
  'paths:manage',
  // Domain: catalog
  'catalog:create',
  'catalog:read',
  'catalog:update',
  'catalog:delete',
  // Domain: questions
  'questions:create',
  'questions:read',
  'questions:update',
  'questions:delete',
];

const ROLE_PERMISSIONS = {
  ADMIN: PERMISSIONS,
  SYSTEM: PERMISSIONS,
  USER: ['catalog:read', 'paths:read', 'paths:create', 'paths:update', 'paths:delete'],
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
  const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim() || null;
  const adminPasswordHash = adminPassword ? await argon2.hash(adminPassword) : null;
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      roleId: roles.ADMIN.id,
      ...(adminPasswordHash ? { passwordHash: adminPasswordHash } : {}),
    },
    create: {
      email: adminEmail,
      username: adminUsername,
      displayName: 'Administrator',
      passwordHash: adminPasswordHash,
      isActive: true,
      roleId: roles.ADMIN.id,
    },
  });
  console.log(
    adminPasswordHash
      ? '[SEED] Admin password set from SEED_ADMIN_PASSWORD.'
      : '[SEED] SEED_ADMIN_PASSWORD not set - admin password login disabled.',
  );
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });

  console.log('[SEED] 🚀 Sembrando catálogo DevTalles...');
  // Generado con el scraper de cursos.devtalles.com y curado a mano.
  const catalog = JSON.parse(await readFile(new URL('./data/devtalles-courses.json', import.meta.url), 'utf8'));

  const courseMap = {};
  for (const { slug, title, description, level, tags, url, imageUrl } of catalog) {
    const data = { title, description, level, tags, url, imageUrl, isActive: true };
    courseMap[slug] = await prisma.course.upsert({
      where: { slug },
      update: data,
      create: { slug, ...data },
    });
  }

  // Se desactivan en vez de borrarse: puede haber rutas que todavía los referencian.
  const { count: retired } = await prisma.course.updateMany({
    where: { slug: { notIn: Object.keys(courseMap) }, isActive: true },
    data: { isActive: false },
  });
  console.log(`[SEED] ${catalog.length} cursos activos, ${retired} desactivados por no estar en el catálogo.`);

  console.log('[SEED] 🧠 Generando cuestionario de perfilamiento...');
  // Orden FK: answers (Restrict) antes que questions
  await prisma.answer.deleteMany({});
  await prisma.questionnaireSubmission.deleteMany({});
  await prisma.question.deleteMany({});

  const QUESTIONNAIRE = [
    {
      id: 'q1-role',
      text: '¿En qué área principal te gustaría especializarte?',
      order: 1,
      isRequired: true,
      isActive: true,
      options: [
        { text: 'Frontend (Interfaces y Web)', tagsOutput: ['frontend'] },
        { text: 'Backend (APIs y Servidores)', tagsOutput: ['backend', 'database'] },
        { text: 'Fullstack', tagsOutput: ['frontend', 'backend', 'database'] },
        { text: 'Desarrollo Móvil', tagsOutput: ['mobile'] },
        { text: 'DevOps & Arquitectura', tagsOutput: ['devops', 'architecture'] },
      ],
    },
    {
      id: 'q2-level',
      text: '¿Cuál es tu nivel actual programando?',
      order: 2,
      isRequired: true,
      isActive: true,
      options: [
        { text: 'Empezando de cero', tagsOutput: ['BEGINNER'] },
        { text: 'Junior (Conozco bases)', tagsOutput: ['INTERMEDIATE'] },
        { text: 'Mid/Senior', tagsOutput: ['ADVANCED', 'microservices', 'architecture'] },
      ],
    },
    {
      id: 'q3-framework',
      text: 'Si elegiste Frontend, ¿Qué ecosistema te llama más la atención?',
      order: 3,
      isRequired: false,
      isActive: true,
      options: [
        { text: 'React (El más popular)', tagsOutput: ['react'] },
        { text: 'Angular (Estructura empresarial)', tagsOutput: ['angular'] },
        { text: 'Vue o frameworks nuevos', tagsOutput: ['vue', 'qwik', 'solidjs'] },
      ],
    },
    {
      id: 'q4-ai',
      text: '¿Te interesa dominar la Inteligencia Artificial (LLMs, RAG)?',
      order: 4,
      isRequired: true,
      isActive: true,
      options: [
        { text: 'Sí, quiero integrarlo en mis proyectos', tagsOutput: ['ai', 'rag', 'agents'] },
        { text: 'No por ahora', tagsOutput: [] },
      ],
    },
    {
      id: 'q5-deprecated',
      text: '¿Quieres aprender PHP?',
      order: 5,
      isRequired: false,
      isActive: false,
      options: [
        { text: 'Sí', tagsOutput: ['php'] },
        { text: 'No', tagsOutput: [] },
      ],
    },
  ];

  for (const q of QUESTIONNAIRE) {
    const question = await prisma.question.create({
      data: { id: q.id, text: q.text, order: q.order, isRequired: q.isRequired, isActive: q.isActive },
    });
    await prisma.questionOption.createMany({
      data: q.options.map((opt) => ({
        questionId: question.id,
        text: opt.text,
        tagsOutput: opt.tagsOutput,
      })),
    });
  }

  console.log('[SEED] 🕸️ Construyendo grafo DAG de demostración...');
  if (admin) {
    const demoImageUrl = courseMap['javascript-moderno'].imageUrl;
    const demoPath = await prisma.learningPath.upsert({
      where: { id: 'demo-path-001' },
      update: { title: 'Ruta Fullstack Node & React', imageUrl: demoImageUrl },
      create: {
        id: 'demo-path-001',
        userId: admin.id,
        title: 'Ruta Fullstack Node & React',
        description: 'Grafo complejo con ramas paralelas.',
        imageUrl: demoImageUrl,
        isPublic: true,
      },
    });

    // Orden FK correcto: edges antes que nodes
    await prisma.pathEdge.deleteMany({ where: { pathId: demoPath.id } });
    await prisma.pathNode.deleteMany({ where: { pathId: demoPath.id } });

    const n1 = await prisma.pathNode.create({
      data: { pathId: demoPath.id, title: 'JavaScript', type: 'DEVTALLES_COURSE', courseId: courseMap['javascript-moderno'].id, position: 0 },
    });
    const n2 = await prisma.pathNode.create({
      data: { pathId: demoPath.id, title: 'TypeScript', type: 'DEVTALLES_COURSE', courseId: courseMap['typescript-guia-completa'].id, position: 1 },
    });
    const n3 = await prisma.pathNode.create({
      data: { pathId: demoPath.id, title: 'Node.js', type: 'DEVTALLES_COURSE', courseId: courseMap['nodejs-de-cero-a-experto'].id, position: 2 },
    });
    const n4 = await prisma.pathNode.create({
      data: { pathId: demoPath.id, title: 'React', type: 'DEVTALLES_COURSE', courseId: courseMap['react-de-cero'].id, position: 3 },
    });
    const n5 = await prisma.pathNode.create({
      data: { pathId: demoPath.id, title: 'SOLID', type: 'DEVTALLES_COURSE', courseId: courseMap['solid-clean-code'].id, position: 4 },
    });
    const n6 = await prisma.pathNode.create({
      data: { pathId: demoPath.id, title: 'Proyecto Final MDN', type: 'EXTERNAL_LINK', externalUrl: 'https://developer.mozilla.org/es/', position: 5 },
    });

    await prisma.pathEdge.createMany({
      data: [
        { pathId: demoPath.id, sourceNodeId: n1.id, targetNodeId: n2.id, isOptional: false },
        { pathId: demoPath.id, sourceNodeId: n2.id, targetNodeId: n3.id, isOptional: false },
        { pathId: demoPath.id, sourceNodeId: n2.id, targetNodeId: n4.id, isOptional: false },
        { pathId: demoPath.id, sourceNodeId: n3.id, targetNodeId: n5.id, isOptional: true },
        { pathId: demoPath.id, sourceNodeId: n3.id, targetNodeId: n6.id, isOptional: false },
        { pathId: demoPath.id, sourceNodeId: n4.id, targetNodeId: n6.id, isOptional: false },
      ],
    });
  }

  console.log('[SEED] ✅ Todo sembrado con éxito.');
}

main()
  .catch((err) => {
    console.error('[SEED] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
