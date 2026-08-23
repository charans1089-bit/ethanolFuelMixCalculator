import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const TARGET_URL = 'https://charans1089-bit.github.io/ap-log-analyzer/docs.html';
const HASH_FILE = path.join(process.cwd(), 'data', 'ap-analyzer-docs-snapshot.json');
const DOCS_FILE = path.join(process.cwd(), 'docs.html');

console.log(`🔍 Checking for updates at ${TARGET_URL}...`);

try {
  const resp = await fetch(TARGET_URL, {
    headers: { 'User-Agent': 'SCRK-Docs-Sync-Bot/1.0' }
  });

  if (!resp.ok) {
    console.log(`⚠️ Remote URL returned status ${resp.status}. Skipping sync.`);
    process.exit(0);
  }

  const html = await resp.text();
  const hash = crypto.createHash('sha256').update(html).digest('hex');

  // Read cached snapshot if exists
  let snapshot = { hash: '', lastUpdated: '' };
  if (fs.existsSync(HASH_FILE)) {
    try {
      snapshot = JSON.parse(fs.readFileSync(HASH_FILE, 'utf8'));
    } catch (e) {
      console.warn('Failed to parse snapshot file, creating new one.');
    }
  }

  if (snapshot.hash === hash) {
    console.log('✅ No changes detected in AP Log Analyzer documentation.');
    process.exit(0);
  }

  console.log(`⚡ Change detected! Old hash: ${snapshot.hash.slice(0, 8)} -> New hash: ${hash.slice(0, 8)}`);

  // Extract page title and description if available
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'AP Log Analyzer Docs';
  const lastSyncDate = new Date().toISOString().split('T')[0];

  // Save new snapshot
  fs.writeFileSync(HASH_FILE, JSON.stringify({
    hash,
    lastUpdated: new Date().toISOString(),
    title
  }, null, 2));

  // Update Chapter 10 badge in docs.html
  if (fs.existsSync(DOCS_FILE)) {
    let docsHtml = fs.readFileSync(DOCS_FILE, 'utf8');

    const timestampNotice = `<!-- AP_LOG_ANALYZER_SYNC_DATE: ${lastSyncDate} -->`;
    if (!docsHtml.includes('AP_LOG_ANALYZER_SYNC_DATE')) {
      docsHtml = docsHtml.replace('<section class="doc-section" id="ap-log-analyzer">', `<section class="doc-section" id="ap-log-analyzer">\n        ${timestampNotice}`);
    } else {
      docsHtml = docsHtml.replace(/<!-- AP_LOG_ANALYZER_SYNC_DATE: [^>]+ -->/, timestampNotice);
    }

    fs.writeFileSync(DOCS_FILE, docsHtml);
    console.log(`📝 Updated ${DOCS_FILE} with sync timestamp ${lastSyncDate}`);
  }

  console.log('🎉 Sync complete!');
  process.exit(1); // Exit code 1 signals to GitHub Action that changes were made and need commit
} catch (err) {
  console.error('❌ Error during docs sync:', err.message);
  process.exit(0);
}
