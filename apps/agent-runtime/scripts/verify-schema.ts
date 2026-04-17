import { prisma } from "@hermes/shared";

const counts = {
  memories: await prisma.memory.count(),
  documents: await prisma.document.count(),
  chunks: await prisma.documentChunk.count(),
  conversations: await prisma.conversation.count(),
  messages: await prisma.message.count(),
  events: await prisma.event.count(),
};
console.log("Table counts:", counts);

const indexes = await prisma.$queryRawUnsafe<
  Array<{ indexname: string; tablename: string }>
>(
  "SELECT indexname, tablename FROM pg_indexes WHERE indexname LIKE 'idx_%_embedding' ORDER BY indexname",
);
console.log("HNSW indexes:", indexes);

const ext = await prisma.$queryRawUnsafe<
  Array<{ extname: string; extversion: string }>
>("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'");
console.log("pgvector:", ext);

await prisma.$disconnect();
