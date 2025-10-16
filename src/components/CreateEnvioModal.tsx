import { useState, useEffect } from 'react';
import { X, User, MapPin, Package, Printer } from 'lucide-react';
import { salesController } from '../controllers/salesController';
import type { VentaSinEnvio, CreateEnvioPayload } from '../models/types';

interface CreateEnvioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnvioCreated: () => void;
  venta?: VentaSinEnvio | null;
}

export default function CreateEnvioModal({ isOpen, onClose, onEnvioCreated, venta }: CreateEnvioModalProps) {
  const [formData, setFormData] = useState<CreateEnvioPayload>({
    VentaId: 0,
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
  
  const [useClientAddress, setUseClientAddress] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (venta && isOpen) {
      setFormData(prev => ({
        ...prev,
        VentaId: venta.id,
        DireccionEntrega: useClientAddress ? (venta.cliente.direccion || '') : prev.DireccionEntrega,
        Ciudad: useClientAddress ? (venta.cliente.ciudad || '') : prev.Ciudad,
        Departamento: useClientAddress ? (venta.cliente.departamento || '') : prev.Departamento,
        Barrio: useClientAddress ? (venta.cliente.barrio || '') : prev.Barrio
      }));
    }
  }, [venta, isOpen, useClientAddress]);

  useEffect(() => {
    if (useClientAddress && venta) {
      setFormData(prev => ({
        ...prev,
        DireccionEntrega: venta.cliente.direccion || '',
        Ciudad: venta.cliente.ciudad || '',
        Departamento: venta.cliente.departamento || '',
        Barrio: venta.cliente.barrio || ''
      }));
    }
  }, [useClientAddress, venta]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venta) return;

    setLoading(true);
    setError(null);

    try {
      await salesController.createEnvio(formData);
      onEnvioCreated();
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el envío');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      VentaId: 0,
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
    setUseClientAddress(true);
    setError(null);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const handlePrintLabel = () => {
    if (!venta) return;
    
    // Crear contenido del rótulo
    const labelContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Rótulo de Envío</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px;
            font-size: 12px;
          }
          .label { 
            border: 2px solid #000; 
            padding: 15px; 
            max-width: 400px;
            margin: 0 auto;
          }
          .header { 
            text-align: center; 
            border-bottom: 1px solid #000; 
            padding-bottom: 10px; 
            margin-bottom: 15px;
            font-weight: bold;
            font-size: 16px;
          }
          .section { 
            margin-bottom: 15px; 
            padding: 10px;
            border: 1px solid #ccc;
          }
          .section-title { 
            font-weight: bold; 
            margin-bottom: 8px;
            background: #f0f0f0;
            padding: 5px;
            margin: -10px -10px 8px -10px;
          }
          .row { 
            margin-bottom: 5px; 
          }
          .label-field { 
            font-weight: bold; 
            display: inline-block; 
            width: 120px;
          }
          .barcode {
            text-align: center;
            font-family: monospace;
            font-size: 18px;
            letter-spacing: 2px;
            margin: 10px 0;
            border: 1px solid #000;
            padding: 5px;
          }
          @media print {
            body { margin: 0; padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="header">
            RÓTULO DE ENVÍO
          </div>
          
          <div class="section">
            <div class="section-title">REMITENTE</div>
            <div class="row">
              <span class="label-field">Empresa:</span>
              Sistema Ventas
            </div>
            <div class="row">
              <span class="label-field">Dirección:</span>
              [Dirección de la empresa]
            </div>
            <div class="row">
              <span class="label-field">Teléfono:</span>
              [Teléfono de la empresa]
            </div>
          </div>

          <div class="section">
            <div class="section-title">DESTINATARIO</div>
            <div class="row">
              <span class="label-field">Nombre:</span>
              ${venta.cliente.nombre}
            </div>
            <div class="row">
              <span class="label-field">Documento:</span>
              ${venta.cliente.tipoIdentificacion} ${venta.cliente.numeroDocumento}
            </div>
            <div class="row">
              <span class="label-field">Teléfono:</span>
              ${venta.cliente.telefono || 'No registrado'}
            </div>
            <div class="row">
              <span class="label-field">Email:</span>
              ${venta.cliente.correo || 'No registrado'}
            </div>
            <div class="row">
              <span class="label-field">Dirección:</span>
              ${formData.DireccionEntrega}
            </div>
            ${formData.Barrio ? `
            <div class="row">
              <span class="label-field">Barrio:</span>
              ${formData.Barrio}
            </div>
            ` : ''}
            <div class="row">
              <span class="label-field">Ciudad:</span>
              ${formData.Ciudad}
            </div>
            ${formData.Departamento ? `
            <div class="row">
              <span class="label-field">Departamento:</span>
              ${formData.Departamento}
            </div>
            ` : ''}
          </div>

          <div class="section">
            <div class="section-title">INFORMACIÓN DEL ENVÍO</div>
            <div class="row">
              <span class="label-field">Venta #:</span>
              ${venta.id}
            </div>
            <div class="row">
              <span class="label-field">Fecha:</span>
              ${new Date(venta.fecha).toLocaleDateString()}
            </div>
            <div class="row">
              <span class="label-field">Valor:</span>
              $${venta.total.toLocaleString()}
            </div>
            <div class="row">
              <span class="label-field">Tipo Venta:</span>
              ${venta.tipoVenta === 'contado' ? 'Contado' : 'Crédito'}
            </div>
            ${formData.OperadorLogistico ? `
            <div class="row">
              <span class="label-field">Operador:</span>
              ${formData.OperadorLogistico}
            </div>
            ` : ''}
            ${formData.NumeroGuia ? `
            <div class="row">
              <span class="label-field">Guía:</span>
              ${formData.NumeroGuia}
            </div>
            ` : ''}
          </div>

          ${formData.Observaciones ? `
          <div class="section">
            <div class="section-title">OBSERVACIONES</div>
            <div>${formData.Observaciones}</div>
          </div>
          ` : ''}

          <div class="barcode">
            ENV-${Date.now().toString().slice(-8)}
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    // Abrir ventana de impresión
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (printWindow) {
      printWindow.document.write(labelContent);
      printWindow.document.close();
    }
  };

  if (!isOpen || !venta) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Package className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Crear Envío</h2>
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

          {/* Información de la Venta */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-3">
              <User className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Información de la Venta</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Venta #:</span>
                <span className="ml-2 text-gray-900">{venta.id}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Fecha:</span>
                <span className="ml-2 text-gray-900">{new Date(venta.fecha).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Cliente:</span>
                <span className="ml-2 text-gray-900">{venta.cliente.nombre}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Total:</span>
                <span className="ml-2 text-gray-900">${venta.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Dirección de Entrega */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Dirección de Entrega</h3>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={useClientAddress}
                  onChange={() => setUseClientAddress(true)}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Usar dirección del cliente</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  checked={!useClientAddress}
                  onChange={() => setUseClientAddress(false)}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Dirección nueva</span>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4">
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
          </div>

          {/* Información de Logística */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Información de Logística</h3>
            
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

          {/* Botones de Acción */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handlePrintLabel}
              className="inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Vista Previa del Rótulo</span>
            </button>

            <div className="flex items-center space-x-3">
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
                <span>{loading ? 'Creando...' : 'Crear Envío'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}