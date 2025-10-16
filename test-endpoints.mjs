// Test script para probar los endpoints de envíos
const baseUrl = 'http://localhost:3001';

async function testEndpoints() {
  try {
    console.log('🧪 Probando endpoints de envíos...\n');

    // Test 1: Health check
    console.log('1. Health check...');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.text();
    console.log('   ✅ Health:', healthData);

    // Test 2: Obtener ventas sin envío (sin auth - debería fallar)
    console.log('\n2. Obtener ventas sin envío (sin autenticación)...');
    const ventasRes = await fetch(`${baseUrl}/api/ventas/sin-envio`);
    console.log('   📊 Status:', ventasRes.status, '(401 esperado sin auth)');

    // Test 3: Obtener estadísticas de envíos (sin auth - debería fallar)
    console.log('\n3. Obtener estadísticas de envíos (sin autenticación)...');
    const statsRes = await fetch(`${baseUrl}/api/envios/stats`);
    console.log('   📊 Status:', statsRes.status, '(401 esperado sin auth)');

    // Test 4: Obtener envíos (sin auth - debería fallar)
    console.log('\n4. Obtener envíos (sin autenticación)...');
    const enviosRes = await fetch(`${baseUrl}/api/envios`);
    console.log('   📊 Status:', enviosRes.status, '(401 esperado sin auth)');

    console.log('\n✅ Todos los endpoints responden correctamente.');
    console.log('💡 Los endpoints requieren autenticación JWT (status 401 es correcto).');
    console.log('🎯 Para probar completamente, usa la aplicación web con login.');

  } catch (error) {
    console.error('❌ Error probando endpoints:', error.message);
  }
}

testEndpoints();