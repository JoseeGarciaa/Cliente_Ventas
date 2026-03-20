import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Truck,
  CreditCard,
  Eye,
  DollarSign,
  UserCog,
  LogOut,
  Bell,
  Menu,
  X,
} from 'lucide-react';
import { FEATURE_PAGOS_VISIBLE } from '../lib/featureFlags';
import { salesController } from '../controllers/salesController';
import { subscribeVentasEnviosSync } from '../lib/syncEvents';

interface LayoutProps {
  children: ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
  user?: any;
  tenant?: string;
  onLogout?: () => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'inventario', label: 'Inventario', icon: Package },
  { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
  { id: 'envios', label: 'Envíos', icon: Truck },
  { id: 'creditos', label: 'Créditos', icon: CreditCard },
  { id: 'seguimiento', label: 'Seguimientos', icon: Eye },
  { id: 'pagos', label: 'Pagos', icon: DollarSign },
  { id: 'usuarios', label: 'Usuarios', icon: UserCog },
];

export default function Layout({ children, currentView, onNavigate, user, tenant, onLogout }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const userRole = String(user?.rol || '').toLowerCase();
  const vendedorAllowedViews = new Set(['clientes', 'inventario', 'ventas', 'envios']);
  const baseMenuItems = FEATURE_PAGOS_VISIBLE ? menuItems : menuItems.filter((item) => item.id !== 'pagos');
  const visibleMenuItems =
    userRole === 'vendedor'
      ? baseMenuItems.filter((item) => vendedorAllowedViews.has(item.id))
      : baseMenuItems;
  const knownVentaIdsRef = useRef<Set<number>>(new Set());
  const initializedRef = useRef(false);
  const loadingAlertsRef = useRef(false);

  const playAlertTone = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.linearRampToValueAtTime(1175, context.currentTime + 0.18);

      gain.gain.setValueAtTime(0.001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.24);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.24);

      window.setTimeout(() => {
        context.close().catch(() => undefined);
      }, 500);
    } catch {
      // Ignora errores de autoplay o de contexto de audio no disponible.
    }
  };

  const refreshSalesAlerts = async (playSound: boolean) => {
    if (loadingAlertsRef.current || userRole === 'vendedor') return;

    loadingAlertsRef.current = true;
    try {
      const ventas = await salesController.getVentas();
      const nextIds = new Set(
        ventas
          .map((venta) => Number(venta.id))
          .filter((id) => Number.isInteger(id) && id > 0)
      );

      if (!initializedRef.current) {
        knownVentaIdsRef.current = nextIds;
        initializedRef.current = true;
        return;
      }

      let newCount = 0;
      nextIds.forEach((id) => {
        if (!knownVentaIdsRef.current.has(id)) {
          newCount += 1;
        }
      });

      knownVentaIdsRef.current = nextIds;
      if (newCount > 0) {
        setNotificationCount((prev) => prev + newCount);
        if (playSound) {
          playAlertTone();
        }
      }
    } catch {
      // Si falla consulta de ventas, no interrumpe navegación.
    } finally {
      loadingAlertsRef.current = false;
    }
  };

  const handleNavigate = (view: string) => {
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    if (userRole === 'vendedor') {
      setNotificationCount(0);
      knownVentaIdsRef.current = new Set();
      initializedRef.current = true;
      return;
    }

    initializedRef.current = false;
    refreshSalesAlerts(false);

    const intervalId = window.setInterval(() => {
      refreshSalesAlerts(true);
    }, 15000);

    const unsubscribe = subscribeVentasEnviosSync((source) => {
      if (source !== 'ventas') return;
      refreshSalesAlerts(true);
    });

    return () => {
      window.clearInterval(intervalId);
      unsubscribe();
    };
  }, [userRole]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-x-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 bg-white shadow-lg flex-col shrink-0">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800">Sistema Ventas</h1>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{user?.nombre || 'Usuario'}</p>
              <p className="text-sm text-gray-500">{tenant || 'tenant'}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-200">
          <button onClick={onLogout} className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white shadow-xl flex flex-col transform transition-transform duration-200 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-800">Sistema Ventas</h1>
          <button
            type="button"
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            onClick={() => setMobileMenuOpen(false)}
            title="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 truncate">{user?.nombre || 'Usuario'}</p>
              <p className="text-sm text-gray-500 truncate">{tenant || 'tenant'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 md:px-8 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(true)}
                title="Abrir menú"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 capitalize truncate">
                {visibleMenuItems.find((item) => item.id === currentView)?.label || 'Dashboard'}
              </h2>
            </div>
            <div className="flex items-center space-x-3 sm:space-x-6">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationCount(0)}
                  title={notificationCount > 0 ? 'Limpiar notificaciones de ventas nuevas' : 'Sin notificaciones nuevas'}
                  className="p-0 bg-transparent border-0"
                >
                  <Bell
                    className={`w-6 h-6 cursor-pointer transition-colors ${notificationCount > 0 ? 'text-red-600 hover:text-red-700' : 'text-gray-600 hover:text-gray-800'}`}
                  />
                </button>
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 text-white text-xs flex items-center justify-center rounded-full">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </div>
              <button onClick={onLogout} className="hidden sm:flex items-center space-x-2 text-gray-600 hover:text-gray-800">
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Salir</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-gray-50 p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
