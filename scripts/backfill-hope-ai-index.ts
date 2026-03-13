import dotenv from 'dotenv';
import { runHopeAIBackfill } from '../src/server/hope-ai/indexing/builders';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  const initiatedBy = process.env.HOPE_AI_INDEX_INITIATOR || 'manual-script';
  const result = await runHopeAIBackfill(initiatedBy);
  console.log(`Hope AI index rebuilt successfully with ${result.count} documents.`);
}

main().catch((error) => {
  console.error('Hope AI backfill failed:', error);
  process.exit(1);
});
