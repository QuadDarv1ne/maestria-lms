const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(process.cwd(), 'prisma', 'data.db');
console.log('DB Path:', dbPath);

try {
  const db = new Database(dbPath);
  console.log('Tables:', db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());
  console.log('Articles count:', db.prepare('SELECT COUNT(*) as count FROM Article').get());
  console.log('Published articles:', db.prepare('SELECT COUNT(*) as count FROM Article WHERE isPublished = 1').get());
  console.log('First 3 articles:', db.prepare('SELECT id, title, slug, isPublished FROM Article LIMIT 3').all());
  db.close();
} catch (err) {
  console.error('Error:', err.message);
}
