import { ReactNode } from 'react';
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
  Bell
} from 'lucide-react';

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
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg flex flex-col">
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
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onNavigate(item.id)}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-gray-800 capitalize">
              {menuItems.find(item => item.id === currentView)?.label || 'Dashboard'}
            </h2>
            <div className="flex items-center space-x-6">
              <div className="relative">
                <Bell className="w-6 h-6 text-gray-600 cursor-pointer hover:text-gray-800" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs flex items-center justify-center rounded-full">
                  2
                </span>
              </div>
              <button onClick={onLogout} className="flex items-center space-x-2 text-gray-600 hover:text-gray-800">
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Salir</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
