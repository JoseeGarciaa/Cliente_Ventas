import { Search, MapPin, Package, Truck, CheckCircle, Calendar } from 'lucide-react';
import { salesController } from '../controllers/salesController';

export default function Envios() {
  const envios = salesController.getEnvios();

  const getStatusBadge = (estado: string) => {
    const styles = {
      entregado: 'bg-green-100 text-green-700',
      en_camino: 'bg-blue-100 text-blue-700',
      preparando: 'bg-yellow-100 text-yellow-700',
    };
    return styles[estado as keyof typeof styles] || styles.preparando;
  };

  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case 'entregado':
        return <CheckCircle className="w-4 h-4" />;
      case 'en_camino':
        return <Truck className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Gestión de Envíos</h3>
          <p className="text-gray-600 text-sm mt-1">Monitorea el estado de todos los envíos</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar envío por ID o cliente..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option>Todos los estados</option>
            <option>Preparando</option>
            <option>En camino</option>
            <option>Entregado</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm">Preparando</p>
            <Package className="w-8 h-8 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm">En Camino</p>
            <Truck className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm">Entregados</p>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm">Total Envíos</p>
            <MapPin className="w-8 h-8 text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{envios.length}</p>
        </div>
      </div>

      {/* Shipments Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  ID Envío
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Venta
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Dirección
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Ciudad
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Fecha Estimada
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {envios.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <Truck className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">No hay envíos registrados</p>
                      <p className="text-gray-400 text-sm">Los envíos aparecerán aquí cuando realices ventas</p>
                    </div>
                  </td>
                </tr>
              ) : (
                envios.map((envio) => (
                  <tr key={envio.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-semibold text-gray-900">
                        #ENV-{envio.id.slice(0, 6)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-gray-600">
                        #{envio.venta_id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{envio.direccion}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {envio.ciudad}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(envio.fecha_estimada).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(envio.estado)}`}>
                        {getStatusIcon(envio.estado)}
                        <span className="capitalize">{envio.estado.replace('_', ' ')}</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Map Placeholder */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-sm p-8 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-1">Rastreo en tiempo real</h4>
            <p className="text-gray-600 text-sm">Visualiza la ubicación de tus envíos en el mapa</p>
          </div>
          <MapPin className="w-12 h-12 text-blue-600" />
        </div>
      </div>
    </div>
  );
}
