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

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [session, setSession] = useState<{ user: any; tenant: string } | null>(null);
  const [checking, setChecking] = useState(true);

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
        return <Dashboard />;
      case 'clientes':
        return <Clientes />;
      case 'inventario':
        return <Inventario />;
      case 'ventas':
        return <Ventas />;
      case 'envios':
        return <Envios />;
      case 'creditos':
        return <Creditos />;
      case 'seguimiento':
        return <Seguimiento />;
      case 'pagos':
        return <Pagos />;
      case 'usuarios':
        return <Usuarios />;
      default:
        return <Dashboard />;
    }
  };

  if (checking) return null;

  if (!session) {
    return (
      <Login
        onSuccess={(data) => {
          setSession({ user: data.user, tenant: data.tenant });
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
