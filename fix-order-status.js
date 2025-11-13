const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixOrderStatus() {
  try {
    // First, let's see what statuses exist
    const orders = await prisma.$queryRaw`SELECT DISTINCT orderStatus FROM \`order\``;
    console.log('Current order statuses:', orders);
    
    // Update all non-enum values to PREPARING
    const result = await prisma.$executeRaw`
      UPDATE \`order\` 
      SET orderStatus = 'PREPARING' 
      WHERE orderStatus NOT IN ('PREPARING', 'SHIPPED', 'DELIVERED')
    `;
    
    console.log(`Updated ${result} orders to PREPARING status`);
    
  } catch (error) {
    console.error('Error fixing order status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixOrderStatus();
