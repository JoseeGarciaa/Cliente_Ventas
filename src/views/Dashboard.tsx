import { Filter, ShoppingCart, TrendingUp, Users, CreditCard, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import { salesController } from '../controllers/salesController';

export default function Dashboard() {
  const stats = salesController.getDashboardStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Dashboard</h3>
          <p className="text-blue-600 text-sm mt-1">
            Vista de Administrador - Mostrando datos de todos los vendedores
          </p>
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Filter className="w-4 h-4" />
          <span>Filtrar por fecha</span>
        </button>
      </div>

      {/* Executive Summary */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Resumen Ejecutivo</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Ventas del Mes */}
          <div className="bg-white rounded-xl shadow-sm border-l-4 border-blue-500 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Ventas del Mes (Todas)</p>
                <p className="text-4xl font-bold text-gray-900">{stats.ventasMes}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="flex items-center space-x-1 text-blue-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">Activo Global</span>
            </div>
          </div>

          {/* Total Ingresos */}
          <div className="bg-white rounded-xl shadow-sm border-l-4 border-green-500 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Total Ingresos</p>
                <p className="text-4xl font-bold text-gray-900">$ {stats.totalIngresos.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="flex items-center space-x-1 text-green-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">Total acumulado</span>
            </div>
          </div>

          {/* Total Clientes */}
          <div className="bg-white rounded-xl shadow-sm border-l-4 border-purple-500 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Total Clientes</p>
                <p className="text-4xl font-bold text-gray-900">{stats.totalClientes}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="flex items-center space-x-1 text-purple-600">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">Registrados</span>
            </div>
          </div>

          {/* Creditos Vencidos */}
          <div className="bg-white rounded-xl shadow-sm border-l-4 border-orange-500 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Créditos Vencidos</p>
                <p className="text-4xl font-bold text-gray-900">{stats.creditosVencidos}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="flex items-center space-x-1 text-orange-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">Requieren atención</span>
            </div>
          </div>

          {/* Perdidas por Devoluciones */}
          <div className="bg-white rounded-xl shadow-sm border-l-4 border-red-500 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Pérdidas por Devoluciones</p>
                <p className="text-4xl font-bold text-gray-900">$ {stats.perdidasDevoluciones}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="flex items-center space-x-1 text-red-600">
              <TrendingDown className="w-4 h-4" />
              <span className="text-sm font-medium">{stats.perdidasDevoluciones} devoluciones</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Metrics */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Métricas Operativas</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Costo de Inventario */}
          <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-2">Costo de Inventario</p>
                <p className="text-3xl font-bold text-gray-900">$ {stats.costoInventario.toLocaleString()}</p>
              </div>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: '65%' }}></div>
            </div>
          </div>

          {/* Total Ventas */}
          <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-2">Total Ventas</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalVentas}</p>
              </div>
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-purple-600 rounded-full" style={{ width: '45%' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Panel de administración */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm p-8 border border-blue-200">
        <h4 className="text-2xl font-bold text-gray-900 mb-2">Panel de administración</h4>
        <p className="text-gray-600">Gestiona todas las operaciones del sistema desde aquí</p>
      </div>
    </div>
  );
}
