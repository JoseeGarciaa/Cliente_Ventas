// Simple test to check if the endpoint is working
async function testVentasSinEnvio() {
    try {
        // First, let's try to login to get a token
        console.log('🔐 Testing login...');
        const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'admin@tenant.com',  // You might need to adjust this
                password: 'admin123'        // You might need to adjust this
            })
        });

        if (!loginResponse.ok) {
            console.log('❌ Login failed:', loginResponse.status);
            console.log('Response:', await loginResponse.text());
            return;
        }

        const loginData = await loginResponse.json();
        console.log('✅ Login successful');

        // Now test the ventas sin envio endpoint
        console.log('📋 Testing ventas sin envio endpoint...');
        const ventasResponse = await fetch('http://localhost:3001/api/ventas/sin-envio', {
            headers: {
                'Authorization': `Bearer ${loginData.token}`
            }
        });

        console.log('Status:', ventasResponse.status);
        
        if (!ventasResponse.ok) {
            console.log('❌ Ventas sin envio failed:', await ventasResponse.text());
            return;
        }

        const ventasData = await ventasResponse.json();
        console.log('✅ Ventas sin envio response:', JSON.stringify(ventasData, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testVentasSinEnvio();