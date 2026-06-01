import { prisma } from '../lib/prisma'

async function main() {
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS schedule.crons CASCADE`)
  await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS schedule.cron_trigger_enum CASCADE`)
  await prisma.$executeRawUnsafe(`DROP TYPE IF EXISTS schedule.cron_status_enum CASCADE`)
  console.log('✅ Cleaned up old schedule objects with enum types')
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
