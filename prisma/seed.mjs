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
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });

  console.log('[SEED] 🚀 Sembrando catálogo DevTalles...');
  const getImageUrl = (title) => {
    const safeTitle = encodeURIComponent(title.replace(/[:]/g, ''));
    return `https://placehold.co/800x450/111827/a855f7?text=${safeTitle}&font=Montserrat`;
  };

  const DEVTALLES_COURSES = [
    // FRONTEND
    { slug: 'angular-cero-experto', title: 'Angular: De cero a experto', level: 'BEGINNER', tags: ['frontend', 'angular', 'typescript', 'zoneless'] },
    { slug: 'react-cero-experto', title: 'React: De cero a experto', level: 'BEGINNER', tags: ['frontend', 'react', 'javascript'] },
    { slug: 'react-pro', title: 'React PRO: Arquitectura', level: 'ADVANCED', tags: ['frontend', 'react', 'architecture', 'typescript'] },
    { slug: 'nextjs-framework', title: 'Next.js: El framework de React', level: 'INTERMEDIATE', tags: ['frontend', 'react', 'nextjs', 'ssr'] },
    { slug: 'vue-js', title: 'Vue.js: De cero a experto', level: 'BEGINNER', tags: ['frontend', 'vue', 'javascript'] },
    { slug: 'qwik-cero', title: 'Qwik: Nueva generación', level: 'INTERMEDIATE', tags: ['frontend', 'qwik', 'resumability'] },
    { slug: 'solid-js', title: 'SolidJS: Reactividad pura', level: 'INTERMEDIATE', tags: ['frontend', 'solidjs', 'signals'] },
    { slug: 'rxjs-reactivo', title: 'RxJS: Programación Reactiva', level: 'ADVANCED', tags: ['frontend', 'rxjs', 'angular', 'reactive'] },
    // BACKEND
    { slug: 'nodejs-cero-experto', title: 'Node.js: De cero a experto', level: 'BEGINNER', tags: ['backend', 'node', 'javascript'] },
    { slug: 'nest-microservicios', title: 'NestJS + Microservicios', level: 'ADVANCED', tags: ['backend', 'nestjs', 'microservices', 'typescript'] },
    { slug: 'nest-cero-experto', title: 'NestJS: De cero a experto', level: 'INTERMEDIATE', tags: ['backend', 'nestjs', 'typescript', 'api'] },
    { slug: 'golang-backend', title: 'Golang: Backend Profesional', level: 'INTERMEDIATE', tags: ['backend', 'golang', 'api'] },
    { slug: 'spring-ai', title: 'Spring AI: Java Inteligente', level: 'ADVANCED', tags: ['backend', 'java', 'spring', 'ai'] },
    // DATABASE & DEVOPS
    { slug: 'sql-cero', title: 'SQL: De cero a experto', level: 'BEGINNER', tags: ['database', 'sql', 'postgresql'] },
    { slug: 'docker-guia', title: 'Docker: Guía práctica', level: 'INTERMEDIATE', tags: ['devops', 'docker', 'containers'] },
    { slug: 'git-github', title: 'Git y GitHub', level: 'BEGINNER', tags: ['tools', 'git', 'github', 'devops'] },
    { slug: 'linux-servidores', title: 'Linux para Servidores', level: 'INTERMEDIATE', tags: ['devops', 'linux', 'terminal'] },
    // MOBILE
    { slug: 'flutter-movil', title: 'Flutter: De cero a experto', level: 'BEGINNER', tags: ['mobile', 'flutter', 'dart', 'ios', 'android'] },
    { slug: 'flutter-avanzado', title: 'Flutter Avanzado', level: 'ADVANCED', tags: ['mobile', 'flutter', 'architecture'] },
    { slug: 'react-native', title: 'React Native: Nativas', level: 'INTERMEDIATE', tags: ['mobile', 'react-native', 'react'] },
    // FUNDAMENTALS & AI
    { slug: 'typescript-guia', title: 'TypeScript: Tu guía completa', level: 'BEGINNER', tags: ['frontend', 'backend', 'typescript', 'javascript'] },
    { slug: 'javascript-moderno', title: 'JavaScript Moderno', level: 'BEGINNER', tags: ['frontend', 'javascript'] },
    { slug: 'ia-developers', title: 'IA para Developers', level: 'ADVANCED', tags: ['ai', 'rag', 'claude', 'agents', 'node'] },
    { slug: 'principios-solid', title: 'Principios SOLID', level: 'INTERMEDIATE', tags: ['architecture', 'clean-code', 'solid'] },
  ];

  const courseMap = {};
  for (const course of DEVTALLES_COURSES) {
    courseMap[course.slug] = await prisma.course.upsert({
      where: { slug: course.slug },
      update: {
        title: course.title,
        level: course.level,
        tags: course.tags,
        imageUrl: getImageUrl(course.title),
        url: `https://cursos.devtalles.com/courses/${course.slug}`,
      },
      create: {
        ...course,
        description: `Aprende ${course.title} paso a paso con Fernando Herrera.`,
        imageUrl: getImageUrl(course.title),
        url: `https://cursos.devtalles.com/courses/${course.slug}`,
      },
    });
  }

  console.log('[SEED] 🧠 Generando cuestionario de perfilamiento...');
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
    const demoPath = await prisma.learningPath.upsert({
      where: { id: 'demo-path-001' },
      update: { title: 'Ruta Fullstack Node & React' },
      create: {
        id: 'demo-path-001',
        userId: admin.id,
        title: 'Ruta Fullstack Node & React',
        description: 'Grafo complejo con ramas paralelas.',
      },
    });

    // Orden FK correcto: edges antes que nodes
    await prisma.pathEdge.deleteMany({ where: { pathId: demoPath.id } });
    await prisma.pathNode.deleteMany({ where: { pathId: demoPath.id } });

    const n1 = await prisma.pathNode.create({
      data: { pathId: demoPath.id, title: 'JavaScript', type: 'DEVTALLES_COURSE', courseId: courseMap['javascript-moderno'].id },
    });
    const n2 = await prisma.pathNode.create({
      data: { pathId: demoPath.id, title: 'TypeScript', type: 'DEVTALLES_COURSE', courseId: courseMap['typescript-guia'].id },
    });
    const n3 = await prisma.pathNode.create({
      data: { pathId: demoPath.id, title: 'Node.js', type: 'DEVTALLES_COURSE', courseId: courseMap['nodejs-cero-experto'].id },
    });
    const n4 = await prisma.pathNode.create({
      data: { pathId: demoPath.id, title: 'React', type: 'DEVTALLES_COURSE', courseId: courseMap['react-cero-experto'].id },
    });
    const n5 = await prisma.pathNode.create({
      data: { pathId: demoPath.id, title: 'SOLID', type: 'DEVTALLES_COURSE', courseId: courseMap['principios-solid'].id },
    });
    const n6 = await prisma.pathNode.create({
      data: { pathId: demoPath.id, title: 'Proyecto Final MDN', type: 'EXTERNAL_LINK', externalUrl: 'https://developer.mozilla.org/es/' },
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
