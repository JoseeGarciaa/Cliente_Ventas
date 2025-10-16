import { useState, useEffect } from 'react';
import { X, Package, Truck, MapPin, Save } from 'lucide-react';
import { salesController } from '../controllers/salesController';
import type { Envio, UpdateEnvioPayload } from '../models/types';

interface EditEnvioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnvioUpdated: () => void;
  envio: Envio | null;
}

export default function EditEnvioModal({ isOpen, onClose, onEnvioUpdated, envio }: EditEnvioModalProps) {
  const [formData, setFormData] = useState<UpdateEnvioPayload>({
    DireccionEntrega: '',
    Ciudad: '',
    Departamento: '',
    Barrio: '',
    OperadorLogistico: '',
    NumeroGuia: '',
    Observaciones: '',
    Estado: 'pendiente',
    Calificacion: 'Pendiente'
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (envio && isOpen) {
      setFormData({
        DireccionEntrega: envio.DireccionEntrega || '',
        Ciudad: envio.Ciudad || '',
        Departamento: envio.Departamento || '',
        Barrio: envio.Barrio || '',
        OperadorLogistico: envio.OperadorLogistico || '',
        NumeroGuia: envio.NumeroGuia || '',
        Observaciones: envio.Observaciones || '',
        Estado: envio.Estado || 'pendiente',
        Calificacion: envio.Calificacion || 'Pendiente'
      });
    }
  }, [envio, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!envio) return;

    setLoading(true);
    setError(null);

    try {
      await salesController.updateEnvio(envio.id, formData);
      onEnvioUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el envío');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setError(null);
  };

  if (!isOpen || !envio) return null;

  const estados = [
    { value: 'pendiente', label: 'Pendiente', color: 'bg-gray-100 text-gray-700' },
    { value: 'confirmada', label: 'Confirmada', color: 'bg-blue-100 text-blue-700' },
    { value: 'enviada', label: 'Enviada', color: 'bg-indigo-100 text-indigo-700' },
    { value: 'entregada', label: 'Entregada', color: 'bg-green-100 text-green-700' },
    { value: 'cancelada', label: 'Cancelada', color: 'bg-red-100 text-red-700' },
    { value: 'devuelta', label: 'Devuelta', color: 'bg-orange-100 text-orange-700' }
  ];

  const calificaciones = [
    { value: 'Pendiente', label: 'Pendiente' },
    { value: 'Positivo', label: 'Positivo' },
    { value: 'Negativo', label: 'Negativo' },
    { value: 'Hurto', label: 'Hurto' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Package className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Editar Envío</h2>
              <p className="text-sm text-gray-500">Envío #{envio.id} - Venta #{envio.VentaId}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Estado y Calificación */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado del Envío <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.Estado}
                onChange={(e) => setFormData(prev => ({ ...prev, Estado: e.target.value as 'pendiente' | 'confirmada' | 'enviada' | 'entregada' | 'cancelada' | 'devuelta' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {estados.map(estado => (
                  <option key={estado.value} value={estado.value}>
                    {estado.label}
                  </option>
                ))}
              </select>
              <div className="mt-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  estados.find(e => e.value === formData.Estado)?.color || 'bg-gray-100 text-gray-700'
                }`}>
                  {estados.find(e => e.value === formData.Estado)?.label || formData.Estado}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Calificación
              </label>
              <select
                value={formData.Calificacion}
                onChange={(e) => setFormData(prev => ({ ...prev, Calificacion: e.target.value as 'Pendiente' | 'Positivo' | 'Negativo' | 'Hurto' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {calificaciones.map(cal => (
                  <option key={cal.value} value={cal.value}>
                    {cal.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Información del Cliente */}
          {envio.cliente && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center space-x-2">
                <MapPin className="w-4 h-4" />
                <span>Información del Cliente</span>
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Cliente:</span>
                  <span className="ml-2 text-gray-900">{envio.cliente.nombre}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Teléfono:</span>
                  <span className="ml-2 text-gray-900">{envio.cliente.telefono || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Dirección de Entrega */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Dirección de Entrega</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dirección <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={formData.DireccionEntrega}
                onChange={(e) => setFormData(prev => ({ ...prev, DireccionEntrega: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Dirección completa de entrega"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ciudad
                </label>
                <input
                  type="text"
                  value={formData.Ciudad}
                  onChange={(e) => setFormData(prev => ({ ...prev, Ciudad: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ciudad"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Departamento
                </label>
                <input
                  type="text"
                  value={formData.Departamento}
                  onChange={(e) => setFormData(prev => ({ ...prev, Departamento: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Departamento"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Barrio
              </label>
              <input
                type="text"
                value={formData.Barrio}
                onChange={(e) => setFormData(prev => ({ ...prev, Barrio: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Barrio"
              />
            </div>
          </div>

          {/* Información de Logística */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
              <Truck className="w-5 h-5" />
              <span>Información de Logística</span>
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Operador Logístico
                </label>
                <input
                  type="text"
                  value={formData.OperadorLogistico}
                  onChange={(e) => setFormData(prev => ({ ...prev, OperadorLogistico: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: Servientrega, TCC, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Guía
                </label>
                <input
                  type="text"
                  value={formData.NumeroGuia}
                  onChange={(e) => setFormData(prev => ({ ...prev, NumeroGuia: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Número de guía"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones
              </label>
              <textarea
                rows={3}
                value={formData.Observaciones}
                onChange={(e) => setFormData(prev => ({ ...prev, Observaciones: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Observaciones especiales para el envío"
              />
            </div>
          </div>

          {/* Información Adicional */}
          {envio.venta && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2">Información de la Venta</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-blue-700">Tipo:</span>
                  <span className="ml-2 text-blue-900">{envio.venta.tipoVenta === 'contado' ? 'Contado' : 'Crédito'}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Total:</span>
                  <span className="ml-2 text-blue-900">${envio.venta.total.toLocaleString()}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Estado Venta:</span>
                  <span className="ml-2 text-blue-900 capitalize">{envio.venta.estado}</span>
                </div>
              </div>
              <div className="mt-2 text-xs text-blue-700 bg-blue-100 px-3 py-2 rounded">
                <strong>Nota:</strong> Al cambiar el estado del envío, el estado de la venta se actualizará automáticamente.
              </div>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center space-x-2 px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              <Save className="w-4 h-4" />
              <span>{loading ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
