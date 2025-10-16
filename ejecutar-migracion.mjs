// Script para ejecutar la migración SQL
import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs';

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

async function ejecutarMigracion() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Iniciando migración...\n');
    
    // PASO 1: Cambiar al schema del tenant
    console.log('📍 PASO 1: Configurando search_path...');
    await client.query('SET search_path TO tenant_admin, public');
    console.log('✅ Search path configurado\n');
    
    // PASO 2: Convertir columna a TEXT
    console.log('📍 PASO 2: Convirtiendo columna "Estado" a TEXT...');
    await client.query('ALTER TABLE "Envios" ALTER COLUMN "Estado" TYPE TEXT');
    console.log('✅ Columna convertida a TEXT\n');
    
    // PASO 3: Eliminar enum viejo
    console.log('📍 PASO 3: Eliminando enum antiguo...');
    await client.query('DROP TYPE IF EXISTS public.enum_envios_estado CASCADE');
    console.log('✅ Enum antiguo eliminado\n');
    
    // PASO 4: Crear enum nuevo
    console.log('📍 PASO 4: Creando nuevo enum con estados en minúsculas...');
    await client.query(`
      CREATE TYPE public.enum_envios_estado AS ENUM (
        'pendiente',
        'confirmada',
        'enviada',
        'entregada',
        'cancelada',
        'devuelta'
      )
    `);
    console.log('✅ Nuevo enum creado\n');
    
    // PASO 5: Normalizar datos existentes
    console.log('📍 PASO 5: Normalizando datos existentes...');
    
    await client.query(`UPDATE "Envios" SET "Estado" = 'confirmada' WHERE "Estado" ILIKE '%confirmada%' OR "Estado" ILIKE '%preparacion%' OR "Estado" ILIKE '%preparando%'`);
    await client.query(`UPDATE "Envios" SET "Estado" = 'enviada' WHERE "Estado" ILIKE '%enviada%' OR "Estado" ILIKE '%camino%'`);
    await client.query(`UPDATE "Envios" SET "Estado" = 'entregada' WHERE "Estado" ILIKE '%entregada%' OR "Estado" ILIKE '%entregado%'`);
    await client.query(`UPDATE "Envios" SET "Estado" = 'cancelada' WHERE "Estado" ILIKE '%cancelada%' OR "Estado" ILIKE '%cancelado%'`);
    await client.query(`UPDATE "Envios" SET "Estado" = 'pendiente' WHERE "Estado" ILIKE '%pendiente%'`);
    await client.query(`UPDATE "Envios" SET "Estado" = 'devuelta' WHERE "Estado" ILIKE '%devuelta%'`);
    
    console.log('✅ Datos normalizados\n');
    
    // PASO 6: Convertir columna de vuelta a ENUM
    console.log('📍 PASO 6: Convirtiendo columna de vuelta a ENUM...');
    await client.query(`
      ALTER TABLE "Envios" 
        ALTER COLUMN "Estado" TYPE public.enum_envios_estado 
        USING "Estado"::public.enum_envios_estado
    `);
    console.log('✅ Columna convertida a ENUM\n');
    
    // PASO 7: Restaurar valor por defecto
    console.log('📍 PASO 7: Configurando valor por defecto...');
    await client.query(`
      ALTER TABLE "Envios" 
        ALTER COLUMN "Estado" SET DEFAULT 'pendiente'::public.enum_envios_estado
    `);
    console.log('✅ Valor por defecto configurado\n');
    
    // PASO 8: Verificar estados en Envios
    console.log('📊 PASO 8: Verificando estados en Envios...');
    const enviosResult = await client.query(`
      SELECT 
        "Estado", 
        COUNT(*) as cantidad
      FROM "Envios"
      GROUP BY "Estado"
      ORDER BY "Estado"
    `);
    
    console.log('\n📦 Estados en tabla Envios:');
    console.table(enviosResult.rows);
    
    // PASO 9: Verificar valores del enum
    console.log('📊 PASO 9: Verificando valores del enum...');
    const enumResult = await client.query(`
      SELECT 
        enumlabel as valor
      FROM pg_enum
      WHERE enumtypid = 'public.enum_envios_estado'::regtype
      ORDER BY enumsortorder
    `);
    
    console.log('\n✨ Valores permitidos en el enum:');
    console.table(enumResult.rows);
    
    console.log('\n🎉 ¡MIGRACIÓN COMPLETADA CON ÉXITO!\n');
    console.log('✅ Ahora puedes editar envíos sin errores 500');
    console.log('✅ Estados permitidos: pendiente, confirmada, enviada, entregada, cancelada, devuelta\n');
    
  } catch (error) {
    console.error('\n❌ ERROR durante la migración:');
    console.error(error.message);
    console.error('\nDetalles completos:');
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

ejecutarMigracion();
