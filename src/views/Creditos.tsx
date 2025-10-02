import { Search, AlertCircle, CheckCircle, Clock, Calendar, DollarSign } from 'lucide-react';
import { salesController } from '../controllers/salesController';

export default function Creditos() {
  const creditos = salesController.getCreditos();

  const getStatusBadge = (estado: string) => {
    const styles = {
      pagado: 'bg-green-100 text-green-700',
      activo: 'bg-blue-100 text-blue-700',
      vencido: 'bg-red-100 text-red-700',
    };
    return styles[estado as keyof typeof styles] || styles.activo;
  };

  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case 'pagado':
        return <CheckCircle className="w-4 h-4" />;
      case 'vencido':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Control de Créditos</h3>
          <p className="text-gray-600 text-sm mt-1">Gestiona los créditos otorgados a clientes</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar crédito por cliente..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">
            <option>Todos los estados</option>
            <option>Activo</option>
            <option>Vencido</option>
            <option>Pagado</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-500">
          <p className="text-gray-600 text-sm mb-1">Total Créditos</p>
          <p className="text-3xl font-bold text-gray-900">{creditos.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm mb-1">Monto Otorgado</p>
          <p className="text-3xl font-bold text-gray-900">$ 0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm mb-1">Monto Cobrado</p>
          <p className="text-3xl font-bold text-gray-900">$ 0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm mb-1">Monto Pendiente</p>
          <p className="text-3xl font-bold text-gray-900">$ 0</p>
        </div>
      </div>

      {/* Credits Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  ID Crédito
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Monto Total
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Pagado
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Pendiente
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Vencimiento
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {creditos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <DollarSign className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">No hay créditos registrados</p>
                      <p className="text-gray-400 text-sm">Los créditos otorgados aparecerán aquí</p>
                    </div>
                  </td>
                </tr>
              ) : (
                creditos.map((credito) => {
                  const porcentajePagado = (credito.monto_pagado / credito.monto_total) * 100;
                  return (
                    <tr key={credito.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-semibold text-gray-900">
                          #CRD-{credito.id.slice(0, 6)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{credito.cliente_id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-900">
                          $ {credito.monto_total.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className="text-sm font-semibold text-green-600">
                            $ {credito.monto_pagado.toLocaleString()}
                          </span>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${porcentajePagado}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-orange-600">
                          $ {credito.monto_pendiente.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(credito.fecha_vencimiento).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(credito.estado)}`}>
                          {getStatusIcon(credito.estado)}
                          <span className="capitalize">{credito.estado}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alert Box */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">Créditos Vencidos</h4>
            <p className="text-gray-600 text-sm">
              Actualmente tienes 0 créditos vencidos que requieren atención inmediata
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
