import { Search, MapPin, Package, Truck, CheckCircle, Calendar, Plus, ShoppingCart, Edit, Undo2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { salesController } from '../controllers/salesController';
import CreateEnvioModal from '../components/CreateEnvioModal';
import EditEnvioModal from '../components/EditEnvioModal';
import { emitVentasEnviosSync, subscribeVentasEnviosSync } from '../lib/syncEvents';
import type { Envio, EnviosStats, VentaSinEnvio } from '../models/types';

interface EnviosProps {
  user?: any;
}

export default function Envios({ user }: EnviosProps) {
  const isVendedor = String(user?.rol || '').toLowerCase() === 'vendedor';
  const currentUserId = Number(user?.id);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [stats, setStats] = useState<EnviosStats>({
    totalEnvios: 0,
    pendientes: 0,
    confirmados: 0,
    enviados: 0,
    entregados: 0,
    cancelados: 0,
    devueltos: 0
  });
  const [ventasSinEnvio, setVentasSinEnvio] = useState<VentaSinEnvio[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingVentas, setLoadingVentas] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [activeTab, setActiveTab] = useState<'envios' | 'crear'>('envios');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<VentaSinEnvio | null>(null);
  const [selectedEnvio, setSelectedEnvio] = useState<Envio | null>(null);

  useEffect(() => {
    console.log('🚀 Envios component mounted');
    loadEnvios();
    loadStats();
    loadVentasSinEnvio();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeVentasEnviosSync((source) => {
      if (source === 'envios') return;
      loadEnvios();
      loadStats();
      loadVentasSinEnvio();
    });

    return unsubscribe;
  }, []);

  const loadEnvios = async () => {
    try {
      setLoading(true);
      const response = await salesController.getEnvios();
  setEnvios(response.envios ?? []);
    } catch (error) {
      console.error('Error loading envios:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await salesController.getEnviosStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading envio stats:', error);
    }
  };

  const loadVentasSinEnvio = async () => {
    try {
      console.log('Loading ventas sin envio...');
      setLoadingVentas(true);
      const response = await salesController.getVentasSinEnvio();
      console.log('Ventas sin envio response:', response);
  setVentasSinEnvio(response.ventas ?? []);
    } catch (error) {
      console.error('Error loading ventas sin envio:', error);
    } finally {
      setLoadingVentas(false);
    }
  };

  const handleCreateEnvio = (venta: VentaSinEnvio) => {
    setSelectedVenta(venta);
    setIsCreateModalOpen(true);
  };

  const handleEditEnvio = (envio: Envio) => {
    setSelectedEnvio(envio);
    setIsEditModalOpen(true);
  };

  const handleEnvioCreated = () => {
    loadEnvios();
    loadStats();
    loadVentasSinEnvio();
    emitVentasEnviosSync('envios');
  };

  const handleEnvioUpdated = () => {
    loadEnvios();
    loadStats();
    loadVentasSinEnvio();
    emitVentasEnviosSync('envios');
  };

  const filteredEnvios = envios.filter(envio => {
    const matchesOwnership =
      !isVendedor ||
      (Number.isInteger(currentUserId) && Number(envio.venta?.usuarioId ?? 0) === currentUserId);

    const lowerSearch = searchTerm.trim().toLowerCase();
    const matchesSearch =
      lowerSearch.length === 0 ||
      envio.id.toString().includes(lowerSearch) ||
      envio.VentaId.toString().includes(lowerSearch) ||
      (envio.DireccionEntrega?.toLowerCase().includes(lowerSearch) ?? false) ||
      (envio.Ciudad?.toLowerCase().includes(lowerSearch) ?? false) ||
  (envio.Departamento?.toLowerCase().includes(lowerSearch) ?? false) ||
      (envio.NumeroGuia?.toLowerCase().includes(lowerSearch) ?? false) ||
  (envio.OperadorLogistico?.toLowerCase().includes(lowerSearch) ?? false) ||
      (envio.cliente?.nombre?.toLowerCase().includes(lowerSearch) ?? false) ||
      (envio.venta?.estado?.toLowerCase().includes(lowerSearch) ?? false) ||
      (envio.venta?.tipoVenta?.toLowerCase().includes(lowerSearch) ?? false);

    const matchesStatus = statusFilter === 'todos' || envio.Estado === statusFilter;

    return matchesOwnership && matchesSearch && matchesStatus;
  });

  const getStatusBadge = (estado: string) => {
    const styles = {
      pendiente: 'bg-gray-100 text-gray-700',
      confirmada: 'bg-blue-100 text-blue-700',
      enviada: 'bg-indigo-100 text-indigo-700',
      entregada: 'bg-green-100 text-green-700',
      cancelada: 'bg-red-100 text-red-700',
      devuelta: 'bg-orange-100 text-orange-700',
    };
    return styles[estado as keyof typeof styles] || styles.pendiente;
  };

  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case 'entregada':
        return <CheckCircle className="w-4 h-4" />;
      case 'enviada':
        return <Truck className="w-4 h-4" />;
      case 'confirmada':
        return <Package className="w-4 h-4" />;
      case 'devuelta':
        return <Undo2 className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const formatTipoVenta = (tipo?: string | null) => {
    if (!tipo) return 'Sin tipo';
    const normalized = tipo.toLowerCase();
    if (normalized === 'contado') return 'Contado';
    if (normalized === 'credito') return 'Crédito';
    return tipo.charAt(0).toUpperCase() + tipo.slice(1);
  };

  const formatEstadoVenta = (estado?: string | null) => {
    if (!estado) return 'Sin estado';
    return estado
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm min-w-0">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-6 px-4 sm:px-6 overflow-x-auto" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('envios')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'envios'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5" />
                <span>Envíos Creados</span>
                <span className="bg-gray-100 text-gray-900 rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {stats.totalEnvios}
                </span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('crear')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'crear'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <ShoppingCart className="w-5 h-5" />
                <span>Ventas Sin Envío</span>
                <span className="bg-blue-100 text-blue-900 rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {ventasSinEnvio.length}
                </span>
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'envios' ? (
        <>
          {/* Search and Filter */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar envío por venta, cliente, ciudad o guía..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select 
                title="Filtrar envíos por estado"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="todos">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="confirmada">Confirmada</option>
                <option value="enviada">Enviada</option>
                <option value="entregada">Entregada</option>
                <option value="cancelada">Cancelada</option>
                <option value="devuelta">Devuelta</option>
              </select>
            </div>
          </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-gray-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm">Pendientes</p>
            <Package className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.pendientes}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm">Confirmados</p>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.confirmados}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-indigo-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm">Enviados</p>
            <Truck className="w-8 h-8 text-indigo-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.enviados}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm">Entregados</p>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.entregados}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-600 text-sm">Total Envíos</p>
            <MapPin className="w-8 h-8 text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.totalEnvios}</p>
        </div>
      </div>

      {/* Shipments Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden min-w-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Cargando envíos...</span>
          </div>
        ) : (
          <>
          <div className="hidden md:block overflow-x-auto">
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
                    Cliente
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Dirección
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ciudad
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Operador
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Número Guía
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Fecha Envío
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEnvios.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                          <Truck className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">
                          {envios.length === 0 ? 'No hay envíos registrados' : 'No se encontraron envíos con los criterios de búsqueda'}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {envios.length === 0 ? 'Los envíos aparecerán aquí cuando realices ventas' : 'Intenta modificar los filtros de búsqueda'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEnvios.map((envio) => (
                    <tr key={envio.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-semibold text-gray-900">
                          #ENV-{envio.id.toString().padStart(6, '0')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className="font-mono text-sm text-gray-600 block">
                            #{envio.VentaId}
                          </span>
                          {envio.venta && (
                            <>
                              <div className="text-xs text-gray-500">
                                {envio.venta.fecha ? new Date(envio.venta.fecha).toLocaleDateString() : 'Sin fecha'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatTipoVenta(envio.venta.tipoVenta)} · ${envio.venta.total.toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-400">
                                {formatEstadoVenta(envio.venta.estado)}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 font-medium">
                          {envio.cliente?.nombre || 'Cliente desconocido'}
                        </div>
                        {envio.cliente && (
                          <div className="text-xs text-gray-500 space-y-1">
                            {envio.cliente.telefono && <div>☎ {envio.cliente.telefono}</div>}
                            {envio.cliente.correo && <div>{envio.cliente.correo}</div>}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-900">{envio.DireccionEntrega}</div>
                            {envio.Barrio && (
                              <div className="text-xs text-gray-500">{envio.Barrio}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>
                          <div>{envio.Ciudad}</div>
                          {envio.Departamento && (
                            <div className="text-xs text-gray-500">{envio.Departamento}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {envio.OperadorLogistico || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {envio.NumeroGuia || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {envio.FechaEnvio ? new Date(envio.FechaEnvio).toLocaleDateString() : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(envio.Estado)}`}>
                          {getStatusIcon(envio.Estado)}
                          <span className="capitalize">{envio.Estado.replace('_', ' ')}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleEditEnvio(envio)}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                          title="Editar envío"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-gray-100">
            {filteredEnvios.length === 0 ? (
              <div className="px-6 py-10 text-center text-gray-500">No se encontraron envíos</div>
            ) : (
              filteredEnvios.map((envio) => (
                <div key={envio.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold text-gray-900">#ENV-{envio.id.toString().padStart(6, '0')}</p>
                      <p className="text-xs text-gray-500">Venta #{envio.VentaId}</p>
                    </div>
                    <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(envio.Estado)}`}>
                      {getStatusIcon(envio.Estado)}
                      <span className="capitalize">{envio.Estado.replace('_', ' ')}</span>
                    </span>
                  </div>
                  <div className="text-sm text-gray-700 space-y-1">
                    <p><span className="font-medium">Cliente:</span> {envio.cliente?.nombre || 'Cliente desconocido'}</p>
                    <p><span className="font-medium">Dirección:</span> {envio.DireccionEntrega}</p>
                    <p><span className="font-medium">Ciudad:</span> {envio.Ciudad || '-'}</p>
                    <p><span className="font-medium">Operador:</span> {envio.OperadorLogistico || '-'}</p>
                    <p><span className="font-medium">Guía:</span> {envio.NumeroGuia || '-'}</p>
                  </div>
                  <button
                    onClick={() => handleEditEnvio(envio)}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                    title="Editar envío"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </button>
                </div>
              ))
            )}
          </div>
          </>
        )}
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
        </>
      ) : (
        /* Ventas Sin Envío Tab */
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Ventas Sin Envío</h3>
                <p className="text-gray-600 text-sm">Crea envíos para las ventas registradas que aún no tienen envío</p>
              </div>
              <div className="text-sm text-gray-500">
                {ventasSinEnvio.length} venta{ventasSinEnvio.length !== 1 ? 's' : ''} sin envío
              </div>
            </div>

            {loadingVentas ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Cargando ventas...</span>
              </div>
            ) : ventasSinEnvio.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay ventas pendientes</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Todas las ventas registradas ya tienen envío creado.
                </p>
              </div>
            ) : (
              <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Venta
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Estado Venta
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Dirección Cliente
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {ventasSinEnvio.map((venta) => (
                      <tr key={venta.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm font-semibold text-gray-900">
                            #{venta.id}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {venta.cliente.nombre}
                            </div>
                            <div className="text-xs text-gray-500">
                              {venta.cliente.tipoIdentificacion} {venta.cliente.numeroDocumento}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(venta.fecha).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900">
                            ${venta.total.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            venta.tipoVenta === 'contado' 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {venta.tipoVenta === 'contado' ? 'Contado' : 'Crédito'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium text-gray-600">
                            {formatEstadoVenta(venta.estado)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600">
                            {venta.cliente.direccion || 'Sin dirección'}
                            {venta.cliente.ciudad && (
                              <div className="text-xs text-gray-500">
                                {venta.cliente.ciudad}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleCreateEnvio(venta)}
                            className="inline-flex items-center space-x-1 px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Crear Envío</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden divide-y divide-gray-100">
                {ventasSinEnvio.map((venta) => (
                  <div key={venta.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-gray-900">#{venta.id}</p>
                        <p className="text-sm font-medium text-gray-900">{venta.cliente.nombre}</p>
                        <p className="text-xs text-gray-500">{venta.cliente.tipoIdentificacion} {venta.cliente.numeroDocumento}</p>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        venta.tipoVenta === 'contado'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {venta.tipoVenta === 'contado' ? 'Contado' : 'Crédito'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">Fecha: {new Date(venta.fecha).toLocaleDateString()}</p>
                    <p className="text-sm text-gray-600">Total: ${venta.total.toLocaleString()}</p>
                    <p className="text-sm text-gray-600">Dirección: {venta.cliente.direccion || 'Sin dirección'}</p>
                    <button
                      onClick={() => handleCreateEnvio(venta)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Crear Envío</span>
                    </button>
                  </div>
                ))}
              </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create Envio Modal */}
      <CreateEnvioModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onEnvioCreated={handleEnvioCreated}
        venta={selectedVenta}
      />

      {/* Edit Envio Modal */}
      <EditEnvioModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onEnvioUpdated={handleEnvioUpdated}
        envio={selectedEnvio}
      />
    </div>
  );
}
