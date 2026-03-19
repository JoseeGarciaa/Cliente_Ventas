import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import Clientes from './views/Clientes';
import Inventario from './views/Inventario';
import Ventas from './views/Ventas';
import Envios from './views/Envios';
import Creditos from './views/Creditos';
import Seguimiento from './views/Seguimiento';
import Pagos from './views/Pagos';
import Usuarios from './views/Usuarios';
import Login from './views/Login';
import { auth, me } from './lib/api';
import { FEATURE_PAGOS_VISIBLE } from './lib/featureFlags';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [session, setSession] = useState<{ user: any; tenant: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const isVendedor = String(session?.user?.rol || '').toLowerCase() === 'vendedor';
  const vendedorAllowedViews = new Set(['clientes', 'inventario', 'ventas', 'envios']);

  useEffect(() => {
    if (isVendedor && !vendedorAllowedViews.has(currentView)) {
      setCurrentView('ventas');
    }
  }, [isVendedor, currentView]);

  useEffect(() => {
    if (!FEATURE_PAGOS_VISIBLE && currentView === 'pagos') {
      setCurrentView(isVendedor ? 'ventas' : 'dashboard');
    }
  }, [currentView, isVendedor]);

  useEffect(() => {
    const boot = async () => {
      try {
        if (auth.getToken()) {
          const data = await me();
          setSession(data);
        }
      } catch {
        // token inválido
        auth.clear();
      } finally {
        setChecking(false);
      }
    };
    boot();
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return isVendedor ? <Ventas /> : <Dashboard />;
      case 'clientes':
        return <Clientes />;
      case 'inventario':
        return <Inventario user={session?.user} />;
      case 'ventas':
        return <Ventas user={session?.user} />;
      case 'envios':
        return <Envios user={session?.user} />;
      case 'creditos':
        return isVendedor ? <Ventas /> : <Creditos />;
      case 'seguimiento':
        return isVendedor ? <Ventas /> : <Seguimiento />;
      case 'pagos':
        return isVendedor ? <Ventas /> : <Pagos />;
      case 'usuarios':
        return isVendedor ? <Ventas /> : <Usuarios />;
      default:
        return isVendedor ? <Ventas /> : <Dashboard />;
    }
  };

  if (checking) return null;

  if (!session) {
    return (
      <Login
        onSuccess={(data) => {
          setSession({ user: data.user, tenant: data.tenant });
          if (String(data?.user?.rol || '').toLowerCase() === 'vendedor') {
            setCurrentView('ventas');
          }
        }}
      />
    );
  }

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView} user={session.user} tenant={session.tenant} onLogout={() => { auth.clear(); setSession(null); }}>
      {renderView()}
    </Layout>
  );
}

export default App;
