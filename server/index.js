// Minimal Express server with multi-tenant PostgreSQL auth (ESM)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

// PG Pool
const sslFlag = String(process.env.PGSSL || '').trim().toLowerCase();
const useSSL = sslFlag === 'true' || sslFlag === '1' || sslFlag === 'yes' || sslFlag === 'on';
const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: 10,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

function isValidSchemaName(name) {
  return /^[a-zA-Z0-9_]+$/.test(name);
}

async function withTenantClient(tenant, fn) {
  if (!isValidSchemaName(tenant)) throw new Error('Tenant inválido');
  const client = await pool.connect();
  try {
    await client.query(`set search_path to "${tenant}", public`);
    return await fn(client);
  } finally {
    client.release();
  }
}

// Health
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('select 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Auth: login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).send('Faltan datos: email y contraseña');
  }
  try {
    // 1) Obtener esquemas tenant_* que contienen la tabla "Usuarios"
    const schemasRes = await pool.query(
      `select n.nspname as schema
       from pg_namespace n
       join pg_class c on c.relnamespace = n.oid
       where n.nspname like 'tenant_%'
         and c.relname = 'Usuarios'
         and c.relkind = 'r'`
    );
    const schemas = schemasRes.rows.map((r) => r.schema).filter(isValidSchemaName);
    if (schemas.length === 0) return res.status(401).send('Usuario o contraseña inválidos');

    let found = null;
    let foundTenant = null;
    for (const tenant of schemas) {
      try {
        const row = await withTenantClient(tenant, async (db) => {
          const q = `
            select id,
                   "Nombre" as nombre,
                   "Correo" as email,
                   "PasswordHash" as password_hash
            from "Usuarios"
            where lower("Correo") = lower($1)
            limit 1
          `;
          const r = await db.query(q, [email]);
          return r.rows[0];
        });
        if (row) {
          found = row;
          foundTenant = tenant;
          break;
        }
      } catch (_e) {
        // continuar con siguiente tenant
      }
    }

    if (!found || !foundTenant) return res.status(401).send('Usuario o contraseña inválidos');

    const ok = found.password_hash
      ? await bcrypt.compare(password, found.password_hash)
      : false; // exigir hash
    if (!ok) return res.status(401).send('Usuario o contraseña inválidos');

    const token = jwt.sign(
      { sub: found.id, tenant: foundTenant, name: found.nombre, email: found.email },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, user: { id: found.id, nombre: found.nombre, email: found.email }, tenant: foundTenant });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Middleware auth
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).send('No autorizado');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    req.tenant = payload.tenant;
    next();
  } catch (e) {
    return res.status(401).send('Token inválido');
  }
}

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: { id: req.user.sub, nombre: req.user.name, email: req.user.email }, tenant: req.user.tenant });
});

app.post('/api/auth/logout', (_req, res) => {
  res.json({ ok: true });
});

// Example protected route that uses tenant search_path for each request
app.get('/api/clientes', auth, async (req, res) => {
  try {
    const rows = await withTenantClient(req.tenant, (db) => db.query('select * from clientes order by created_at desc limit 50'));
    res.json(rows.rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

const port = Number(process.env.PORT || 3001);
// Serve static frontend in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).send('Not Found');
    res.sendFile(path.join(distPath, 'index.html'));
  });
}
app.listen(port, '0.0.0.0', () => {
  console.log(`API listening on 0.0.0.0:${port} (ENV PORT=${process.env.PORT || 'not-set'})`);
});

process.on('unhandledRejection', (reason) => {
  console.error('UnhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('UncaughtException:', err);
});
