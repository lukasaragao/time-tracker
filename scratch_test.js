const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });
prisma.user.findMany().then(console.log).catch(console.error);
