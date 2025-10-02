import { Plus, Search, Eye, Calendar, DollarSign, CheckCircle, XCircle, Clock } from 'lucide-react';
import { salesController } from '../controllers/salesController';

export default function Ventas() {
  const ventas = salesController.getVentas();

  const getStatusBadge = (estado: string) => {
    const styles = {
      completada: 'bg-green-100 text-green-700',
      pendiente: 'bg-yellow-100 text-yellow-700',
      cancelada: 'bg-red-100 text-red-700',
    };
    return styles[estado as keyof typeof styles] || styles.pendiente;
  };

  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case 'completada':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelada':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Registro de Ventas</h3>
          <p className="text-gray-600 text-sm mt-1">Gestiona y consulta todas las ventas realizadas</p>
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          <Plus className="w-4 h-4" />
          <span>Nueva Venta</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por cliente o ID de venta..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent">
            <option>Todos los estados</option>
            <option>Completada</option>
            <option>Pendiente</option>
            <option>Cancelada</option>
          </select>
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Calendar className="w-4 h-4" />
            <span>Filtrar por fecha</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm mb-1">Total Ventas</p>
          <p className="text-3xl font-bold text-gray-900">{ventas.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm mb-1">Ingresos Totales</p>
          <p className="text-3xl font-bold text-gray-900">$ 0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm mb-1">Pendientes</p>
          <p className="text-3xl font-bold text-gray-900">0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm mb-1">Promedio Venta</p>
          <p className="text-3xl font-bold text-gray-900">$ 0</p>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  ID Venta
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Método Pago
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ventas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <DollarSign className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">No hay ventas registradas</p>
                      <p className="text-gray-400 text-sm">Crea tu primera venta para comenzar</p>
                    </div>
                  </td>
                </tr>
              ) : (
                ventas.map((venta) => (
                  <tr key={venta.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-semibold text-gray-900">
                        #{venta.id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(venta.fecha).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{venta.cliente_id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-900">$ {venta.total.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {venta.metodo_pago}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(venta.estado)}`}>
                        {getStatusIcon(venta.estado)}
                        <span className="capitalize">{venta.estado}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end">
                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
