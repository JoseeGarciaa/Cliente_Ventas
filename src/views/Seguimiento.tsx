import { Search, Eye, Activity, TrendingUp, BarChart3, Users, Package, ShoppingCart } from 'lucide-react';

export default function Seguimiento() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Seguimiento y Análisis</h3>
          <p className="text-gray-600 text-sm mt-1">Monitorea el rendimiento y actividades del sistema</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar actividad o transacción..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-600 text-sm font-medium">Ventas Hoy</p>
            <ShoppingCart className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">0</p>
          <div className="flex items-center text-green-600 text-sm">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>+0% vs ayer</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-600 text-sm font-medium">Clientes Activos</p>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">0</p>
          <div className="flex items-center text-blue-600 text-sm">
            <Activity className="w-4 h-4 mr-1" />
            <span>En línea ahora</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-600 text-sm font-medium">Productos Bajos</p>
            <Package className="w-8 h-8 text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">0</p>
          <div className="flex items-center text-orange-600 text-sm">
            <Activity className="w-4 h-4 mr-1" />
            <span>Requieren atención</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-600 text-sm font-medium">Tasa Conversión</p>
            <BarChart3 className="w-8 h-8 text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">0%</p>
          <div className="flex items-center text-purple-600 text-sm">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>Promedio mensual</span>
          </div>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="text-lg font-semibold text-gray-900">Actividad Reciente</h4>
            <p className="text-sm text-gray-600 mt-1">Últimas 24 horas</p>
          </div>
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
            <option>Últimas 24h</option>
            <option>Última semana</option>
            <option>Último mes</option>
          </select>
        </div>

        <div className="h-64 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg flex items-center justify-center border border-gray-200">
          <div className="text-center">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Gráfico de actividad</p>
            <p className="text-gray-400 text-sm">Los datos de actividad se mostrarán aquí</p>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900">Registro de Actividades</h4>
          <p className="text-sm text-gray-600 mt-1">Historial de todas las acciones del sistema</p>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Sistema iniciado</p>
                <p className="text-xs text-gray-600">Todas las funciones operativas</p>
              </div>
              <span className="text-xs text-gray-500">Hace un momento</span>
            </div>

            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Eye className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 font-medium">No hay actividades recientes</p>
                <p className="text-gray-400 text-sm">Las actividades aparecerán aquí conforme sucedan</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Productos Más Vendidos</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <TrendingUp className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Sin datos disponibles</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Clientes Frecuentes</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Users className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Sin datos disponibles</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
