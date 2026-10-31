// Temporary connectivity probe for the Amvera PostgreSQL cluster.
// Read-only: verifies TLS behaviour, credentials and current schema state.
const { Pool } = require("pg");

const BASE =
  "postgresql://maestria:Stalkerqwe1007@maestria-lms-maestro7it.db-msk0.amvera.tech:5432/maestria";

const CASES = [
  { label: "ssl verify-off (rejectUnauthorized:false)", ssl: { rejectUnauthorized: false } },
  { label: "ssl default (verify ca)", ssl: true },
  { label: "no ssl", ssl: undefined },
];

(async () => {
  for (const c of CASES) {
    const pool = new Pool({ connectionString: BASE, ssl: c.ssl, max: 1, connectionTimeoutMillis: 15000 });
    try {
      const r = await pool.query("select current_database() as db, current_user as usr, version() as v");
      const row = r.rows[0];
      const t = await pool.query(
        "select count(*)::int as c from information_schema.tables where table_schema='public'"
      );
      const m = await pool.query(
        "select count(*)::int as c from information_schema.tables where table_name='_prisma_migrations'"
      );
      console.log(`OK   | ${c.label}`);
      console.log(`     | db=${row.db} user=${row.usr} pg=${row.v.slice(0, 28)}`);
      console.log(`     | public tables=${t.rows[0].c}, _prisma_migrations=${m.rows[0].c}`);
    } catch (e) {
      console.log(`FAIL | ${c.label} -> ${e.code || e.constructor.name}: ${String(e.message).slice(0, 160)}`);
    } finally {
      await pool.end().catch(() => {});
    }
  }
})();
