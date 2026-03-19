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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
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

function normalizeUsuarioRol(rawRol) {
  return String(rawRol || '').trim();
}

function normalizeUsuarioEstado(rawEstado) {
  return String(rawEstado || '').trim();
}

function normalizeRoleForAccess(rawRol) {
  return String(rawRol || '').trim().toLowerCase();
}

function isVendedorRole(rawRol) {
  return normalizeRoleForAccess(rawRol) === 'vendedor';
}

function isVendedorRequest(req) {
  return isVendedorRole(req?.user?.role ?? req?.user?.rol);
}

function getRequestUserId(req) {
  const userId = Number(req?.user?.sub);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

async function getUsuariosEnums(db) {
  const [rolesRes, estadosRes] = await Promise.all([
    db.query(
      `select enumlabel as value
       from pg_type t
       join pg_namespace n on n.oid = t.typnamespace
       join pg_enum e on t.oid = e.enumtypid
       where t.typname = 'enum_Usuarios_Rol'
         and n.nspname = 'public'
       order by e.enumsortorder`
    ),
    db.query(
      `select enumlabel as value
       from pg_type t
       join pg_namespace n on n.oid = t.typnamespace
       join pg_enum e on t.oid = e.enumtypid
       where t.typname = 'enum_Usuarios_Estado'
         and n.nspname = 'public'
       order by e.enumsortorder`
    ),
  ]);

  return {
    roles: Array.from(new Set(rolesRes.rows.map((row) => normalizeUsuarioRol(row.value)).filter(Boolean))),
    estados: Array.from(new Set(estadosRes.rows.map((row) => normalizeUsuarioEstado(row.value)).filter(Boolean))),
  };
}

function isValidSchemaName(name) {
  return /^[a-zA-Z0-9_]+$/.test(name);
}

function getErrorMessage(error) {
  if (!error) return 'Error desconocido';
  if (typeof error === 'string') return error;

  if (error instanceof AggregateError) {
    const nestedMessages = Array.isArray(error.errors)
      ? error.errors.map((item) => (item && item.message ? item.message : '')).filter(Boolean)
      : [];
    if (nestedMessages.length > 0) {
      return nestedMessages.join(' | ');
    }
    if (error.message) return error.message;
    if (error.code) return String(error.code);
    return 'Error de conexión con base de datos';
  }

  if (error.message) return error.message;
  if (error.code) return String(error.code);

  try {
    return JSON.stringify(error);
  } catch {
    return 'Error desconocido';
  }
}

function normalizeStockOptions(value) {
  if (!Array.isArray(value)) return [];
  const normalized = [];
  const seen = new Set();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const nombre = String(item.nombre || '').trim();
    if (!nombre) continue;
    const key = nombre.toLowerCase();
    if (seen.has(key)) continue;
    const cantidadRaw = Number(item.cantidad ?? 0);
    const cantidad = Number.isFinite(cantidadRaw) ? Math.max(0, Math.floor(cantidadRaw)) : 0;
    normalized.push({ nombre, cantidad });
    seen.add(key);
  }
  return normalized;
}

function sumStockOptions(options) {
  return options.reduce((acc, option) => acc + Number(option.cantidad || 0), 0);
}

function normalizeStockWithFallback(value, fallbackCantidad, fallbackNombre = 'Único') {
  const normalized = normalizeStockOptions(value);
  const cantidadRaw = Number(fallbackCantidad ?? 0);
  const cantidad = Number.isFinite(cantidadRaw) ? Math.max(0, Math.floor(cantidadRaw)) : 0;
  if (normalized.length > 0) {
    const totalNormalizado = sumStockOptions(normalized);
    if (totalNormalizado > 0 || cantidad <= 0) return normalized;

    if (normalized.length === 1) {
      return [{ ...normalized[0], cantidad }];
    }

    const base = Math.floor(cantidad / normalized.length);
    let restante = cantidad - base * normalized.length;
    return normalized.map((item) => {
      const extra = restante > 0 ? 1 : 0;
      restante = Math.max(0, restante - 1);
      return { ...item, cantidad: base + extra };
    });
  }

  if (cantidad <= 0) return [];

  return [{ nombre: fallbackNombre, cantidad }];
}

function normalizeProductImages(value) {
  if (!Array.isArray(value)) return [];
  const normalized = [];
  const seen = new Set();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const url = String(item.url || '').trim();
    if (!url) continue;
    const nombreArchivo = String(item.nombreArchivo || '').trim() || 'imagen.webp';
    const key = `${nombreArchivo}|${url}`;
    if (seen.has(key)) continue;
    normalized.push({ nombreArchivo, url });
    seen.add(key);
  }
  return normalized;
}

function normalizeProductImagesWithFallback(value, imageUrl) {
  const normalized = normalizeProductImages(value);
  if (normalized.length > 0) return normalized;

  const rawUrl = imageUrl !== null && imageUrl !== undefined ? String(imageUrl).trim() : '';
  if (!rawUrl) return [];

  return [{ nombreArchivo: 'imagen-portada.webp', url: rawUrl }];
}

async function ensureProductoVariantsSchema(db) {
  await db.query(`
    alter table if exists "Productos"
    add column if not exists "Colores" jsonb default '[]'::jsonb
  `);
  await db.query(`
    alter table if exists "Productos"
    add column if not exists "Tallas" jsonb default '[]'::jsonb
  `);
  await db.query(`
    alter table if exists "Productos"
    add column if not exists "Imagenes" jsonb default '[]'::jsonb
  `);
}

async function ensureDetalleVentaVariantSchema(db) {
  await db.query(`
    alter table if exists "DetalleVenta"
    add column if not exists "Color" text
  `);
  await db.query(`
    alter table if exists "DetalleVenta"
    add column if not exists "Talla" text
  `);
}

async function ensureClientesUsuarioSchema(db) {
  await db.query(`
    alter table if exists "Clientes"
    add column if not exists "UsuarioId" integer
  `);
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

function toUTCDateOnly(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  return new Date(Date.UTC(year, month, day));
}

function addCreditoInterval(baseDate, tipoCredito, steps) {
  const result = new Date(baseDate.getTime());
  const tipo = String(tipoCredito || '').toLowerCase();
  switch (tipo) {
    case 'diario':
      result.setUTCDate(result.getUTCDate() + steps);
      break;
    case 'semanal':
      result.setUTCDate(result.getUTCDate() + steps * 7);
      break;
    case 'quincenal':
      result.setUTCDate(result.getUTCDate() + steps * 15);
      break;
    case 'mensual':
      result.setUTCMonth(result.getUTCMonth() + steps);
      break;
    default:
      result.setUTCDate(result.getUTCDate() + steps * 30);
      break;
  }
  return result;
}

async function ensureCreditoSchema(db) {
  await db.query(`
    alter table if exists "CuotasCredito"
    add column if not exists "ValorPagado" numeric(14,2) default 0
  `);
  await db.query(`
    alter table if exists "CuotasCredito"
    add column if not exists "Estado" text default 'pendiente'
  `);
  await db.query(`
    alter table if exists "CuotasCredito"
    add column if not exists "FechaPago" date
  `);
  await db.query(`
    alter table if exists "Creditos"
    add column if not exists "MontoOriginal" numeric(14,2)
  `);
  await db.query(`
    alter table if exists "Creditos"
    add column if not exists "MontoPagado" numeric(14,2) default 0
  `);
}

function normalizeCreditoEstado(rawEstado) {
  const estado = String(rawEstado || '').toLowerCase();
  if (['activo', 'pagado', 'cancelado', 'mora'].includes(estado)) {
    return estado;
  }
  return 'activo';
}

function normalizeCuotaEstado(rawEstado) {
  const estado = String(rawEstado || '').toLowerCase();
  if (['pendiente', 'pagada', 'vencida'].includes(estado)) {
    return estado;
  }
  return 'pendiente';
}

const ESTADOS_SYNC_VENTA_ENVIO = ['pendiente', 'confirmada', 'enviada', 'entregada', 'cancelada', 'devuelta'];

function normalizeVentaEnvioEstado(rawEstado, fallback = 'pendiente') {
  const estado = String(rawEstado || '').trim().toLowerCase();
  if (ESTADOS_SYNC_VENTA_ENVIO.includes(estado)) {
    return estado;
  }
  return fallback;
}

async function syncCreditoScheduleOnEntrega(db, ventaId, estadoAnteriorRaw, estadoNuevoRaw, fechaEntregaBase = null) {
  const estadoAnterior = normalizeVentaEnvioEstado(estadoAnteriorRaw, 'pendiente');
  const estadoNuevo = normalizeVentaEnvioEstado(estadoNuevoRaw, estadoAnterior);

  if (estadoAnterior === 'entregada' || estadoNuevo !== 'entregada') {
    return;
  }

  const creditoRes = await db.query(
    `select id, "TipoCredito" as tipo_credito, "NumeroCuotas" as numero_cuotas
       from "Creditos"
      where "VentaId" = $1
      for update`,
    [ventaId]
  );

  if (creditoRes.rowCount === 0) {
    return;
  }

  const credito = creditoRes.rows[0];

  const cuotasRes = await db.query(
    `select id, "NumeroCuota" as numero_cuota, coalesce("ValorPagado", 0) as valor_pagado
       from "CuotasCredito"
      where "CreditoId" = $1
      order by "NumeroCuota"
      for update`,
    [credito.id]
  );

  if (cuotasRes.rowCount === 0) {
    return;
  }

  const tienePagosRegistrados = cuotasRes.rows.some((cuota) => Number(cuota.valor_pagado ?? 0) > 0.01);
  if (tienePagosRegistrados) {
    // Si ya existen pagos sobre cuotas, no se reprograma el calendario para evitar inconsistencias.
    return;
  }

  const fechaEntrega = fechaEntregaBase ? toUTCDateOnly(new Date(fechaEntregaBase)) : toUTCDateOnly(new Date());
  const fechaPrimerPago = addCreditoInterval(fechaEntrega, credito.tipo_credito, 1);

  await db.query(
    `update "Creditos"
       set "FechaInicio" = $2,
           "FechaPrimerPago" = $3
     where id = $1`,
    [credito.id, fechaEntrega.toISOString().slice(0, 10), fechaPrimerPago.toISOString().slice(0, 10)]
  );

  for (const cuota of cuotasRes.rows) {
    const numeroCuota = Number(cuota.numero_cuota ?? 0);
    if (numeroCuota <= 0) continue;
    const fechaVencimiento = addCreditoInterval(fechaEntrega, credito.tipo_credito, numeroCuota);
    await db.query(
      `update "CuotasCredito"
         set "FechaVencimiento" = $2,
             "Estado" = 'pendiente'
       where id = $1`,
      [cuota.id, fechaVencimiento.toISOString().slice(0, 10)]
    );
  }
}

async function fetchCreditos(db, options = {}) {
  const { ids, usuarioId } = options;
  const hasIds = Array.isArray(ids) && ids.length > 0;
  const parsedUsuarioId = Number(usuarioId);
  const hasUsuarioId = Number.isInteger(parsedUsuarioId) && parsedUsuarioId > 0;

  const whereParts = [];
  const params = [];

  if (hasIds) {
    params.push(ids);
    whereParts.push(`cr.id = ANY($${params.length}::int[])`);
  }

  if (hasUsuarioId) {
    params.push(parsedUsuarioId);
    whereParts.push(`v."UsuarioId" = $${params.length}`);
  }

  const whereClause = whereParts.length > 0 ? `where ${whereParts.join(' and ')}` : '';
  const limitClause = hasIds ? '' : 'limit 100';

  const creditosQuery = `
      select
        cr.id,
        cr."VentaId" as venta_id,
        cr."TipoCredito" as tipo_credito,
        cr."NumeroCuotas" as numero_cuotas,
        cr."CuotaInicial" as cuota_inicial,
        cr."ValorCuota" as valor_cuota,
        cr."SaldoTotal" as saldo_total,
        cr."Estado" as estado,
        cr."Calificacion" as calificacion,
        cr."FechaPrimerPago" as fecha_primer_pago,
        cr."FechaInicio" as fecha_inicio,
        cr."MontoOriginal" as monto_original,
        cr."MontoPagado" as monto_pagado,
        v."Total" as total_venta,
        coalesce(lower(e."Estado"::text), lower(v."Estado"::text), 'pendiente') as estado_entrega,
        v."ClienteId" as cliente_id,
        c."Nombres" as cliente_nombres,
        c."Apellidos" as cliente_apellidos
      from "Creditos" cr
      join "Ventas" v on v.id = cr."VentaId"
      join "Clientes" c on c.id = v."ClienteId"
      left join "Envios" e on e."VentaId" = v.id
      ${whereClause}
      order by cr.id desc
      ${limitClause}
    `;

  const creditosRes = params.length > 0 ? await db.query(creditosQuery, params) : await db.query(creditosQuery);
  const creditosRows = creditosRes.rows;
  const creditoIds = creditosRows.map((row) => row.id);

  const cuotasMap = new Map();
  if (creditoIds.length > 0) {
    const cuotasRes = await db.query(
      `
        select
          id,
          "CreditoId" as credito_id,
          "NumeroCuota" as numero_cuota,
          "FechaVencimiento" as fecha_vencimiento,
          "Valor" as valor,
          coalesce("ValorPagado", 0) as valor_pagado,
          coalesce("Estado", 'pendiente') as estado,
          "FechaPago" as fecha_pago
        from "CuotasCredito"
        where "CreditoId" = ANY($1::int[])
        order by "NumeroCuota"
      `,
      [creditoIds]
    );

    for (const cuota of cuotasRes.rows) {
      const list = cuotasMap.get(cuota.credito_id) || [];
      list.push({
        id: cuota.id,
        numeroCuota: cuota.numero_cuota,
        fechaVencimiento: cuota.fecha_vencimiento ? new Date(cuota.fecha_vencimiento).toISOString() : null,
        valor: Number(cuota.valor ?? 0),
        valorPagado: Number(cuota.valor_pagado ?? 0),
        estado: normalizeCuotaEstado(cuota.estado),
        fechaPago: cuota.fecha_pago ? new Date(cuota.fecha_pago).toISOString() : null,
      });
      cuotasMap.set(cuota.credito_id, list);
    }
  }

  const creditos = [];
  for (const row of creditosRows) {
    const cuotas = cuotasMap.get(row.id) || [];
    const cuotaInicial = Number(row.cuota_inicial ?? 0);
    const entregaConfirmada = String(row.estado_entrega || '').toLowerCase() === 'entregada';
    const cuotaInicialPagada = entregaConfirmada ? cuotaInicial : 0;
    const montoOriginal =
      row.monto_original !== null && row.monto_original !== undefined
        ? Number(row.monto_original)
        : cuotas.reduce((acc, cuota) => acc + cuota.valor, 0) + cuotaInicial;
    const montoPagadoCuotas = cuotas.reduce((acc, cuota) => acc + Math.min(cuota.valorPagado, cuota.valor), 0);
    const montoPagado = Number((montoPagadoCuotas + cuotaInicialPagada).toFixed(2));
    const montoPendiente = Math.max(Number((montoOriginal - montoPagado).toFixed(2)), 0);
    const proximaCuota = cuotas.find((cuota) => {
      const saldoCuota = Math.max(cuota.valor - cuota.valorPagado, 0.01);
      return cuota.estado !== 'pagada' || saldoCuota > 0.01;
    }) || null;

    const fechaVencimiento = cuotas
      .filter((cuota) => cuota.estado !== 'pagada' || cuota.valor - cuota.valorPagado > 0.01)
      .reduce((latest, cuota) => {
        if (!cuota.fechaVencimiento) return latest;
        if (!latest) return cuota.fechaVencimiento;
        return cuota.fechaVencimiento > latest ? cuota.fechaVencimiento : latest;
      }, null);

    const estadoNormalizado = normalizeCreditoEstado(row.estado);

    creditos.push({
      id: row.id,
      ventaId: row.venta_id,
      clienteId: row.cliente_id,
      clienteNombre: [row.cliente_nombres, row.cliente_apellidos].filter(Boolean).join(' ').trim(),
      tipoCredito: row.tipo_credito,
      numeroCuotas: Number(row.numero_cuotas ?? cuotas.length),
      cuotaInicial,
      valorCuota: Number(row.valor_cuota ?? 0),
      saldoTotal: montoPendiente,
      estado: estadoNormalizado,
      calificacion: row.calificacion ?? null,
      fechaPrimerPago: row.fecha_primer_pago ? new Date(row.fecha_primer_pago).toISOString() : null,
      fechaInicio: row.fecha_inicio ? new Date(row.fecha_inicio).toISOString() : null,
      fechaVencimiento,
      montoOriginal,
      montoPagado,
  montoPendiente,
      cuotas,
      proximaCuota,
      totalVenta: Number(row.total_venta ?? 0),
    });
  }

  return creditos;
}

async function fetchVentas(db, options = {}) {
  const { ids, usuarioId } = options;
  const hasIds = Array.isArray(ids) && ids.length > 0;
  const parsedUsuarioId = Number(usuarioId);
  const hasUsuarioId = Number.isInteger(parsedUsuarioId) && parsedUsuarioId > 0;

  const whereParts = [];
  const params = [];

  if (hasIds) {
    params.push(ids);
    whereParts.push(`v.id = ANY($${params.length}::int[])`);
  }

  if (hasUsuarioId) {
    params.push(parsedUsuarioId);
    whereParts.push(`v."UsuarioId" = $${params.length}`);
  }

  const whereClause = whereParts.length > 0 ? `where ${whereParts.join(' and ')}` : '';
  const limitClause = hasIds ? '' : 'limit 100';

  const ventasQuery = `
      select
        v.id,
        v."ClienteId" as cliente_id,
        v."UsuarioId" as usuario_id,
        v."Fecha" as fecha,
        v."TipoVenta" as tipo_venta,
        v."Total" as total,
        v."MedioPago" as medio_pago,
        v."Descuento" as descuento,
        v."Estado" as estado,
        v."Calificacion" as calificacion,
        c."Nombres" as cliente_nombres,
        c."Apellidos" as cliente_apellidos,
        u."Nombre" as usuario_nombre
      from "Ventas" v
      join "Clientes" c on c.id = v."ClienteId"
      join "Usuarios" u on u.id = v."UsuarioId"
      ${whereClause}
      order by v."Fecha" desc
      ${limitClause}
    `;

  const ventasRes = params.length > 0 ? await db.query(ventasQuery, params) : await db.query(ventasQuery);
  const ventasRows = ventasRes.rows;

  const ventaIds = ventasRows.map((row) => row.id);
  const detallesMap = new Map();

  if (ventaIds.length > 0) {
    const detallesRes = await db.query(
      `
        select
          d.id,
          d."VentaId" as venta_id,
          d."ProductoId" as producto_id,
          d."Cantidad" as cantidad,
          d."PrecioUnitario" as precio_unitario,
          d."Subtotal" as subtotal,
          d."Color" as color,
          d."Talla" as talla,
          d."IMEI" as imei,
          p."Nombre" as producto_nombre
        from "DetalleVenta" d
        join "Productos" p on p.id = d."ProductoId"
        where d."VentaId" = ANY($1::int[])
        order by d.id
      `,
      [ventaIds]
    );

    for (const row of detallesRes.rows) {
      const list = detallesMap.get(row.venta_id) || [];
      list.push({
        id: row.id,
        productoId: row.producto_id,
        productoNombre: row.producto_nombre,
        cantidad: Number(row.cantidad ?? 0),
        precioUnitario: Number(row.precio_unitario ?? 0),
        subtotal: Number(row.subtotal ?? 0),
        color: row.color ?? null,
        talla: row.talla ?? null,
        imei: row.imei ?? null,
      });
      detallesMap.set(row.venta_id, list);
    }
  }

  return ventasRows.map((row) => ({
    id: row.id,
    clienteId: row.cliente_id,
    clienteNombre: [row.cliente_nombres, row.cliente_apellidos].filter(Boolean).join(' ').trim(),
    usuarioId: row.usuario_id,
    usuarioNombre: row.usuario_nombre,
    fecha: row.fecha ? new Date(row.fecha).toISOString() : new Date().toISOString(),
    tipoVenta: row.tipo_venta,
    medioPago: row.medio_pago,
    total: Number(row.total ?? 0),
    descuento: Number(row.descuento ?? 0),
    estado: row.estado,
    calificacion: row.calificacion,
    detalles: detallesMap.get(row.id) || [],
  }));
}

// Health
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('select 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: getErrorMessage(e) });
  }
});

// Test endpoint without auth to verify frontend-backend communication
app.get('/api/test-ventas-sin-auth', async (req, res) => {
  try {
    console.log('🧪 Test endpoint called - checking ventas without auth');
    // Use a default tenant for testing - you might need to adjust this
    const result = await withTenantClient('tenant_base', async (db) => {
      const ventasQuery = `
        SELECT 
          v.id,
          v.fecha,
          v.total,
          v."TipoVenta",
          v."Estado" as venta_estado,
          c.nombres || ' ' || c.apellidos as cliente_nombre
        FROM "Ventas" v
        INNER JOIN "Clientes" c ON v."ClienteId" = c.id
  LEFT JOIN "Envios" e ON v.id = e."VentaId"
  WHERE e."VentaId" IS NULL
        ORDER BY v.fecha DESC
        LIMIT 10
      `;

      const ventasResult = await db.query(ventasQuery);
      console.log('📊 Found ventas:', ventasResult.rows.length);
      
      return {
        ventas: ventasResult.rows,
        count: ventasResult.rows.length
      };
    });

    res.json(result);
  } catch (e) {
    console.error('❌ Error in test endpoint:', e);
    res.status(500).send('Error: ' + e.message);
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
                 "PasswordHash" as password_hash,
                 "Rol"::text as rol,
                 "Estado"::text as estado,
                 "Telefono" as telefono,
                 "FechaCreacion" as fecha_creacion
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

    const estadoUsuario = normalizeUsuarioEstado(found.estado);
    if (estadoUsuario !== 'activo') {
      return res.status(403).send('Tu usuario está inactivo. Contacta al administrador.');
    }

    const token = jwt.sign(
      {
        sub: found.id,
        tenant: foundTenant,
        name: found.nombre,
        email: found.email,
        role: normalizeUsuarioRol(found.rol),
        estado: estadoUsuario,
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({
      token,
      user: {
        id: found.id,
        nombre: found.nombre,
        email: found.email,
        rol: normalizeUsuarioRol(found.rol),
        estado: estadoUsuario,
        telefono: found.telefono ?? null,
        fechaCreacion: found.fecha_creacion ? new Date(found.fecha_creacion).toISOString() : null,
      },
      tenant: foundTenant,
    });
  } catch (e) {
    res.status(500).send(getErrorMessage(e));
  }
});

// Middleware auth
async function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).send('No autorizado');
  try {
    const payload = jwt.verify(token, JWT_SECRET);

    const userId = Number(payload?.sub);
    const tenant = String(payload?.tenant || '').trim();
    if (!Number.isInteger(userId) || userId <= 0 || !isValidSchemaName(tenant)) {
      return res.status(401).send('Token inválido');
    }

    const userRow = await withTenantClient(tenant, async (db) => {
      const result = await db.query(
        `select
           "Nombre" as nombre,
           "Correo" as email,
           "Rol"::text as rol,
           "Estado"::text as estado
         from "Usuarios"
         where id = $1
         limit 1`,
        [userId]
      );
      return result.rows[0] || null;
    });

    if (!userRow) {
      return res.status(401).send('Usuario no válido');
    }

    const estadoActual = normalizeUsuarioEstado(userRow.estado);
    if (estadoActual !== 'activo') {
      return res.status(403).send('Tu usuario está inactivo. Contacta al administrador.');
    }

    payload.role = normalizeUsuarioRol(userRow.rol);
    payload.estado = estadoActual;
    payload.name = userRow.nombre ?? payload.name;
    payload.email = userRow.email ?? payload.email;

    req.user = payload;
    req.tenant = tenant;
    next();
  } catch (e) {
    return res.status(401).send('Token inválido');
  }
}

app.get('/api/auth/me', auth, (req, res) => {
  res.json({
    user: {
      id: req.user.sub,
      nombre: req.user.name,
      email: req.user.email,
      rol: req.user.role ?? null,
      estado: req.user.estado ?? 'activo',
    },
    tenant: req.user.tenant,
  });
});

app.post('/api/auth/logout', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/usuarios/metadata', auth, async (req, res) => {
  if (isVendedorRequest(req)) {
    return res.status(403).send('No autorizado para gestionar usuarios');
  }

  try {
    const metadata = await withTenantClient(req.tenant, (db) => getUsuariosEnums(db));
    res.json(metadata);
  } catch (e) {
    console.error(e);
    res.status(500).send('No se pudo obtener metadata de usuarios');
  }
});

app.get('/api/usuarios', auth, async (req, res) => {
  if (isVendedorRequest(req)) {
    return res.status(403).send('No autorizado para gestionar usuarios');
  }

  try {
    const result = await withTenantClient(req.tenant, (db) =>
      db.query(
        `select
           id,
           "Nombre" as nombre,
           "Correo" as email,
           "Rol"::text as rol,
           "Estado"::text as estado,
           "Telefono" as telefono,
           "FechaCreacion" as fecha_creacion
         from "Usuarios"
         order by "FechaCreacion" desc`
      )
    );

    const usuarios = result.rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      email: row.email,
      rol: normalizeUsuarioRol(row.rol),
      estado: normalizeUsuarioEstado(row.estado),
      telefono: row.telefono ?? null,
      fechaCreacion: row.fecha_creacion ? new Date(row.fecha_creacion).toISOString() : new Date().toISOString(),
    }));

    res.json(usuarios);
  } catch (e) {
    console.error(e);
    res.status(500).send('No se pudieron cargar los usuarios');
  }
});

app.post('/api/usuarios', auth, async (req, res) => {
  if (isVendedorRequest(req)) {
    return res.status(403).send('No autorizado para gestionar usuarios');
  }

  const { nombre, email, password, rol, estado = 'activo', telefono = null } = req.body || {};

  const nombreLimpio = String(nombre || '').trim();
  const correoLimpio = String(email || '').trim().toLowerCase();
  const passwordRaw = String(password || '');
  const rolNormalizado = normalizeUsuarioRol(rol);
  const estadoNormalizado = normalizeUsuarioEstado(estado);
  const telefonoNormalizado = telefono === null || telefono === undefined ? null : String(telefono).trim() || null;

  if (!nombreLimpio || !correoLimpio || !passwordRaw) {
    return res.status(400).send('Nombre, correo y contraseña son obligatorios');
  }

  if (passwordRaw.length < 4) {
    return res.status(400).send('La contraseña debe tener al menos 4 caracteres');
  }

  try {
    const { roles, estados } = await withTenantClient(req.tenant, (db) => getUsuariosEnums(db));

    if (!roles.includes(rolNormalizado)) {
      return res.status(400).send(`Rol inválido. Roles permitidos: ${roles.join(', ')}`);
    }

    if (!estados.includes(estadoNormalizado)) {
      return res.status(400).send(`Estado inválido. Estados permitidos: ${estados.join(', ')}`);
    }

    const passwordHash = await bcrypt.hash(passwordRaw, 10);
    const result = await withTenantClient(req.tenant, (db) =>
      db.query(
        `insert into "Usuarios" (
           "Nombre",
           "Correo",
           "PasswordHash",
           "Rol",
           "Estado",
           "FechaCreacion",
           "Telefono"
           ) values ($1, $2, $3, $4::public."enum_Usuarios_Rol", $5::public."enum_Usuarios_Estado", now(), $6)
         returning
           id,
           "Nombre" as nombre,
           "Correo" as email,
           "Rol"::text as rol,
           "Estado"::text as estado,
           "Telefono" as telefono,
           "FechaCreacion" as fecha_creacion`,
        [nombreLimpio, correoLimpio, passwordHash, rolNormalizado, estadoNormalizado, telefonoNormalizado]
      )
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      nombre: row.nombre,
      email: row.email,
      rol: normalizeUsuarioRol(row.rol),
      estado: normalizeUsuarioEstado(row.estado),
      telefono: row.telefono ?? null,
      fechaCreacion: row.fecha_creacion ? new Date(row.fecha_creacion).toISOString() : new Date().toISOString(),
    });
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === '23505') {
      return res.status(409).send('Ya existe un usuario con ese correo');
    }
    console.error(e);
    res.status(500).send('No se pudo crear el usuario');
  }
});

app.put('/api/usuarios/:id', auth, async (req, res) => {
  if (isVendedorRequest(req)) {
    return res.status(403).send('No autorizado para gestionar usuarios');
  }

  const usuarioId = Number(req.params.id);
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return res.status(400).send('Usuario inválido');
  }

  const { nombre, email, password, rol, estado, telefono } = req.body || {};

  try {
    const { roles, estados } = await withTenantClient(req.tenant, (db) => getUsuariosEnums(db));

    if (rol !== undefined && !roles.includes(normalizeUsuarioRol(rol))) {
      return res.status(400).send(`Rol inválido. Roles permitidos: ${roles.join(', ')}`);
    }

    if (estado !== undefined && !estados.includes(normalizeUsuarioEstado(estado))) {
      return res.status(400).send(`Estado inválido. Estados permitidos: ${estados.join(', ')}`);
    }

    const updated = await withTenantClient(req.tenant, async (db) => {
      await db.query('BEGIN');
      try {
        const currentRes = await db.query(
          `select
             id,
             "Nombre" as nombre,
             "Correo" as email,
             "Rol"::text as rol,
             "Estado"::text as estado,
             "Telefono" as telefono,
             "PasswordHash" as password_hash,
             "FechaCreacion" as fecha_creacion
           from "Usuarios"
           where id = $1
           for update`,
          [usuarioId]
        );

        if (currentRes.rowCount === 0) {
          await db.query('ROLLBACK');
          return null;
        }

        const current = currentRes.rows[0];
        const nombreValue = nombre === undefined ? current.nombre : String(nombre || '').trim();
        const emailValue = email === undefined ? current.email : String(email || '').trim().toLowerCase();
        const rolValue = rol === undefined ? normalizeUsuarioRol(current.rol) : normalizeUsuarioRol(rol);
        const estadoValue = estado === undefined ? normalizeUsuarioEstado(current.estado) : normalizeUsuarioEstado(estado);
        const telefonoValue = telefono === undefined ? (current.telefono ?? null) : (telefono === null ? null : String(telefono).trim() || null);

        if (!nombreValue || !emailValue) {
          const err = new Error('Nombre y correo son obligatorios');
          err.statusCode = 400;
          throw err;
        }

        let passwordHashValue = current.password_hash;
        if (password !== undefined && password !== null && String(password).trim() !== '') {
          const passwordRaw = String(password);
          if (passwordRaw.length < 4) {
            const err = new Error('La contraseña debe tener al menos 4 caracteres');
            err.statusCode = 400;
            throw err;
          }
          passwordHashValue = await bcrypt.hash(passwordRaw, 10);
        }

        const result = await db.query(
          `update "Usuarios"
             set
               "Nombre" = $1,
               "Correo" = $2,
               "PasswordHash" = $3,
               "Rol" = $4::public."enum_Usuarios_Rol",
               "Estado" = $5::public."enum_Usuarios_Estado",
               "Telefono" = $6
           where id = $7
           returning
             id,
             "Nombre" as nombre,
             "Correo" as email,
             "Rol"::text as rol,
             "Estado"::text as estado,
             "Telefono" as telefono,
             "FechaCreacion" as fecha_creacion`,
          [nombreValue, emailValue, passwordHashValue, rolValue, estadoValue, telefonoValue, usuarioId]
        );

        await db.query('COMMIT');
        return result.rows[0];
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    });

    if (!updated) {
      return res.status(404).send('Usuario no encontrado');
    }

    res.json({
      id: updated.id,
      nombre: updated.nombre,
      email: updated.email,
      rol: normalizeUsuarioRol(updated.rol),
      estado: normalizeUsuarioEstado(updated.estado),
      telefono: updated.telefono ?? null,
      fechaCreacion: updated.fecha_creacion ? new Date(updated.fecha_creacion).toISOString() : new Date().toISOString(),
    });
  } catch (e) {
    if (e instanceof Error && e.statusCode === 400) {
      return res.status(400).send(e.message);
    }
    if (e && typeof e === 'object' && 'code' in e && e.code === '23505') {
      return res.status(409).send('Ya existe un usuario con ese correo');
    }
    console.error(e);
    res.status(500).send('No se pudo actualizar el usuario');
  }
});

app.delete('/api/usuarios/:id', auth, async (req, res) => {
  if (isVendedorRequest(req)) {
    return res.status(403).send('No autorizado para gestionar usuarios');
  }

  const usuarioId = Number(req.params.id);
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return res.status(400).send('Usuario inválido');
  }

  if (Number(req.user?.sub) === usuarioId) {
    return res.status(409).send('No puedes eliminar tu propio usuario en sesión');
  }

  try {
    const deleted = await withTenantClient(req.tenant, async (db) => {
      const result = await db.query(`delete from "Usuarios" where id = $1 returning id`, [usuarioId]);
      return result.rowCount > 0;
    });

    if (!deleted) {
      return res.status(404).send('Usuario no encontrado');
    }

    res.json({ deleted: true });
  } catch (e) {
    console.error(e);
    res.status(500).send('No se pudo eliminar el usuario');
  }
});

// Example protected route that uses tenant search_path for each request
app.get('/api/clientes', auth, async (req, res) => {
  const vendedor = isVendedorRequest(req);
  const userId = getRequestUserId(req);
  if (vendedor && !userId) {
    return res.status(401).send('Usuario inválido para consultar clientes');
  }

  try {
    const result = await withTenantClient(req.tenant, async (db) => {
      await ensureClientesUsuarioSchema(db);

      const params = [];
      const whereClause = vendedor
        ? (() => {
            params.push(userId);
            return `where "UsuarioId" = $${params.length}`;
          })()
        : '';

      return db.query(
        `select
           id,
           "Nombres" as nombres,
           "Apellidos" as apellidos,
           "TipoIdentificacion" as tipo_identificacion,
           "NumeroDocumento" as numero_documento,
           "Telefono" as telefono,
           "Direccion" as direccion,
           "Correo" as correo,
           "FechaRegistro" as fecha_registro,
           "Ciudad" as ciudad,
           "Departamento" as departamento,
           "Calificacion" as calificacion,
           "Barrio" as barrio,
           modo_chat,
           "UsuarioId" as usuario_id
         from "Clientes"
         ${whereClause}
         order by "FechaRegistro" desc
         limit 200`
        ,
        params
      );
    });

    const rows = result.rows.map((row) => ({
      id: row.id,
      nombres: row.nombres,
      apellidos: row.apellidos,
      tipoIdentificacion: row.tipo_identificacion,
      numeroDocumento: row.numero_documento,
      telefono: row.telefono,
      direccion: row.direccion,
      correo: row.correo,
      fechaRegistro: row.fecha_registro ? new Date(row.fecha_registro).toISOString() : null,
      ciudad: row.ciudad,
      departamento: row.departamento,
      calificacion: row.calificacion,
      barrio: row.barrio,
      modoChat: row.modo_chat,
    }));

    res.json(rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.post('/api/clientes', auth, async (req, res) => {
  const {
    nombres,
    apellidos,
    tipoIdentificacion,
    numeroDocumento,
    telefono = null,
    direccion = null,
    correo = null,
    fechaRegistro = null,
    ciudad = null,
    departamento = null,
    calificacion = null,
    barrio = null,
    modoChat = null,
  } = req.body || {};

  if (!nombres || !apellidos || !tipoIdentificacion || !numeroDocumento) {
    return res.status(400).send('Faltan datos obligatorios');
  }

  const fecha = fechaRegistro ? new Date(fechaRegistro) : new Date();
  if (Number.isNaN(fecha.getTime())) {
    return res.status(400).send('Fecha de registro inválida');
  }

  const payload = {
    nombres,
    apellidos,
    tipoIdentificacion,
    numeroDocumento,
    telefono,
    direccion,
    correo,
    fechaRegistro: fecha.toISOString(),
    ciudad,
    departamento,
    calificacion: calificacion ?? 'Pendiente',
    barrio,
    modoChat: modoChat ?? 'modo robot',
  };

  const columns = [
    '"Nombres"',
    '"Apellidos"',
    '"TipoIdentificacion"',
    '"NumeroDocumento"',
    '"Telefono"',
    '"Direccion"',
    '"Correo"',
    '"FechaRegistro"',
    '"Ciudad"',
    '"Departamento"',
    '"Calificacion"',
    '"Barrio"',
    'modo_chat',
    '"UsuarioId"',
  ];

  const values = [
    payload.nombres,
    payload.apellidos,
    payload.tipoIdentificacion,
    payload.numeroDocumento,
    payload.telefono,
    payload.direccion,
    payload.correo,
    payload.fechaRegistro,
    payload.ciudad,
    payload.departamento,
    payload.calificacion,
    payload.barrio,
    payload.modoChat,
    getRequestUserId(req),
  ];

  try {
    const result = await withTenantClient(req.tenant, async (db) => {
      await ensureClientesUsuarioSchema(db);

      return db.query(
        `insert into "Clientes" (${columns.join(', ')})
         values (${columns.map((_, idx) => `$${idx + 1}`).join(', ')})
         returning
           id,
           "Nombres" as nombres,
           "Apellidos" as apellidos,
           "TipoIdentificacion" as tipo_identificacion,
           "NumeroDocumento" as numero_documento,
           "Telefono" as telefono,
           "Direccion" as direccion,
           "Correo" as correo,
           "FechaRegistro" as fecha_registro,
           "Ciudad" as ciudad,
           "Departamento" as departamento,
           "Calificacion" as calificacion,
           "Barrio" as barrio,
           modo_chat,
           "UsuarioId" as usuario_id
        `,
        values
      );
    });

    const row = result.rows[0];
    const cliente = {
      id: row.id,
      nombres: row.nombres,
      apellidos: row.apellidos,
      tipoIdentificacion: row.tipo_identificacion,
      numeroDocumento: row.numero_documento,
      telefono: row.telefono,
      direccion: row.direccion,
      correo: row.correo,
      fechaRegistro: row.fecha_registro ? new Date(row.fecha_registro).toISOString() : null,
      ciudad: row.ciudad,
      departamento: row.departamento,
      calificacion: row.calificacion,
      barrio: row.barrio,
      modoChat: row.modo_chat,
    };

    res.status(201).json(cliente);
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === '23505') {
      return res.status(409).send('Ya existe un cliente con ese número de documento');
    }
    console.error(e);
    res.status(500).send('No se pudo crear el cliente');
  }
});

app.put('/api/clientes/:id', auth, async (req, res) => {
  const vendedor = isVendedorRequest(req);
  const userId = getRequestUserId(req);
  if (vendedor && !userId) {
    return res.status(401).send('Usuario inválido para actualizar clientes');
  }

  const clienteId = Number(req.params.id);
  if (!Number.isInteger(clienteId) || clienteId <= 0) {
    return res.status(400).send('Cliente inválido');
  }

  const {
    nombres,
    apellidos,
    tipoIdentificacion,
    numeroDocumento,
    telefono = null,
    direccion = null,
    correo = null,
    fechaRegistro = null,
    ciudad = null,
    departamento = null,
    calificacion = null,
    barrio = null,
    modoChat = null,
  } = req.body || {};

  if (!nombres || !apellidos || !tipoIdentificacion || !numeroDocumento) {
    return res.status(400).send('Faltan datos obligatorios');
  }

  const trimmed = {
    nombres: String(nombres).trim(),
    apellidos: String(apellidos).trim(),
    tipoIdentificacion: String(tipoIdentificacion).trim(),
    numeroDocumento: String(numeroDocumento).trim(),
    telefono: telefono === null || telefono === undefined ? null : String(telefono).trim(),
    direccion: direccion === null || direccion === undefined ? null : String(direccion).trim(),
    correo: correo === null || correo === undefined ? null : String(correo).trim(),
    ciudad: ciudad === null || ciudad === undefined ? null : String(ciudad).trim(),
    departamento: departamento === null || departamento === undefined ? null : String(departamento).trim(),
    calificacion: calificacion === null || calificacion === undefined ? null : String(calificacion).trim(),
    barrio: barrio === null || barrio === undefined ? null : String(barrio).trim(),
    modoChat: modoChat === null || modoChat === undefined ? null : String(modoChat).trim(),
  };

  try {
    const updated = await withTenantClient(req.tenant, async (db) => {
      await ensureClientesUsuarioSchema(db);
      await db.query('BEGIN');
      try {
        const currentRes = await db.query(
          `select
             id,
             "Nombres" as nombres,
             "Apellidos" as apellidos,
             "TipoIdentificacion" as tipo_identificacion,
             "NumeroDocumento" as numero_documento,
             "Telefono" as telefono,
             "Direccion" as direccion,
             "Correo" as correo,
             "FechaRegistro" as fecha_registro,
             "Ciudad" as ciudad,
             "Departamento" as departamento,
             "Calificacion" as calificacion,
             "Barrio" as barrio,
             modo_chat,
             "UsuarioId" as usuario_id
           from "Clientes"
           where id = $1
           for update`,
          [clienteId]
        );

        if (currentRes.rowCount === 0) {
          await db.query('ROLLBACK');
          return null;
        }

        const current = currentRes.rows[0];
        if (vendedor && Number(current.usuario_id) !== userId) {
          await db.query('ROLLBACK');
          const err = new Error('No autorizado para modificar este cliente');
          err.statusCode = 403;
          throw err;
        }
        const fechaValueRaw = fechaRegistro
          ? new Date(fechaRegistro)
          : current.fecha_registro
          ? new Date(current.fecha_registro)
          : null;

        if (fechaValueRaw && Number.isNaN(fechaValueRaw.getTime())) {
          const err = new Error('Fecha de registro inválida');
          err.statusCode = 400;
          throw err;
        }

        const fechaValue = fechaValueRaw ? fechaValueRaw.toISOString() : null;

        const values = [
          trimmed.nombres,
          trimmed.apellidos,
          trimmed.tipoIdentificacion,
          trimmed.numeroDocumento,
          trimmed.telefono,
          trimmed.direccion,
          trimmed.correo,
          fechaValue,
          trimmed.ciudad,
          trimmed.departamento,
          trimmed.calificacion ?? current.calificacion,
          trimmed.barrio,
          trimmed.modoChat ?? current.modo_chat,
          clienteId,
        ];

        const result = await db.query(
          `update "Clientes"
             set
               "Nombres" = $1,
               "Apellidos" = $2,
               "TipoIdentificacion" = $3,
               "NumeroDocumento" = $4,
               "Telefono" = $5,
               "Direccion" = $6,
               "Correo" = $7,
               "FechaRegistro" = $8,
               "Ciudad" = $9,
               "Departamento" = $10,
               "Calificacion" = $11,
               "Barrio" = $12,
               modo_chat = $13
           where id = $14
           returning
             id,
             "Nombres" as nombres,
             "Apellidos" as apellidos,
             "TipoIdentificacion" as tipo_identificacion,
             "NumeroDocumento" as numero_documento,
             "Telefono" as telefono,
             "Direccion" as direccion,
             "Correo" as correo,
             "FechaRegistro" as fecha_registro,
             "Ciudad" as ciudad,
             "Departamento" as departamento,
             "Calificacion" as calificacion,
             "Barrio" as barrio,
             modo_chat
          `,
          values
        );

        await db.query('COMMIT');
        return result.rows[0];
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    });

    if (!updated) {
      return res.status(404).send('Cliente no encontrado');
    }

    const cliente = {
      id: updated.id,
      nombres: updated.nombres,
      apellidos: updated.apellidos,
      tipoIdentificacion: updated.tipo_identificacion,
      numeroDocumento: updated.numero_documento,
      telefono: updated.telefono,
      direccion: updated.direccion,
      correo: updated.correo,
      fechaRegistro: updated.fecha_registro ? new Date(updated.fecha_registro).toISOString() : null,
      ciudad: updated.ciudad,
      departamento: updated.departamento,
      calificacion: updated.calificacion,
      barrio: updated.barrio,
      modoChat: updated.modo_chat,
    };

    res.json(cliente);
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === '23505') {
      return res.status(409).send('Ya existe un cliente con ese número de documento');
    }
    if (e instanceof Error && e.statusCode === 403) {
      return res.status(403).send(e.message);
    }
    if (e instanceof Error && e.statusCode === 400) {
      return res.status(400).send(e.message);
    }
    console.error(e);
    res.status(500).send('No se pudo actualizar el cliente');
  }
});

app.delete('/api/clientes/:id', auth, async (req, res) => {
  const vendedor = isVendedorRequest(req);
  const userId = getRequestUserId(req);
  if (vendedor && !userId) {
    return res.status(401).send('Usuario inválido para eliminar clientes');
  }

  const clienteId = Number(req.params.id);
  if (!Number.isInteger(clienteId) || clienteId <= 0) {
    return res.status(400).send('Cliente inválido');
  }

  try {
    const deleted = await withTenantClient(req.tenant, async (db) => {
      await ensureClientesUsuarioSchema(db);
      await db.query('BEGIN');
      try {
        const clienteRes = await db.query(`select id, "UsuarioId" as usuario_id from "Clientes" where id = $1 for update`, [clienteId]);
        if (clienteRes.rowCount === 0) {
          await db.query('ROLLBACK');
          return null;
        }

        if (vendedor && Number(clienteRes.rows[0].usuario_id) !== userId) {
          await db.query('ROLLBACK');
          const err = new Error('No autorizado para eliminar este cliente');
          err.statusCode = 403;
          throw err;
        }

        const ventasRes = await db.query(
          `select count(*)::int as total
           from "Ventas"
           where "ClienteId" = $1`,
          [clienteId]
        );

        const totalVentas = ventasRes.rows[0]?.total ?? 0;
        if (totalVentas > 0) {
          await db.query('ROLLBACK');
          const err = new Error('No se puede eliminar el cliente porque tiene ventas registradas');
          err.statusCode = 409;
          throw err;
        }

        await db.query(`delete from "Clientes" where id = $1`, [clienteId]);
        await db.query('COMMIT');
        return true;
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    });

    if (deleted === null) {
      return res.status(404).send('Cliente no encontrado');
    }

    res.json({ deleted: true });
  } catch (e) {
    if (e instanceof Error && e.statusCode === 403) {
      return res.status(403).send(e.message);
    }
    if (e instanceof Error && e.statusCode === 409) {
      return res.status(409).send(e.message);
    }
    console.error(e);
    res.status(500).send('No se pudo eliminar el cliente');
  }
});

app.get('/api/ventas/metadata', auth, async (_req, res) => {
  try {
    const [
      tiposVentaResult,
      mediosPagoResult,
      estadosResult,
      tiposCreditoResult,
      estadosCreditoResult,
      calificacionesResult,
      estadosCuotaResult,
    ] = await Promise.all([
      pool.query(
        `select enumlabel as value
         from pg_type t
         join pg_enum e on t.oid = e.enumtypid
         where t.typname = 'enum_Ventas_TipoVenta'
         order by e.enumsortorder`
      ),
      pool.query(
        `select enumlabel as value
         from pg_type t
         join pg_enum e on t.oid = e.enumtypid
         where t.typname = 'enum_medio_pago'
         order by e.enumsortorder`
      ),
      pool.query(
        `select enumlabel as value
         from pg_type t
         join pg_enum e on t.oid = e.enumtypid
         where t.typname = 'enum_ventas_estado'
         order by e.enumsortorder`
       ),
      pool.query(
        `select enumlabel as value
         from pg_type t
         join pg_enum e on t.oid = e.enumtypid
         where t.typname = 'enum_Creditos_TipoCredito'
         order by e.enumsortorder`
      ),
      pool.query(
        `select enumlabel as value
         from pg_type t
         join pg_enum e on t.oid = e.enumtypid
         where t.typname = 'enum_Creditos_Estado'
         order by e.enumsortorder`
      ),
      pool.query(
        `select enumlabel as value
         from pg_type t
         join pg_enum e on t.oid = e.enumtypid
         where t.typname = 'enum_clientes_calificacion'
         order by e.enumsortorder`
      ),
      pool.query(
        `select enumlabel as value
         from pg_type t
         join pg_enum e on t.oid = e.enumtypid
         where t.typname = 'enum_CuotasCredito_Estado'
         order by e.enumsortorder`
      ),
    ]);

    const tiposVenta = Array.from(new Set(tiposVentaResult.rows.map((row) => row.value)));
    const mediosPago = Array.from(new Set(mediosPagoResult.rows.map((row) => row.value)));
    const estados = Array.from(new Set(estadosResult.rows.map((row) => row.value)));
    const tiposCredito = Array.from(new Set(tiposCreditoResult.rows.map((row) => row.value)));
    const estadosCredito = Array.from(new Set(estadosCreditoResult.rows.map((row) => row.value)));
    const calificacionesCredito = Array.from(new Set(calificacionesResult.rows.map((row) => row.value)));
    const estadosCuotaCredito = Array.from(new Set(estadosCuotaResult.rows.map((row) => row.value)));

    res.json({ tiposVenta, mediosPago, estados, tiposCredito, estadosCredito, calificacionesCredito, estadosCuotaCredito });
  } catch (e) {
    console.error(e);
    res.status(500).send('No se pudo obtener la configuración de ventas');
  }
});

app.get('/api/ventas', auth, async (req, res) => {
  const vendedor = isVendedorRequest(req);
  const userId = getRequestUserId(req);
  if (vendedor && !userId) {
    return res.status(401).send('Usuario inválido para consultar ventas');
  }

  try {
    const ventas = await withTenantClient(req.tenant, (db) =>
      fetchVentas(db, vendedor ? { usuarioId: userId } : undefined)
    );
    res.json(ventas);
  } catch (e) {
    console.error(e);
    res.status(500).send('No se pudieron cargar las ventas');
  }
});

app.get('/api/creditos', auth, async (req, res) => {
  const vendedor = isVendedorRequest(req);
  const userId = getRequestUserId(req);
  if (vendedor && !userId) {
    return res.status(401).send('Usuario inválido para consultar créditos');
  }

  try {
    const creditos = await withTenantClient(req.tenant, async (db) => {
      await ensureCreditoSchema(db);
      return fetchCreditos(db, vendedor ? { usuarioId: userId } : undefined);
    });

    const stats = creditos.reduce(
      (acc, credito) => {
        acc.totalCreditos += 1;
        acc.montoOtorgado += credito.montoOriginal;
        acc.montoCobrado += credito.montoPagado;
        acc.montoPendiente += credito.montoPendiente;
        const hoy = toUTCDateOnly(new Date());
        const tieneCuotaVencida = credito.cuotas.some((cuota) => {
          if (!cuota.fechaVencimiento) return false;
          const fecha = new Date(cuota.fechaVencimiento);
          const vencida = fecha < hoy && Math.max(cuota.valor - cuota.valorPagado, 0) > 0.01;
          return vencida;
        });
        if (tieneCuotaVencida) {
          acc.creditosVencidos += 1;
        }
        return acc;
      },
      { totalCreditos: 0, montoOtorgado: 0, montoCobrado: 0, montoPendiente: 0, creditosVencidos: 0 }
    );

    res.json({ stats, creditos });
  } catch (e) {
    console.error(e);
    res.status(500).send('No se pudieron cargar los créditos');
  }
});

app.post('/api/creditos/:id/pagos', auth, async (req, res) => {
  const vendedor = isVendedorRequest(req);
  const userId = getRequestUserId(req);
  if (vendedor && !userId) {
    return res.status(401).send('Usuario inválido para registrar pagos');
  }

  const creditoId = Number(req.params.id);
  if (!Number.isInteger(creditoId) || creditoId <= 0) {
    return res.status(400).send('Crédito inválido');
  }

  const { monto, fechaPago = null } = req.body || {};
  const montoPago = Number(monto);
  if (!Number.isFinite(montoPago) || montoPago <= 0) {
    return res.status(400).send('El monto del pago debe ser mayor que cero');
  }

  const fechaPagoDate = fechaPago ? new Date(fechaPago) : new Date();
  if (Number.isNaN(fechaPagoDate.getTime())) {
    return res.status(400).send('La fecha de pago es inválida');
  }

  try {
    const resultado = await withTenantClient(req.tenant, async (db) => {
      await ensureCreditoSchema(db);
      await db.query('BEGIN');
      try {
        const creditoRes = await db.query(
          `select
             id,
             "VentaId" as venta_id,
             v."UsuarioId" as venta_usuario_id,
             "SaldoTotal" as saldo_total,
             "CuotaInicial" as cuota_inicial,
             "MontoOriginal" as monto_original,
             "MontoPagado" as monto_pagado,
             "Estado" as estado
           from "Creditos" cr
           join "Ventas" v on v.id = cr."VentaId"
           where cr.id = $1
           for update`,
          [creditoId]
        );

        if (creditoRes.rowCount === 0) {
          await db.query('ROLLBACK');
          return null;
        }

        const creditoRow = creditoRes.rows[0];

        if (vendedor && Number(creditoRow.venta_usuario_id) !== userId) {
          await db.query('ROLLBACK');
          const err = new Error('No autorizado para registrar pagos en este crédito');
          err.statusCode = 403;
          throw err;
        }

        const cuotasRes = await db.query(
          `select
             id,
             "NumeroCuota" as numero_cuota,
             "Valor" as valor,
             coalesce("ValorPagado", 0) as valor_pagado,
             coalesce("Estado", 'pendiente') as estado,
             "FechaVencimiento" as fecha_vencimiento
           from "CuotasCredito"
           where "CreditoId" = $1
           order by "NumeroCuota"
           for update`,
          [creditoId]
        );

        if (cuotasRes.rowCount === 0) {
          await db.query('ROLLBACK');
          throw new Error('El crédito no tiene cuotas configuradas');
        }

        const cuotas = cuotasRes.rows.map((row) => ({
          ...row,
          valor: Number(row.valor ?? 0),
          valor_pagado: Number(row.valor_pagado ?? 0),
          estado: normalizeCuotaEstado(row.estado),
        }));

        let restante = Number(montoPago.toFixed(2));
        const fechaPagoISO = toUTCDateOnly(fechaPagoDate).toISOString().slice(0, 10);

        for (const cuota of cuotas) {
          if (restante <= 0.01) break;

          const saldoCuota = Math.max(Number((cuota.valor - cuota.valor_pagado).toFixed(2)), 0);
          if (saldoCuota <= 0.01 && cuota.estado === 'pagada') {
            continue;
          }

          if (restante + cuota.valor_pagado < cuota.valor - 0.01) {
            const nuevoValorPagado = Number((cuota.valor_pagado + restante).toFixed(2));
            await db.query(
              `update "CuotasCredito"
                 set "ValorPagado" = $2,
                     "Estado" = $3
               where id = $1`,
              [cuota.id, nuevoValorPagado, 'pendiente']
            );
            cuota.valor_pagado = nuevoValorPagado;
            cuota.estado = 'pendiente';
            restante = 0;
            break;
          }

          const pagoAplicado = saldoCuota;
          const nuevoValorPagado = Number((cuota.valor_pagado + pagoAplicado).toFixed(2));
          await db.query(
            `update "CuotasCredito"
               set "ValorPagado" = $2,
                   "Estado" = $3,
                   "FechaPago" = $4
             where id = $1`,
            [cuota.id, nuevoValorPagado, 'pagada', fechaPagoISO]
          );
          cuota.valor_pagado = nuevoValorPagado;
          cuota.estado = 'pagada';
          restante = Number((restante - pagoAplicado).toFixed(2));
        }

        // Si aún queda saldo por aplicar, distribuye sobre las siguientes cuotas reduciendo su valor
        if (restante > 0.01) {
          for (const cuota of cuotas) {
            if (restante <= 0.01) break;
            const saldoCuota = Math.max(Number((cuota.valor - cuota.valor_pagado).toFixed(2)), 0);
            if (saldoCuota <= 0.01 && cuota.estado === 'pagada') continue;

            if (restante >= saldoCuota && saldoCuota > 0.01) {
              const nuevoValorPagado = Number((cuota.valor_pagado + saldoCuota).toFixed(2));
              await db.query(
                `update "CuotasCredito"
                   set "ValorPagado" = $2,
                       "Estado" = $3,
                       "FechaPago" = $4
                 where id = $1`,
                [cuota.id, nuevoValorPagado, 'pagada', fechaPagoISO]
              );
              cuota.valor_pagado = nuevoValorPagado;
              cuota.estado = 'pagada';
              restante = Number((restante - saldoCuota).toFixed(2));
              continue;
            }

            if (restante > 0.01) {
              const nuevoValorPagado = Number((cuota.valor_pagado + restante).toFixed(2));
              await db.query(
                `update "CuotasCredito"
                   set "ValorPagado" = $2,
                       "Estado" = $3
                 where id = $1`,
                [cuota.id, nuevoValorPagado, 'pendiente']
              );
              cuota.valor_pagado = nuevoValorPagado;
              cuota.estado = 'pendiente';
              restante = 0;
              break;
            }
          }
        }

        const cuotaInicial = Number(creditoRow.cuota_inicial ?? 0);
        const entregaRes = await db.query(
          `select coalesce(lower(e."Estado"::text), lower(v."Estado"::text), 'pendiente') as estado_entrega
             from "Ventas" v
             left join "Envios" e on e."VentaId" = v.id
            where v.id = $1
            limit 1`,
          [creditoRow.venta_id]
        );
        const entregaConfirmada =
          entregaRes.rowCount > 0 && String(entregaRes.rows[0].estado_entrega || '').toLowerCase() === 'entregada';
        const cuotaInicialPagada = entregaConfirmada ? cuotaInicial : 0;
        const montoOriginal =
          creditoRow.monto_original !== null && creditoRow.monto_original !== undefined
            ? Number(creditoRow.monto_original)
            : cuotas.reduce((acc, cuota) => acc + cuota.valor, 0) + cuotaInicial;
        const montoPagadoCuotas = cuotas.reduce(
          (acc, cuota) => acc + Math.min(cuota.valor_pagado, cuota.valor),
          0
        );
        const montoPagadoTotal = Number((montoPagadoCuotas + cuotaInicialPagada).toFixed(2));
        const saldoPendiente = Math.max(Number((montoOriginal - montoPagadoTotal).toFixed(2)), 0);

        const hoy = toUTCDateOnly(new Date());
        const tieneCuotaVencida = cuotas.some((cuota) => {
          if (!cuota.fecha_vencimiento) return false;
          const fecha = toUTCDateOnly(new Date(cuota.fecha_vencimiento));
          const pendienteCuota = Math.max(cuota.valor - cuota.valor_pagado, 0);
          return pendienteCuota > 0.01 && fecha < hoy;
        });

        const nuevoEstado = saldoPendiente <= 0.01 ? 'pagado' : tieneCuotaVencida ? 'mora' : 'activo';

        await db.query(
          `update "Creditos"
             set "SaldoTotal" = $2,
                 "MontoPagado" = $3,
                 "Estado" = $4
           where id = $1`,
          [creditoId, saldoPendiente, montoPagadoTotal, nuevoEstado]
        );

        await db.query('COMMIT');

        const [creditoActualizado] = await fetchCreditos(
          db,
          vendedor ? { ids: [creditoId], usuarioId: userId } : { ids: [creditoId] }
        );
        return creditoActualizado;
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    });

    if (!resultado) {
      return res.status(404).send('Crédito no encontrado');
    }

    res.json(resultado);
  } catch (e) {
    if (e instanceof Error && e.statusCode === 403) {
      return res.status(403).send(e.message);
    }
    console.error(e);
    res.status(500).send('No se pudo registrar el pago del crédito');
  }
});

app.post('/api/ventas', auth, async (req, res) => {
  const userId = getRequestUserId(req);
  if (!userId) {
    return res.status(401).send('Usuario inválido para crear ventas');
  }

  const { clienteId, medioPago, tipoVenta = 'contado', fecha = null, descuento = 0, detalles } = req.body || {};

  if (!clienteId || !medioPago || !tipoVenta || !Array.isArray(detalles) || detalles.length === 0) {
    return res.status(400).send('Cliente, tipo de venta, medio de pago y al menos un producto son obligatorios');
  }

  const parsedDetalles = detalles
    .map((detalle) => ({
      productoId: Number(detalle.productoId),
      cantidad: Math.max(1, Math.floor(Number(detalle.cantidad) || 0)),
      precioUnitario: Number(detalle.precioUnitario),
      color: detalle.color ? String(detalle.color).trim() : null,
      talla: detalle.talla ? String(detalle.talla).trim() : null,
      imei: detalle.imei ? String(detalle.imei) : null,
    }))
    .filter((detalle) => detalle.productoId && detalle.cantidad > 0 && detalle.precioUnitario > 0);

  if (parsedDetalles.length === 0) {
    return res.status(400).send('Los productos seleccionados no son válidos');
  }

  const descuentoValue = Number(descuento) || 0;
  const totalCalculado = parsedDetalles.reduce((acc, item) => acc + item.cantidad * item.precioUnitario, 0);
  const totalFinal = Math.max(totalCalculado - descuentoValue, 0);

  const fechaVenta = fecha ? new Date(fecha) : new Date();
  if (Number.isNaN(fechaVenta.getTime())) {
    return res.status(400).send('Fecha de venta inválida');
  }

  let creditInfo = null;
  if (tipoVenta === 'credito') {
    const creditoBody = (req.body && req.body.credito) || {};
    const tipoCredito = typeof creditoBody.tipoCredito === 'string' ? creditoBody.tipoCredito.trim() : '';
    const numeroCuotasRaw = Number(creditoBody.numeroCuotas);
    const cuotaInicialRaw = Number(creditoBody.cuotaInicial ?? 0);
    const fechaPrimerPagoRaw = creditoBody.fechaPrimerPago ? new Date(creditoBody.fechaPrimerPago) : null;

    if (!tipoCredito) {
      return res.status(400).send('El tipo de crédito es obligatorio');
    }
    if (!Number.isFinite(numeroCuotasRaw) || numeroCuotasRaw <= 0) {
      return res.status(400).send('El número de cuotas debe ser mayor que cero');
    }
    if (!Number.isFinite(cuotaInicialRaw) || cuotaInicialRaw < 0) {
      return res.status(400).send('La cuota inicial debe ser un valor positivo');
    }
    if (cuotaInicialRaw > totalFinal) {
      return res.status(400).send('La cuota inicial no puede superar el total de la venta');
    }
    if (fechaPrimerPagoRaw && Number.isNaN(fechaPrimerPagoRaw.getTime())) {
      return res.status(400).send('Fecha de primer pago inválida');
    }

    const numeroCuotas = Math.floor(numeroCuotasRaw);
    const cuotaInicialValor = Number(cuotaInicialRaw.toFixed(2));
    const saldoTotal = Number((totalFinal - cuotaInicialValor).toFixed(2));

    if (saldoTotal <= 0) {
      return res.status(400).send('El saldo a financiar debe ser mayor que cero');
    }

    creditInfo = {
      tipoCredito,
      numeroCuotas,
      cuotaInicial: cuotaInicialValor,
      saldoTotal,
      fechaPrimerPago: fechaPrimerPagoRaw ? toUTCDateOnly(fechaPrimerPagoRaw) : null,
    };
  }

  try {
    const venta = await withTenantClient(req.tenant, async (db) => {
      await db.query('BEGIN');
      try {
        await ensureProductoVariantsSchema(db);
        await ensureDetalleVentaVariantSchema(db);
        await ensureClientesUsuarioSchema(db);
        if (creditInfo) {
          await ensureCreditoSchema(db);
        }

        if (isVendedorRequest(req)) {
          const clienteOwnership = await db.query(
            `select id
             from "Clientes"
             where id = $1 and "UsuarioId" = $2`,
            [Number(clienteId), userId]
          );

          if (clienteOwnership.rowCount === 0) {
            const err = new Error('No autorizado para registrar ventas de este cliente');
            err.statusCode = 403;
            throw err;
          }
        }

        const ventaResult = await db.query(
          `insert into "Ventas" (
             "ClienteId",
             "UsuarioId",
             "Fecha",
             "TipoVenta",
             "Total",
             "MedioPago",
             "Descuento",
             "Estado"
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           returning id`,
          [
            Number(clienteId),
            userId,
            fechaVenta,
            tipoVenta,
            totalFinal,
            medioPago,
            descuentoValue,
            'pendiente',
          ]
        );

        const ventaId = ventaResult.rows[0].id;

        const stockCache = new Map();

        for (const detalle of parsedDetalles) {
          let stockInfo = stockCache.get(detalle.productoId);

          if (!stockInfo) {
            const productoRes = await db.query(
              `select "Cantidad", "Colores", "Tallas", "Estado"
               from "Productos"
               where id = $1
               for update`,
              [detalle.productoId]
            );

            if (productoRes.rowCount === 0) {
              throw new Error(`Producto ${detalle.productoId} no encontrado`);
            }

            const cantidadDisponibleRaw = productoRes.rows[0].cantidad;
            const unlimited = cantidadDisponibleRaw === null || cantidadDisponibleRaw === undefined;
            const cantidadDisponible = unlimited ? Number.POSITIVE_INFINITY : Number(cantidadDisponibleRaw ?? 0);
            const coloresStock = normalizeStockOptions(productoRes.rows[0].colores);
            const tallasStock = normalizeStockOptions(productoRes.rows[0].tallas);

            const coloresMap = new Map(
              coloresStock.map((item) => [item.nombre.toLowerCase(), { ...item, pendiente: 0 }])
            );
            const tallasMap = new Map(
              tallasStock.map((item) => [item.nombre.toLowerCase(), { ...item, pendiente: 0 }])
            );

            stockInfo = {
              disponible: cantidadDisponible,
              pendiente: 0,
              unlimited,
              estadoActual: productoRes.rows[0].estado,
              usaVariantes: coloresMap.size > 0 || tallasMap.size > 0,
              coloresMap,
              tallasMap,
            };
            stockCache.set(detalle.productoId, stockInfo);
          }

          if (stockInfo.usaVariantes) {
            if (!detalle.color) {
              throw new Error('Debes seleccionar un color para cada producto en la venta');
            }
            if (!detalle.talla) {
              throw new Error('Debes seleccionar una talla para cada producto en la venta');
            }

            const colorKey = detalle.color.toLowerCase();
            const tallaKey = detalle.talla.toLowerCase();
            const colorInfo = stockInfo.coloresMap.get(colorKey);
            const tallaInfo = stockInfo.tallasMap.get(tallaKey);

            if (!colorInfo) {
              throw new Error(`El color ${detalle.color} no está configurado para este producto`);
            }
            if (!tallaInfo) {
              throw new Error(`La talla ${detalle.talla} no está configurada para este producto`);
            }

            colorInfo.pendiente += detalle.cantidad;
            tallaInfo.pendiente += detalle.cantidad;

            if (colorInfo.pendiente > colorInfo.cantidad) {
              throw new Error(`Inventario insuficiente para el color ${colorInfo.nombre}`);
            }
            if (tallaInfo.pendiente > tallaInfo.cantidad) {
              throw new Error(`Inventario insuficiente para la talla ${tallaInfo.nombre}`);
            }
          }

          stockInfo.pendiente += detalle.cantidad;

          if (!stockInfo.unlimited && stockInfo.pendiente > stockInfo.disponible) {
            throw new Error('Inventario insuficiente para completar la venta');
          }

          const subtotal = detalle.cantidad * detalle.precioUnitario;
          await db.query(
            `insert into "DetalleVenta" (
               "VentaId",
               "ProductoId",
               "Cantidad",
               "PrecioUnitario",
               "Subtotal",
               "Color",
               "Talla",
               "IMEI"
             )
             values ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              ventaId,
              detalle.productoId,
              detalle.cantidad,
              detalle.precioUnitario,
              subtotal,
              detalle.color,
              detalle.talla,
              detalle.imei,
            ]
          );
        }

        for (const [productoId, stockInfo] of stockCache.entries()) {
          if (stockInfo.usaVariantes) {
            const nuevosColores = Array.from(stockInfo.coloresMap.values()).map((item) => ({
              nombre: item.nombre,
              cantidad: Math.max(item.cantidad - item.pendiente, 0),
            }));
            const nuevasTallas = Array.from(stockInfo.tallasMap.values()).map((item) => ({
              nombre: item.nombre,
              cantidad: Math.max(item.cantidad - item.pendiente, 0),
            }));
            const nuevoStock = sumStockOptions(nuevosColores);
            const nuevoEstado = nuevoStock <= 0 ? 'agotado' : stockInfo.estadoActual === 'agotado' ? 'activo' : stockInfo.estadoActual;
            await db.query(
              `update "Productos"
               set "Cantidad" = $2,
                   "Colores" = $3::jsonb,
                   "Tallas" = $4::jsonb,
                   "Estado" = $5
               where id = $1`,
              [productoId, nuevoStock, JSON.stringify(nuevosColores), JSON.stringify(nuevasTallas), nuevoEstado]
            );
            continue;
          }

          if (stockInfo.unlimited) continue;
          const nuevoStock = Math.max(stockInfo.disponible - stockInfo.pendiente, 0);
          await db.query(
            `update "Productos"
             set "Cantidad" = $2
             where id = $1`,
            [productoId, nuevoStock]
          );
        }

        if (creditInfo) {
          const fechaInicioCredito = toUTCDateOnly(fechaVenta);
          const fechaPrimerPago = creditInfo.fechaPrimerPago ? creditInfo.fechaPrimerPago : fechaInicioCredito;
          const valorCuotaBase = Number((creditInfo.saldoTotal / creditInfo.numeroCuotas).toFixed(2));
          const montoOriginal = Number((creditInfo.saldoTotal + creditInfo.cuotaInicial).toFixed(2));
          const montoPagadoInicial = Number(creditInfo.cuotaInicial.toFixed(2));

          const creditoRes = await db.query(
            `insert into "Creditos" (
               "VentaId",
               "TipoCredito",
               "NumeroCuotas",
               "CuotaInicial",
               "ValorCuota",
               "SaldoTotal",
               "Estado",
               "Calificacion",
               "MontoPerdidoHurto",
               "FechaPrimerPago",
               "FechaInicio",
               "MontoOriginal",
               "MontoPagado"
             )
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             returning id`,
            [
              ventaId,
              creditInfo.tipoCredito,
              creditInfo.numeroCuotas,
              creditInfo.cuotaInicial,
              valorCuotaBase,
              creditInfo.saldoTotal,
              'activo',
              'Pendiente',
              null,
              fechaPrimerPago.toISOString().slice(0, 10),
              fechaInicioCredito.toISOString().slice(0, 10),
              montoOriginal,
              montoPagadoInicial,
            ]
          );

          const creditoId = creditoRes.rows[0].id;
          let saldoRestante = creditInfo.saldoTotal;

          for (let idx = 0; idx < creditInfo.numeroCuotas; idx++) {
            const esUltima = idx === creditInfo.numeroCuotas - 1;
            const valorCuota = esUltima ? Number(saldoRestante.toFixed(2)) : valorCuotaBase;
            saldoRestante = Number((saldoRestante - valorCuota).toFixed(2));

            const fechaCuota = addCreditoInterval(fechaPrimerPago, creditInfo.tipoCredito, idx);

            await db.query(
              `insert into "CuotasCredito" (
                 "CreditoId",
                 "NumeroCuota",
                 "FechaVencimiento",
                 "Valor",
                 "Estado",
                 "ValorPagado"
               )
               values ($1, $2, $3, $4, $5, $6)`,
              [
                creditoId,
                idx + 1,
                fechaCuota.toISOString().slice(0, 10),
                valorCuota,
                'pendiente',
                0,
              ]
            );
          }
        }

        const [ventaCreada] = await fetchVentas(db, { ids: [ventaId] });
        await db.query('COMMIT');
        return ventaCreada;
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    });

    res.status(201).json(venta);
  } catch (e) {
    console.error(e);
    if (e instanceof Error && e.statusCode === 403) {
      return res.status(403).send(e.message);
    }
    if (
      e instanceof Error &&
      (e.message.includes('Inventario insuficiente') ||
        e.message.includes('Debes seleccionar un color') ||
        e.message.includes('Debes seleccionar una talla') ||
        e.message.includes('no está configurado'))
    ) {
      return res.status(400).send(e.message);
    }
    if (e instanceof Error && e.message.includes('no encontrado')) {
      return res.status(404).send(e.message);
    }
    res.status(500).send('No se pudo crear la venta');
  }
});

app.put('/api/ventas/:id', auth, async (req, res) => {
  const vendedor = isVendedorRequest(req);
  const userId = getRequestUserId(req);
  if (vendedor && !userId) {
    return res.status(401).send('Usuario inválido para actualizar ventas');
  }

  const ventaId = Number(req.params.id);
  if (!Number.isInteger(ventaId) || ventaId <= 0) {
    return res.status(400).send('ID de venta inválido');
  }

  const { estado, medioPago, calificacion } = req.body || {};
  if (estado === undefined && medioPago === undefined && calificacion === undefined) {
    return res.status(400).send('No hay cambios para aplicar');
  }

  try {
    const ventaActualizada = await withTenantClient(req.tenant, async (db) => {
      await db.query('BEGIN');
      try {
        const ventaRes = await db.query(
          `select
             id,
             "UsuarioId" as usuario_id,
             "Estado" as estado,
             "MedioPago" as medio_pago,
             "Calificacion" as calificacion
           from "Ventas"
           where id = $1
           for update`,
          [ventaId]
        );

        if (ventaRes.rowCount === 0) {
          await db.query('ROLLBACK');
          return null;
        }

        const ventaRow = ventaRes.rows[0];

        if (vendedor && Number(ventaRow.usuario_id) !== userId) {
          const err = new Error('No autorizado para actualizar esta venta');
          err.statusCode = 403;
          throw err;
        }

        let nuevoEstado = ventaRow.estado;
        if (estado !== undefined) {
          const estadoSolicitado = String(estado).trim();
          if (ventaRow.estado === 'devuelta' && estadoSolicitado !== 'devuelta') {
            const err = new Error('La venta ya fue marcada como devuelta y no puede cambiar de estado.');
            err.statusCode = 400;
            throw err;
          }
          if (ventaRow.estado !== 'devuelta' && estadoSolicitado) {
            nuevoEstado = estadoSolicitado;
          }
        }

        const nuevoMedioPago = medioPago ?? ventaRow.medio_pago;
        const nuevaCalificacion = calificacion ?? ventaRow.calificacion ?? null;
        // Temporalmente se desactiva el ajuste de inventario para ventas devueltas
        // const restock = ventaRow.estado !== 'devuelta' && nuevoEstado === 'devuelta';
        // const revertRestock = ventaRow.estado === 'devuelta' && nuevoEstado !== 'devuelta';

        await db.query(
          `update "Ventas"
             set "Estado" = $2,
                 "MedioPago" = $3,
                 "Calificacion" = $4
           where id = $1`,
          [ventaId, nuevoEstado, nuevoMedioPago, nuevaCalificacion]
        );

        // Mantener sincronizado el estado del envío asociado (si existe).
        const estadoSincronizado = normalizeVentaEnvioEstado(nuevoEstado, ventaRow.estado);
        await db.query(
          `update "Envios"
             set "Estado" = $2
           where "VentaId" = $1`,
          [ventaId, estadoSincronizado]
        );

        await syncCreditoScheduleOnEntrega(db, ventaId, ventaRow.estado, estadoSincronizado);

        const [ventaCompleta] = await fetchVentas(
          db,
          vendedor ? { ids: [ventaId], usuarioId: userId } : { ids: [ventaId] }
        );
        await db.query('COMMIT');
        return ventaCompleta;
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    });

    if (!ventaActualizada) {
      return res.status(404).send('Venta no encontrada');
    }

    res.json(ventaActualizada);
  } catch (e) {
    if (e instanceof Error && e.statusCode === 400) {
      return res.status(400).send(e.message);
    }
    if (e instanceof Error && e.statusCode === 403) {
      return res.status(403).send(e.message);
    }
    console.error(e);
    res.status(500).send('No se pudo actualizar la venta');
  }
});

app.delete('/api/ventas/:id', auth, async (req, res) => {
  const vendedor = isVendedorRequest(req);
  const userId = getRequestUserId(req);
  if (vendedor && !userId) {
    return res.status(401).send('Usuario inválido para eliminar ventas');
  }

  const ventaId = Number(req.params.id);
  if (!Number.isInteger(ventaId) || ventaId <= 0) {
    return res.status(400).send('ID de venta inválido');
  }

  try {
    const resultado = await withTenantClient(req.tenant, async (db) => {
      await db.query('BEGIN');
      try {
        const ventaRes = await db.query(
          `select
             id,
             "UsuarioId" as usuario_id,
             "Estado" as estado
           from "Ventas"
           where id = $1
           for update`,
          [ventaId]
        );

        if (ventaRes.rowCount === 0) {
          await db.query('ROLLBACK');
          return null;
        }

        const ventaRow = ventaRes.rows[0];

        if (vendedor && Number(ventaRow.usuario_id) !== userId) {
          const err = new Error('No autorizado para eliminar esta venta');
          err.statusCode = 403;
          throw err;
        }
        const requiereDevolucion = ventaRow.estado !== 'devuelta';

        if (requiereDevolucion) {
          await db.query(
            `update "Ventas"
               set "Estado" = 'devuelta'
             where id = $1`,
            [ventaId]
          );

          await db.query(
            `update "Envios"
               set "Estado" = 'devuelta'
             where "VentaId" = $1`,
            [ventaId]
          );
        }

        await db.query(
          `update "MovimientosInventario"
             set "VentaId" = null
           where "VentaId" = $1`,
          [ventaId]
        );

        const creditosRes = await db.query(
          `select id from "Creditos" where "VentaId" = $1`,
          [ventaId]
        );

        const creditoIds = creditosRes.rows.map((row) => row.id);
        if (creditoIds.length > 0) {
          await db.query(`delete from "CuotasCredito" where "CreditoId" = ANY($1::int[])`, [creditoIds]);
          await db.query(`delete from "Creditos" where id = ANY($1::int[])`, [creditoIds]);
        }

        await db.query(`delete from "DetalleVenta" where "VentaId" = $1`, [ventaId]);
        await db.query(`delete from "Ventas" where id = $1`, [ventaId]);

        await db.query('COMMIT');
        return { deleted: true, fueDevuelta: requiereDevolucion };
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    });

    if (!resultado) {
      return res.status(404).send('Venta no encontrada');
    }

    res.json(resultado);
  } catch (e) {
    if (e instanceof Error && e.statusCode === 403) {
      return res.status(403).send(e.message);
    }
    console.error(e);
    res.status(500).send('No se pudo eliminar la venta');
  }
});

app.get('/api/inventario/categorias', auth, async (req, res) => {
  try {
    const result = await withTenantClient(req.tenant, (db) =>
      db.query(`
        select
          c.id,
          c."Nombre" as nombre,
          c."Descripcion" as descripcion,
          c."TipoCategoria" as tipo_categoria,
          coalesce(count(p.*), 0) as productos_count
        from "Categorias" c
        left join "Productos" p on p."CategoriaId" = c.id
        group by c.id
        order by c."Nombre" asc
      `)
    );

    const categorias = result.rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion,
      tipoCategoria: row.tipo_categoria,
      productosCount: Number(row.productos_count ?? 0),
    }));

    res.json(categorias);
  } catch (e) {
    console.error(e);
    res.status(500).send('No se pudieron cargar las categorías');
  }
});

app.post('/api/inventario/categorias', auth, async (req, res) => {
  const { nombre, descripcion = null, tipoCategoria } = req.body || {};

  if (!nombre || !tipoCategoria) {
    return res.status(400).send('Nombre y tipo de categoría son obligatorios');
  }

  const values = [nombre.trim(), descripcion ? descripcion.trim() : null, tipoCategoria];

  try {
    const result = await withTenantClient(req.tenant, (db) =>
      db.query(
        `insert into "Categorias" ("Nombre", "Descripcion", "TipoCategoria")
         values ($1, $2, $3)
         returning
           id,
           "Nombre" as nombre,
           "Descripcion" as descripcion,
           "TipoCategoria" as tipo_categoria
        `,
        values
      )
    );

    const row = result.rows[0];
    const categoria = {
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion,
      tipoCategoria: row.tipo_categoria,
      productosCount: 0,
    };

    res.status(201).json(categoria);
  } catch (e) {
    console.error(e);
    res.status(500).send('No se pudo crear la categoría');
  }
});

app.get('/api/inventario/metadata', auth, async (_req, res) => {
  try {
    const [tiposCategoriaResult, estadosProductoResult] = await Promise.all([
      pool.query(
        `select enumlabel as value
         from pg_type t
         join pg_enum e on t.oid = e.enumtypid
         where t.typname = 'enum_Categorias_TipoCategoria'
         order by e.enumsortorder`
      ),
      pool.query(
        `select enumlabel as value
         from pg_type t
         join pg_enum e on t.oid = e.enumtypid
         where t.typname = 'enum_Productos_Estado'
         order by e.enumsortorder`
      ),
    ]);

    const tiposCategoria = Array.from(new Set(tiposCategoriaResult.rows.map((row) => row.value)));
    const estadosProducto = Array.from(new Set(estadosProductoResult.rows.map((row) => row.value)));

    res.json({ tiposCategoria, estadosProducto });
  } catch (e) {
    console.error(e);
    res.status(500).send('No se pudo obtener la configuración de inventario');
  }
});

app.get('/api/inventario/productos', auth, async (req, res) => {
  try {
    const result = await withTenantClient(req.tenant, async (db) => {
      await ensureProductoVariantsSchema(db);
      return db.query(`
        select
          p.id,
          p."Nombre" as nombre,
          p."Descripcion" as descripcion,
          p."CategoriaId" as categoria_id,
          p."PrecioCosto" as precio_costo,
          p."PrecioCredito" as precio_credito,
          p."CuotaInicial" as cuota_inicial,
          p."ImagenUrl" as imagen_url,
          p."Imagenes" as imagenes,
          p."Estado" as estado,
          p."FechaCreacion" as fecha_creacion,
          p."Marca" as marca,
          p."Modelo" as modelo,
          p."Cantidad" as cantidad,
          p."Colores" as colores,
          p."Tallas" as tallas,
          p."CostoDevolucion" as costo_devolucion,
          p."PrecioVentaContado" as precio_venta_contado,
          c."Nombre" as categoria_nombre
        from "Productos" p
        join "Categorias" c on c.id = p."CategoriaId"
        order by p."FechaCreacion" desc
        limit 200
      `);
    });

    const productos = result.rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion,
      categoriaId: row.categoria_id,
      categoriaNombre: row.categoria_nombre,
      precioCosto: Number(row.precio_costo ?? 0),
      precioCredito: Number(row.precio_credito ?? 0),
      cuotaInicial: row.cuota_inicial !== null ? Number(row.cuota_inicial) : null,
      imagenUrl: row.imagen_url,
      imagenes: normalizeProductImagesWithFallback(row.imagenes, row.imagen_url),
      estado: row.estado,
      fechaCreacion: row.fecha_creacion ? new Date(row.fecha_creacion).toISOString() : new Date().toISOString(),
      marca: row.marca,
      modelo: row.modelo,
      cantidad: row.cantidad !== null ? Number(row.cantidad) : null,
      colores: normalizeStockWithFallback(row.colores, row.cantidad, 'Único'),
      tallas: normalizeStockWithFallback(row.tallas, row.cantidad, 'Única'),
      costoDevolucion: row.costo_devolucion !== null ? Number(row.costo_devolucion) : null,
      precioVentaContado: row.precio_venta_contado !== null ? Number(row.precio_venta_contado) : null,
    }));

    res.json(productos);
  } catch (e) {
    console.error(e);
    res.status(500).send('No se pudieron cargar los productos');
  }
});

app.get('/api/inventario/productos/:id', auth, async (req, res) => {
  const productoId = Number(req.params.id);
  if (!Number.isInteger(productoId) || productoId <= 0) {
    return res.status(400).send('Producto inválido');
  }

  try {
    const result = await withTenantClient(req.tenant, async (db) => {
      await ensureProductoVariantsSchema(db);
      return db.query(
        `select
           p.id,
           p."Nombre" as nombre,
           p."Descripcion" as descripcion,
           p."CategoriaId" as categoria_id,
           p."PrecioCosto" as precio_costo,
           p."PrecioCredito" as precio_credito,
           p."CuotaInicial" as cuota_inicial,
           p."ImagenUrl" as imagen_url,
           p."Imagenes" as imagenes,
           p."Estado" as estado,
           p."FechaCreacion" as fecha_creacion,
           p."Marca" as marca,
           p."Modelo" as modelo,
           p."Cantidad" as cantidad,
           p."Colores" as colores,
           p."Tallas" as tallas,
           p."CostoDevolucion" as costo_devolucion,
           p."PrecioVentaContado" as precio_venta_contado,
           c."Nombre" as categoria_nombre
         from "Productos" p
         join "Categorias" c on c.id = p."CategoriaId"
         where p.id = $1
         limit 1`,
        [productoId]
      );
    });

    if (result.rowCount === 0) {
      return res.status(404).send('Producto no encontrado');
    }

    const row = result.rows[0];
    const producto = {
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion,
      categoriaId: row.categoria_id,
      categoriaNombre: row.categoria_nombre,
      precioCosto: Number(row.precio_costo ?? 0),
      precioCredito: Number(row.precio_credito ?? 0),
      cuotaInicial: row.cuota_inicial !== null ? Number(row.cuota_inicial) : null,
      imagenUrl: row.imagen_url,
      imagenes: normalizeProductImagesWithFallback(row.imagenes, row.imagen_url),
      estado: row.estado,
      fechaCreacion: row.fecha_creacion ? new Date(row.fecha_creacion).toISOString() : new Date().toISOString(),
      marca: row.marca,
      modelo: row.modelo,
      cantidad: row.cantidad !== null ? Number(row.cantidad) : null,
      colores: normalizeStockWithFallback(row.colores, row.cantidad, 'Único'),
      tallas: normalizeStockWithFallback(row.tallas, row.cantidad, 'Única'),
      costoDevolucion: row.costo_devolucion !== null ? Number(row.costo_devolucion) : null,
      precioVentaContado: row.precio_venta_contado !== null ? Number(row.precio_venta_contado) : null,
    };

    res.json(producto);
  } catch (e) {
    console.error(e);
    res.status(500).send('No se pudo cargar el producto');
  }
});

app.post('/api/inventario/productos', auth, async (req, res) => {
  const {
    nombre,
    descripcion = null,
    categoriaId,
    precioCosto,
    precioCredito,
    cuotaInicial = null,
    imagenUrl = null,
    imagenes = [],
    estado = 'activo',
    marca = null,
    modelo = null,
    cantidad = null,
    colores = [],
    tallas = [],
    costoDevolucion = null,
    precioVentaContado = null,
  } = req.body || {};

  if (!nombre || !categoriaId || precioCosto === undefined || precioCredito === undefined) {
    return res.status(400).send('Nombre, categoría y precios son obligatorios');
  }

  const cantidadIngresadaRaw = Number(cantidad ?? 0);
  const cantidadIngresada = Number.isFinite(cantidadIngresadaRaw)
    ? Math.max(0, Math.floor(cantidadIngresadaRaw))
    : 0;

  let coloresNormalizados = normalizeStockOptions(colores);
  let tallasNormalizadas = normalizeStockOptions(tallas);

  if (coloresNormalizados.length === 0 && tallasNormalizadas.length === 0 && cantidadIngresada > 0) {
    coloresNormalizados = [{ nombre: 'Único', cantidad: cantidadIngresada }];
    tallasNormalizadas = [{ nombre: 'Única', cantidad: cantidadIngresada }];
  } else if (coloresNormalizados.length === 0 && tallasNormalizadas.length > 0) {
    coloresNormalizados = [{ nombre: 'Único', cantidad: sumStockOptions(tallasNormalizadas) }];
  } else if (tallasNormalizadas.length === 0 && coloresNormalizados.length > 0) {
    tallasNormalizadas = [{ nombre: 'Única', cantidad: sumStockOptions(coloresNormalizados) }];
  }

  if (coloresNormalizados.length === 0) {
    return res.status(400).send('Debes registrar al menos un color con cantidad');
  }
  if (tallasNormalizadas.length === 0) {
    return res.status(400).send('Debes registrar al menos una talla con cantidad');
  }

  const totalColores = sumStockOptions(coloresNormalizados);
  const totalTallas = sumStockOptions(tallasNormalizadas);
  if (totalColores <= 0 || totalTallas <= 0) {
    return res.status(400).send('Las cantidades de colores y tallas deben ser mayores que cero');
  }
  if (totalColores !== totalTallas) {
    return res.status(400).send('La suma de cantidades por colores debe coincidir con la suma por tallas');
  }

  const imagenesNormalizadas = normalizeProductImages(imagenes);
  const imagenUrlFinal =
    imagenesNormalizadas[0]?.url ?? (imagenUrl !== null && imagenUrl !== undefined ? String(imagenUrl).trim() : null);

  const values = [
    nombre.trim(),
    descripcion ? descripcion.trim() : null,
    Number(categoriaId),
    Number(precioCosto),
    Number(precioCredito),
    cuotaInicial !== null && cuotaInicial !== undefined ? Number(cuotaInicial) : 0,
    imagenUrlFinal,
    JSON.stringify(imagenesNormalizadas),
    estado,
    marca,
    modelo,
    totalColores,
    JSON.stringify(coloresNormalizados),
    JSON.stringify(tallasNormalizadas),
    costoDevolucion !== null && costoDevolucion !== undefined ? Number(costoDevolucion) : 0,
    precioVentaContado !== null && precioVentaContado !== undefined ? Number(precioVentaContado) : null,
  ];

  try {
    const result = await withTenantClient(req.tenant, async (db) => {
      await ensureProductoVariantsSchema(db);
      return db.query(
        `insert into "Productos" (
           "Nombre",
           "Descripcion",
           "CategoriaId",
           "PrecioCosto",
           "PrecioCredito",
           "CuotaInicial",
           "ImagenUrl",
           "Imagenes",
           "Estado",
           "Marca",
           "Modelo",
           "Cantidad",
           "Colores",
           "Tallas",
           "CostoDevolucion",
           "PrecioVentaContado",
           "FechaCreacion"
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15, $16, now())
         returning
           id,
           "Nombre" as nombre,
           "Descripcion" as descripcion,
           "CategoriaId" as categoria_id,
           "PrecioCosto" as precio_costo,
           "PrecioCredito" as precio_credito,
           "CuotaInicial" as cuota_inicial,
           "ImagenUrl" as imagen_url,
           "Imagenes" as imagenes,
           "Estado" as estado,
           "FechaCreacion" as fecha_creacion,
           "Marca" as marca,
           "Modelo" as modelo,
           "Cantidad" as cantidad,
           "Colores" as colores,
           "Tallas" as tallas,
           "CostoDevolucion" as costo_devolucion,
           "PrecioVentaContado" as precio_venta_contado
        `,
        values
      );
    });

    const row = result.rows[0];
    const categoriaNombre = await withTenantClient(req.tenant, (db) =>
      db
        .query('select "Nombre" as nombre from "Categorias" where id = $1 limit 1', [row.categoria_id])
        .then((r) => (r.rows[0] ? r.rows[0].nombre : ''))
        .catch(() => '')
    );

    const producto = {
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion,
      categoriaId: row.categoria_id,
      categoriaNombre,
      precioCosto: Number(row.precio_costo ?? 0),
      precioCredito: Number(row.precio_credito ?? 0),
      cuotaInicial: row.cuota_inicial !== null ? Number(row.cuota_inicial) : null,
      imagenUrl: row.imagen_url,
      imagenes: normalizeProductImagesWithFallback(row.imagenes, row.imagen_url),
      estado: row.estado,
      fechaCreacion: row.fecha_creacion ? new Date(row.fecha_creacion).toISOString() : new Date().toISOString(),
      marca: row.marca,
      modelo: row.modelo,
      cantidad: row.cantidad !== null ? Number(row.cantidad) : null,
      colores: normalizeStockWithFallback(row.colores, row.cantidad, 'Único'),
      tallas: normalizeStockWithFallback(row.tallas, row.cantidad, 'Única'),
      costoDevolucion: row.costo_devolucion !== null ? Number(row.costo_devolucion) : null,
      precioVentaContado: row.precio_venta_contado !== null ? Number(row.precio_venta_contado) : null,
    };

    res.status(201).json(producto);
  } catch (e) {
    console.error(e);
    res.status(500).send('No se pudo crear el producto');
  }
});

app.put('/api/inventario/productos/:id', auth, async (req, res) => {
  const productoId = Number(req.params.id);
  if (!Number.isInteger(productoId) || productoId <= 0) {
    return res.status(400).send('Producto inválido');
  }

  const {
    nombre,
    descripcion = null,
    categoriaId,
    precioCosto,
    precioCredito,
    cuotaInicial = null,
    imagenUrl = null,
    imagenes = [],
    estado = null,
    marca = null,
    modelo = null,
    cantidad = null,
    colores = [],
    tallas = [],
    costoDevolucion = null,
    precioVentaContado = null,
  } = req.body || {};

  if (!nombre || categoriaId === undefined || precioCosto === undefined || precioCredito === undefined) {
    return res.status(400).send('Nombre, categoría y precios son obligatorios');
  }

  const cantidadIngresadaRaw = Number(cantidad ?? 0);
  const cantidadIngresada = Number.isFinite(cantidadIngresadaRaw)
    ? Math.max(0, Math.floor(cantidadIngresadaRaw))
    : 0;

  let coloresNormalizados = normalizeStockOptions(colores);
  let tallasNormalizadas = normalizeStockOptions(tallas);

  if (coloresNormalizados.length === 0 && tallasNormalizadas.length === 0 && cantidadIngresada > 0) {
    coloresNormalizados = [{ nombre: 'Único', cantidad: cantidadIngresada }];
    tallasNormalizadas = [{ nombre: 'Única', cantidad: cantidadIngresada }];
  } else if (coloresNormalizados.length === 0 && tallasNormalizadas.length > 0) {
    coloresNormalizados = [{ nombre: 'Único', cantidad: sumStockOptions(tallasNormalizadas) }];
  } else if (tallasNormalizadas.length === 0 && coloresNormalizados.length > 0) {
    tallasNormalizadas = [{ nombre: 'Única', cantidad: sumStockOptions(coloresNormalizados) }];
  }

  if (coloresNormalizados.length === 0) {
    return res.status(400).send('Debes registrar al menos un color con cantidad');
  }
  if (tallasNormalizadas.length === 0) {
    return res.status(400).send('Debes registrar al menos una talla con cantidad');
  }

  const totalColores = sumStockOptions(coloresNormalizados);
  const totalTallas = sumStockOptions(tallasNormalizadas);
  if (totalColores <= 0 || totalTallas <= 0) {
    return res.status(400).send('Las cantidades de colores y tallas deben ser mayores que cero');
  }
  if (totalColores !== totalTallas) {
    return res.status(400).send('La suma de cantidades por colores debe coincidir con la suma por tallas');
  }

  const imagenesNormalizadas = normalizeProductImages(imagenes);
  const imagenUrlFinal =
    imagenesNormalizadas[0]?.url ?? (imagenUrl !== null && imagenUrl !== undefined ? String(imagenUrl).trim() : null);

  try {
    const actualizado = await withTenantClient(req.tenant, async (db) => {
      await db.query('BEGIN');
      try {
        await ensureProductoVariantsSchema(db);
        const currentRes = await db.query(
          `select
             id,
             "Nombre" as nombre,
             "Descripcion" as descripcion,
             "CategoriaId" as categoria_id,
             "PrecioCosto" as precio_costo,
             "PrecioCredito" as precio_credito,
             "CuotaInicial" as cuota_inicial,
             "ImagenUrl" as imagen_url,
             "Imagenes" as imagenes,
             "Estado" as estado,
             "Marca" as marca,
             "Modelo" as modelo,
             "Cantidad" as cantidad,
             "Colores" as colores,
             "Tallas" as tallas,
             "CostoDevolucion" as costo_devolucion,
             "PrecioVentaContado" as precio_venta_contado
           from "Productos"
           where id = $1
           for update`,
          [productoId]
        );

        if (currentRes.rowCount === 0) {
          await db.query('ROLLBACK');
          return null;
        }

        const values = [
          nombre.trim(),
          descripcion ? String(descripcion).trim() : null,
          Number(categoriaId),
          Number(precioCosto),
          Number(precioCredito),
          cuotaInicial !== null && cuotaInicial !== undefined ? Number(cuotaInicial) : 0,
          imagenUrlFinal,
          JSON.stringify(imagenesNormalizadas),
          estado ? String(estado).trim() : currentRes.rows[0].estado,
          marca ? String(marca).trim() : null,
          modelo ? String(modelo).trim() : null,
          totalColores,
          JSON.stringify(coloresNormalizados),
          JSON.stringify(tallasNormalizadas),
          costoDevolucion !== null && costoDevolucion !== undefined ? Number(costoDevolucion) : 0,
          precioVentaContado !== null && precioVentaContado !== undefined ? Number(precioVentaContado) : null,
          productoId,
        ];

        await db.query(
          `update "Productos"
             set
               "Nombre" = $1,
               "Descripcion" = $2,
               "CategoriaId" = $3,
               "PrecioCosto" = $4,
               "PrecioCredito" = $5,
               "CuotaInicial" = $6,
               "ImagenUrl" = $7,
                 "Imagenes" = $8::jsonb,
                 "Estado" = $9,
                 "Marca" = $10,
                 "Modelo" = $11,
                 "Cantidad" = $12,
                 "Colores" = $13::jsonb,
                 "Tallas" = $14::jsonb,
                 "CostoDevolucion" = $15,
                 "PrecioVentaContado" = $16
               where id = $17`,
          values
        );

        const productoRes = await db.query(
          `select
             p.id,
             p."Nombre" as nombre,
             p."Descripcion" as descripcion,
             p."CategoriaId" as categoria_id,
             p."PrecioCosto" as precio_costo,
             p."PrecioCredito" as precio_credito,
             p."CuotaInicial" as cuota_inicial,
             p."ImagenUrl" as imagen_url,
             p."Imagenes" as imagenes,
             p."Estado" as estado,
             p."FechaCreacion" as fecha_creacion,
             p."Marca" as marca,
             p."Modelo" as modelo,
             p."Cantidad" as cantidad,
             p."Colores" as colores,
             p."Tallas" as tallas,
             p."CostoDevolucion" as costo_devolucion,
             p."PrecioVentaContado" as precio_venta_contado,
             c."Nombre" as categoria_nombre
           from "Productos" p
           join "Categorias" c on c.id = p."CategoriaId"
           where p.id = $1`,
          [productoId]
        );

        await db.query('COMMIT');
        return productoRes.rows[0] || null;
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    });

    if (!actualizado) {
      return res.status(404).send('Producto no encontrado');
    }

    const producto = {
      id: actualizado.id,
      nombre: actualizado.nombre,
      descripcion: actualizado.descripcion,
      categoriaId: actualizado.categoria_id,
      categoriaNombre: actualizado.categoria_nombre,
      precioCosto: Number(actualizado.precio_costo ?? 0),
      precioCredito: Number(actualizado.precio_credito ?? 0),
      cuotaInicial: actualizado.cuota_inicial !== null ? Number(actualizado.cuota_inicial) : null,
      imagenUrl: actualizado.imagen_url,
      imagenes: normalizeProductImagesWithFallback(actualizado.imagenes, actualizado.imagen_url),
      estado: actualizado.estado,
      fechaCreacion: actualizado.fecha_creacion
        ? new Date(actualizado.fecha_creacion).toISOString()
        : new Date().toISOString(),
      marca: actualizado.marca,
      modelo: actualizado.modelo,
      cantidad: actualizado.cantidad !== null ? Number(actualizado.cantidad) : null,
      colores: normalizeStockWithFallback(actualizado.colores, actualizado.cantidad, 'Único'),
      tallas: normalizeStockWithFallback(actualizado.tallas, actualizado.cantidad, 'Única'),
      costoDevolucion: actualizado.costo_devolucion !== null ? Number(actualizado.costo_devolucion) : null,
      precioVentaContado:
        actualizado.precio_venta_contado !== null ? Number(actualizado.precio_venta_contado) : null,
    };

    res.json(producto);
  } catch (e) {
    console.error(e);
    res.status(500).send('No se pudo actualizar el producto');
  }
});

app.delete('/api/inventario/productos/:id', auth, async (req, res) => {
  const productoId = Number(req.params.id);
  if (!Number.isInteger(productoId) || productoId <= 0) {
    return res.status(400).send('Producto inválido');
  }

  try {
    const eliminado = await withTenantClient(req.tenant, async (db) => {
      await db.query('BEGIN');
      try {
        const productoRes = await db.query(`select id from "Productos" where id = $1 for update`, [productoId]);
        if (productoRes.rowCount === 0) {
          await db.query('ROLLBACK');
          return null;
        }

        const detalleRes = await db.query(
          `select count(*)::int as total
           from "DetalleVenta"
           where "ProductoId" = $1`,
          [productoId]
        );

        const totalDetalles = detalleRes.rows[0]?.total ?? 0;
        if (totalDetalles > 0) {
          await db.query('ROLLBACK');
          const err = new Error('No se puede eliminar el producto porque está asociado a ventas');
          err.statusCode = 409;
          throw err;
        }

        await db.query(`delete from "Productos" where id = $1`, [productoId]);
        await db.query('COMMIT');
        return true;
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    });

    if (eliminado === null) {
      return res.status(404).send('Producto no encontrado');
    }

    res.json({ deleted: true });
  } catch (e) {
    if (e instanceof Error && e.statusCode === 409) {
      return res.status(409).send(e.message);
    }
    console.error(e);
    res.status(500).send('No se pudo eliminar el producto');
  }
});

// ===== ENVIOS ENDPOINTS =====

// GET /api/envios - Obtener todos los envíos con paginación y filtros
app.get('/api/envios', auth, async (req, res) => {
  try {
    const { tenant } = req.user;
    const vendedor = isVendedorRequest(req);
    const userId = getRequestUserId(req);
    if (vendedor && !userId) {
      return res.status(401).send('Usuario inválido para consultar envíos');
    }

    const { page = 1, limit = 50, estado, ventaId, ciudad } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const result = await withTenantClient(tenant, async (db) => {
      let baseQuery = `
        SELECT 
          e.*,
          v.id as venta_id,
          v."UsuarioId" as venta_usuario_id,
          v."Fecha" as venta_fecha,
          v."Total" as venta_total,
          v."Estado" as venta_estado,
          v."TipoVenta" as venta_tipo,
          c.id as cliente_id,
          c."Nombres" as cliente_nombres,
          c."Apellidos" as cliente_apellidos,
          c."Telefono" as cliente_telefono,
          c."Correo" as cliente_correo,
          c."Direccion" as cliente_direccion,
          c."Ciudad" as cliente_ciudad,
          c."Departamento" as cliente_departamento,
          c."Barrio" as cliente_barrio
        FROM "Envios" e
        INNER JOIN "Ventas" v ON e."VentaId" = v.id
        INNER JOIN "Clientes" c ON v."ClienteId" = c.id
      `;
      
      const conditions = [];
      const params = [];
      let paramIndex = 1;

      if (estado) {
        conditions.push(`e."Estado" = $${paramIndex++}`);
        params.push(estado);
      }
      if (ventaId) {
        conditions.push(`e."VentaId" = $${paramIndex++}`);
        params.push(Number(ventaId));
      }
      if (ciudad) {
        conditions.push(`LOWER(e."Ciudad") LIKE LOWER($${paramIndex++})`);
        params.push(`%${ciudad}%`);
      }
      if (vendedor) {
        conditions.push(`v."UsuarioId" = $${paramIndex++}`);
        params.push(userId);
      }

      if (conditions.length > 0) {
        baseQuery += ` WHERE ${conditions.join(' AND ')}`;
      }

      baseQuery += ` ORDER BY e.id DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(Number(limit), offset);

      const countQuery = `
        SELECT COUNT(*) as total
        FROM "Envios" e
        INNER JOIN "Ventas" v ON e."VentaId" = v.id
        ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      `;

      const [enviosResult, countResult] = await Promise.all([
        db.query(baseQuery, params),
        db.query(countQuery, params.slice(0, -2)) // Remove limit and offset for count
      ]);

      const envios = enviosResult.rows.map(row => ({
        id: row.id,
        VentaId: row.VentaId,
        DireccionEntrega: row.DireccionEntrega,
        FechaEnvio: row.FechaEnvio,
        FechaEntrega: row.FechaEntrega,
        OperadorLogistico: row.OperadorLogistico,
        NumeroGuia: row.NumeroGuia,
        Observaciones: row.Observaciones,
        Ciudad: row.Ciudad,
        Departamento: row.Departamento,
        Barrio: row.Barrio,
        Estado: row.Estado,
        Calificacion: row.Calificacion,
        venta: {
          id: row.venta_id,
          numero: row.venta_id,
          usuarioId: row.venta_usuario_id !== null && row.venta_usuario_id !== undefined ? Number(row.venta_usuario_id) : null,
          fecha: row.venta_fecha ? new Date(row.venta_fecha).toISOString() : null,
          total: Number(row.venta_total ?? 0),
          estado: row.venta_estado,
          tipoVenta: row.venta_tipo
        },
        cliente: {
          id: row.cliente_id,
          nombre: [row.cliente_nombres, row.cliente_apellidos].filter(Boolean).join(' ').trim(),
          telefono: row.cliente_telefono ?? null,
          correo: row.cliente_correo ?? null,
          direccion: row.cliente_direccion ?? null,
          ciudad: row.cliente_ciudad ?? null,
          departamento: row.cliente_departamento ?? null,
          barrio: row.cliente_barrio ?? null
        }
      }));

      const total = Number(countResult.rows[0].total);

      return {
        envios,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      };
    });

    res.json(result);
  } catch (e) {
    console.error('❌ Error en /api/envios:', e);
    console.error('Stack:', e.stack);
    res.status(500).send('Error al obtener envíos: ' + e.message);
  }
});

// GET /api/envios/stats - Estadísticas de envíos
app.get('/api/envios/stats', auth, async (req, res) => {
  try {
    const { tenant } = req.user;
    const vendedor = isVendedorRequest(req);
    const userId = getRequestUserId(req);
    if (vendedor && !userId) {
      return res.status(401).send('Usuario inválido para consultar estadísticas de envíos');
    }

    const stats = await withTenantClient(tenant, async (db) => {
      // Primero verificar si hay envíos
      const countResult = vendedor
        ? await db.query(
            `SELECT COUNT(*) as total
             FROM "Envios" e
             INNER JOIN "Ventas" v ON e."VentaId" = v.id
             WHERE v."UsuarioId" = $1`,
            [userId]
          )
        : await db.query(`SELECT COUNT(*) as total FROM "Envios"`);
      const totalEnvios = Number(countResult.rows[0]?.total || 0);
      
      if (totalEnvios === 0) {
        // Si no hay envíos, retornar ceros
        return {
          totalEnvios: 0,
          pendientes: 0,
          confirmados: 0,
          enviados: 0,
          entregados: 0,
          cancelados: 0,
          devueltos: 0
        };
      }
      
      // Si hay envíos, hacer el conteo por estado
      const result = await db.query(`
        SELECT 
          e."Estado",
          COUNT(*) as cantidad
        FROM "Envios" e
        ${vendedor ? 'INNER JOIN "Ventas" v ON e."VentaId" = v.id' : ''}
        ${vendedor ? 'WHERE v."UsuarioId" = $1' : ''}
        GROUP BY e."Estado"
      `, vendedor ? [userId] : []);
      
      const stats = {
        totalEnvios: totalEnvios,
        pendientes: 0,
        confirmados: 0,
        enviados: 0,
        entregados: 0,
        cancelados: 0,
        devueltos: 0
      };
      
      result.rows.forEach(row => {
        const estado = String(row.Estado || '').toLowerCase();
        const cantidad = Number(row.cantidad || 0);
        
        if (estado === 'pendiente') stats.pendientes = cantidad;
        else if (estado === 'confirmada') stats.confirmados = cantidad;
        else if (estado === 'enviada') stats.enviados = cantidad;
        else if (estado === 'entregada') stats.entregados = cantidad;
        else if (estado === 'cancelada') stats.cancelados = cantidad;
        else if (estado === 'devuelta') stats.devueltos = cantidad;
      });
      
      return stats;
    });

    res.json(stats);
  } catch (e) {
    console.error('❌ Error en /api/envios/stats:', e);
    console.error('Stack:', e.stack);
    res.status(500).send('Error al obtener estadísticas de envíos: ' + e.message);
  }
});

// GET /api/ventas/sin-envio - Obtener ventas que no tienen envío creado
app.get('/api/ventas/sin-envio', auth, async (req, res) => {
  try {
    console.log('🔍 GET /api/ventas/sin-envio called');
    const { tenant } = req.user;
    const vendedor = isVendedorRequest(req);
    const userId = getRequestUserId(req);
    if (vendedor && !userId) {
      return res.status(401).send('Usuario inválido para consultar ventas');
    }

    console.log('👤 Tenant:', tenant);
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const result = await withTenantClient(tenant, async (db) => {
      // Debug: Verificar schema actual
      const schemaCheck = await db.query('SELECT current_schema()');
      console.log('📂 Current schema:', schemaCheck.rows[0].current_schema);
      
      // Debug: Verificar ventas existentes
      const ventasDebug = await db.query('SELECT id, "Estado", "TipoVenta" FROM "Ventas" ORDER BY id DESC LIMIT 5');
      console.log('📋 Ventas en DB:', ventasDebug.rows);
      
      // Debug: Verificar envíos existentes
      const enviosDebug = await db.query('SELECT id, "VentaId" FROM "Envios"');
      console.log('📦 Envíos en DB:', enviosDebug.rows);

      const ownershipClause = vendedor ? 'AND v."UsuarioId" = $3' : '';

      const ventasQuery = `
        SELECT 
          v.id,
          v."Fecha" as fecha,
          v."Total" as total,
          v."TipoVenta",
          v."Estado" as venta_estado,
          c.id as cliente_id,
          c."Nombres" || ' ' || c."Apellidos" as cliente_nombre,
          c."Telefono" as cliente_telefono,
          c."Correo" as cliente_correo,
          c."Direccion" as cliente_direccion,
          c."Ciudad" as cliente_ciudad,
          c."Departamento" as cliente_departamento,
          c."Barrio" as cliente_barrio,
          c."TipoIdentificacion" as cliente_tipo_doc,
          c."NumeroDocumento" as cliente_numero_doc
        FROM "Ventas" v
        INNER JOIN "Clientes" c ON v."ClienteId" = c.id
        LEFT JOIN "Envios" e ON v.id = e."VentaId"
        WHERE e."VentaId" IS NULL
        AND v."Estado" NOT IN ('cancelada', 'devuelta')
        ${ownershipClause}
        ORDER BY v."Fecha" DESC
        LIMIT $1 OFFSET $2
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM "Ventas" v
        LEFT JOIN "Envios" e ON v.id = e."VentaId"
        WHERE e."VentaId" IS NULL
        AND v."Estado" NOT IN ('cancelada', 'devuelta')
        ${vendedor ? 'AND v."UsuarioId" = $1' : ''}
      `;

      const ventasParams = vendedor ? [Number(limit), offset, userId] : [Number(limit), offset];
      const countParams = vendedor ? [userId] : [];

      const [ventasResult, countResult] = await Promise.all([
        db.query(ventasQuery, ventasParams),
        db.query(countQuery, countParams)
      ]);

      console.log('📊 Query results:', {
        ventasCount: ventasResult.rows.length,
        totalCount: countResult.rows[0]?.total || 0
      });

      const ventas = ventasResult.rows.map(row => ({
        id: row.id,
        fecha: row.fecha,
        total: Number(row.total),
        tipoVenta: row.TipoVenta,
        estado: row.venta_estado,
        cliente: {
          id: row.cliente_id,
          nombre: row.cliente_nombre,
          telefono: row.cliente_telefono,
          correo: row.cliente_correo,
          direccion: row.cliente_direccion,
          ciudad: row.cliente_ciudad,
          departamento: row.cliente_departamento,
          barrio: row.cliente_barrio,
          tipoIdentificacion: row.cliente_tipo_doc,
          numeroDocumento: row.cliente_numero_doc
        }
      }));

      const total = Number(countResult.rows[0].total);

      return {
        ventas,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      };
    });

    res.json(result);
  } catch (e) {
    console.error('❌ Error en /api/ventas/sin-envio:', e);
    console.error('Stack:', e.stack);
    console.error('Tenant:', req.user?.tenant);
    res.status(500).send('Error al obtener ventas sin envío: ' + e.message);
  }
});

// GET /api/envios/:id - Obtener un envío específico
app.get('/api/envios/:id', auth, async (req, res) => {
  try {
    const { tenant } = req.user;
    const vendedor = isVendedorRequest(req);
    const userId = getRequestUserId(req);
    if (vendedor && !userId) {
      return res.status(401).send('Usuario inválido para consultar el envío');
    }

    const { id } = req.params;

    const envio = await withTenantClient(tenant, async (db) => {
      const result = await db.query(`
        SELECT 
          e.*,
          v.id as venta_id,
          v."UsuarioId" as venta_usuario_id,
          v."Fecha" as venta_fecha,
          v."Total" as venta_total,
          v."Estado" as venta_estado,
          v."TipoVenta" as venta_tipo,
          c.id as cliente_id,
          c.nombres as cliente_nombres,
          c.apellidos as cliente_apellidos,
          c.telefono as cliente_telefono,
          c.correo as cliente_correo,
          c.direccion as cliente_direccion,
          c.ciudad as cliente_ciudad,
          c.departamento as cliente_departamento,
          c.barrio as cliente_barrio
        FROM "Envios" e
        INNER JOIN "Ventas" v ON e."VentaId" = v.id
        INNER JOIN "Clientes" c ON v."ClienteId" = c.id
        WHERE e.id = $1
        ${vendedor ? 'AND v."UsuarioId" = $2' : ''}
      `, vendedor ? [Number(id), userId] : [Number(id)]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        VentaId: row.VentaId,
        DireccionEntrega: row.DireccionEntrega,
        FechaEnvio: row.FechaEnvio,
        FechaEntrega: row.FechaEntrega,
        OperadorLogistico: row.OperadorLogistico,
        NumeroGuia: row.NumeroGuia,
        Observaciones: row.Observaciones,
        Ciudad: row.Ciudad,
        Departamento: row.Departamento,
        Barrio: row.Barrio,
        Estado: row.Estado,
        Calificacion: row.Calificacion,
        venta: {
          id: row.venta_id,
          numero: row.venta_id,
          usuarioId: row.venta_usuario_id !== null && row.venta_usuario_id !== undefined ? Number(row.venta_usuario_id) : null,
          fecha: row.venta_fecha ? new Date(row.venta_fecha).toISOString() : null,
          total: Number(row.venta_total ?? 0),
          estado: row.venta_estado,
          tipoVenta: row.venta_tipo
        },
        cliente: {
          id: row.cliente_id,
          nombre: [row.cliente_nombres, row.cliente_apellidos].filter(Boolean).join(' ').trim(),
          telefono: row.cliente_telefono ?? null,
          correo: row.cliente_correo ?? null,
          direccion: row.cliente_direccion ?? null,
          ciudad: row.cliente_ciudad ?? null,
          departamento: row.cliente_departamento ?? null,
          barrio: row.cliente_barrio ?? null
        }
      };
    });

    if (!envio) {
      return res.status(404).send('Envío no encontrado');
    }

    res.json(envio);
  } catch (e) {
    console.error(e);
    res.status(500).send('Error al obtener el envío');
  }
});

// POST /api/envios - Crear un nuevo envío
app.post('/api/envios', auth, async (req, res) => {
  try {
    const { tenant } = req.user;
    const vendedor = isVendedorRequest(req);
    const userId = getRequestUserId(req);
    if (vendedor && !userId) {
      return res.status(401).send('Usuario inválido para crear envíos');
    }

    const {
      VentaId,
      DireccionEntrega,
      FechaEnvio,
      FechaEntrega,
      OperadorLogistico,
      NumeroGuia,
      Observaciones,
      Ciudad,
      Departamento,
      Barrio,
      Estado = 'pendiente',
      Calificacion = 'Pendiente'
    } = req.body;

    if (!VentaId || !DireccionEntrega) {
      return res.status(400).send('VentaId y DireccionEntrega son requeridos');
    }

    const envio = await withTenantClient(tenant, async (db) => {
      await db.query('BEGIN');
      try {
        // Verificar que la venta existe
        const ventaCheck = await db.query(
          `SELECT id, "Estado" as estado
           FROM "Ventas"
           WHERE id = $1
           ${vendedor ? 'AND "UsuarioId" = $2' : ''}
           FOR UPDATE`,
          vendedor ? [VentaId, userId] : [VentaId]
        );
        if (ventaCheck.rows.length === 0) {
          const err = new Error(vendedor ? 'No autorizado para crear envío en esta venta' : 'La venta especificada no existe');
          err.statusCode = vendedor ? 403 : 404;
          throw err;
        }
        const estadoVentaAnterior = ventaCheck.rows[0].estado;

        // Verificar que no existe ya un envío para esta venta
        const envioCheck = await db.query('SELECT id FROM "Envios" WHERE "VentaId" = $1', [VentaId]);
        if (envioCheck.rows.length > 0) {
          throw new Error('Ya existe un envío para esta venta');
        }

        const estadoSincronizado = normalizeVentaEnvioEstado(Estado, 'pendiente');

        const result = await db.query(`
          INSERT INTO "Envios" (
            "VentaId", "DireccionEntrega", "FechaEnvio", "FechaEntrega", 
            "OperadorLogistico", "NumeroGuia", "Observaciones", 
            "Ciudad", "Departamento", "Barrio", "Estado", "Calificacion"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *
        `, [
          VentaId, DireccionEntrega, FechaEnvio, FechaEntrega,
          OperadorLogistico, NumeroGuia, Observaciones,
          Ciudad, Departamento, Barrio, estadoSincronizado, Calificacion
        ]);

        await db.query(
          `UPDATE "Ventas"
             SET "Estado" = $2
           WHERE id = $1`,
          [VentaId, estadoSincronizado]
        );

        await syncCreditoScheduleOnEntrega(db, VentaId, estadoVentaAnterior, estadoSincronizado);

        await db.query('COMMIT');
        return result.rows[0];
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    });

    res.status(201).json(envio);
  } catch (e) {
    console.error(e);
    if (e instanceof Error && e.statusCode === 403) {
      return res.status(403).send(e.message);
    }
    if (e instanceof Error && e.statusCode === 404) {
      return res.status(404).send(e.message);
    }
    if (e.message.includes('Ya existe un envío') || e.message.includes('no existe')) {
      return res.status(400).send(e.message);
    }
    res.status(500).send('Error al crear el envío');
  }
});

// PUT /api/envios/:id - Actualizar un envío
app.put('/api/envios/:id', auth, async (req, res) => {
  try {
    const { tenant } = req.user;
    const vendedor = isVendedorRequest(req);
    const userId = getRequestUserId(req);
    if (vendedor && !userId) {
      return res.status(401).send('Usuario inválido para actualizar envíos');
    }

    const { id } = req.params;
    const updates = req.body;

    const envio = await withTenantClient(tenant, async (db) => {
      await db.query('BEGIN');
      
      try {
        // Verificar que el envío existe
        const envioCheck = await db.query(
          `SELECT e.id, e."VentaId", e."Estado", v."UsuarioId" as venta_usuario_id
           FROM "Envios" e
           INNER JOIN "Ventas" v ON e."VentaId" = v.id
           WHERE e.id = $1`,
          [Number(id)]
        );
        
        if (envioCheck.rows.length === 0) {
          await db.query('ROLLBACK');
          return null;
        }

        const envioActual = envioCheck.rows[0];
        if (vendedor && Number(envioActual.venta_usuario_id) !== userId) {
          await db.query('ROLLBACK');
          const err = new Error('No autorizado para actualizar este envío');
          err.statusCode = 403;
          throw err;
        }
        const ventaId = Number(envioActual.VentaId ?? envioActual.ventaid);
        const estadoAnterior = String(envioActual.Estado ?? envioActual.estado ?? 'pendiente').toLowerCase();

        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;

        const allowedFields = [
          'DireccionEntrega', 'FechaEnvio', 'FechaEntrega', 
          'OperadorLogistico', 'NumeroGuia', 'Observaciones', 
          'Ciudad', 'Departamento', 'Barrio', 'Estado', 'Calificacion'
        ];

        allowedFields.forEach(field => {
          if (updates[field] !== undefined) {
            updateFields.push(`"${field}" = $${paramIndex++}`);
            updateValues.push(updates[field]);
          }
        });

        if (updateFields.length === 0) {
          await db.query('ROLLBACK');
          throw new Error('No hay campos para actualizar');
        }

        updateValues.push(Number(id));

        const result = await db.query(`
          UPDATE "Envios" 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `, updateValues);

        const envioActualizado = result.rows[0];

        // Sincronizar estado de venta si el estado del envío cambió
        if (updates.Estado && String(updates.Estado).toLowerCase() !== estadoAnterior) {
          console.log(`🔄 Sincronizando estado de envío ${id}: ${estadoAnterior} → ${updates.Estado}`);

          const nuevoEstado = normalizeVentaEnvioEstado(updates.Estado, estadoAnterior);
          await db.query(
            `UPDATE "Ventas" SET "Estado" = $1 WHERE id = $2`,
            [nuevoEstado, ventaId]
          );

          await syncCreditoScheduleOnEntrega(db, ventaId, estadoAnterior, nuevoEstado, updates.FechaEntrega ?? null);
          console.log(`✅ Venta ${ventaId} actualizada a estado: ${nuevoEstado}`);
        }

        await db.query('COMMIT');
        return envioActualizado;
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    });

    if (!envio) {
      return res.status(404).send('Envío no encontrado');
    }

    res.json(envio);
  } catch (e) {
    if (e instanceof Error && e.statusCode === 403) {
      return res.status(403).send(e.message);
    }
    console.error('❌ Error al actualizar envío:', e);
    res.status(500).send('Error al actualizar el envío: ' + e.message);
  }
});

// DELETE /api/envios/:id - Eliminar un envío
app.delete('/api/envios/:id', auth, async (req, res) => {
  try {
    const { tenant } = req.user;
    const vendedor = isVendedorRequest(req);
    const userId = getRequestUserId(req);
    if (vendedor && !userId) {
      return res.status(401).send('Usuario inválido para eliminar envíos');
    }

    const { id } = req.params;

    const deleted = await withTenantClient(tenant, async (db) => {
      const result = await db.query(
        `DELETE FROM "Envios" e
         USING "Ventas" v
         WHERE e.id = $1
           AND e."VentaId" = v.id
           ${vendedor ? 'AND v."UsuarioId" = $2' : ''}
         RETURNING e.id`,
        vendedor ? [Number(id), userId] : [Number(id)]
      );
      return result.rows.length > 0;
    });

    if (!deleted) {
      return res.status(404).send('Envío no encontrado');
    }

    res.json({ deleted: true });
  } catch (e) {
    console.error(e);
    res.status(500).send('Error al eliminar el envío');
  }
});

app.use((err, _req, res, next) => {
  if (
    err &&
    (err.type === 'entity.too.large' ||
      err.name === 'PayloadTooLargeError' ||
      err.status === 413 ||
      err.statusCode === 413)
  ) {
    return res.status(413).json({
      error: 'La imagen es demasiado grande. Reduce su tamaño e intenta nuevamente.',
    });
  }
  return next(err);
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
