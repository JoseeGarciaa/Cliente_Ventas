import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Loader2,
  ArrowUpCircle,
} from 'lucide-react';
import { salesController } from '../controllers/salesController';
import type { Credito, CreditosStats, EstadoCredito, CuotaCredito } from '../models/types';

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const INITIAL_STATS: CreditosStats = {
  totalCreditos: 0,
  montoOtorgado: 0,
  montoCobrado: 0,
  montoPendiente: 0,
  creditosVencidos: 0,
};

type EstadoFiltro = 'pendientes' | 'todos' | EstadoCredito;

type Feedback = {
  type: 'success' | 'error';
  message: string;
};

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

function computeStats(creditos: Credito[]): CreditosStats {
  const hoy = new Date();
  return creditos.reduce(
    (acc, credito) => {
      acc.totalCreditos += 1;
      acc.montoOtorgado += credito.montoOriginal;
      acc.montoCobrado += credito.montoPagado;
      acc.montoPendiente += credito.montoPendiente;
      const vencido = credito.cuotas.some((cuota) => {
        if (!cuota.fechaVencimiento) return false;
        const fecha = new Date(cuota.fechaVencimiento);
        const saldo = Math.max(cuota.valor - cuota.valorPagado, 0);
        return saldo > 0.01 && fecha.getTime() < hoy.getTime();
      });
      if (vencido) acc.creditosVencidos += 1;
      return acc;
    },
    { ...INITIAL_STATS }
  );
}

function cuotaSaldo(cuota: CuotaCredito): number {
  return Math.max(Number((cuota.valor - cuota.valorPagado).toFixed(2)), 0);
}

const estadoColors: Record<EstadoCredito | 'mora', string> = {
  activo: 'bg-blue-100 text-blue-700',
  pagado: 'bg-green-100 text-green-700',
  cancelado: 'bg-gray-100 text-gray-700',
  mora: 'bg-red-100 text-red-700',
};

function getStatusBadge(estado: EstadoCredito): string {
  const key = estado === 'mora' ? 'mora' : estado;
  return estadoColors[key] ?? estadoColors.activo;
}

function getStatusIcon(estado: EstadoCredito) {
  switch (estado) {
    case 'pagado':
      return <CheckCircle className="w-4 h-4" />;
    case 'mora':
      return <AlertCircle className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
}

export default function Creditos() {
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [stats, setStats] = useState<CreditosStats>(INITIAL_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageFeedback, setPageFeedback] = useState<Feedback | null>(null);
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [selectedCredito, setSelectedCredito] = useState<Credito | null>(null);
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoFecha, setPagoFecha] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [processingPago, setProcessingPago] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<Feedback | null>(null);

  const fetchCreditos = async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const data = await salesController.getCreditos();
      setCreditos(data.creditos);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los créditos');
    } finally {
      if (showLoader) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchCreditos(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCreditos = useMemo(() => {
    const term = search.trim().toLowerCase();
    return creditos.filter((credito) => {
      const matchesSearch = term
        ? credito.clienteNombre.toLowerCase().includes(term) || String(credito.id).includes(term)
        : true;
      const matchesEstado = (() => {
        if (estadoFiltro === 'pendientes') {
          return credito.estado === 'activo' || credito.estado === 'mora';
        }
        if (estadoFiltro === 'todos') {
          return true;
        }
        return credito.estado === estadoFiltro;
      })();
      return matchesSearch && matchesEstado;
    });
  }, [creditos, search, estadoFiltro]);

  const totalPendientes = useMemo(
    () => filteredCreditos.reduce((acc, credito) => acc + credito.montoPendiente, 0),
    [filteredCreditos]
  );

  const totalCobrado = useMemo(
    () => filteredCreditos.reduce((acc, credito) => acc + credito.montoPagado, 0),
    [filteredCreditos]
  );

  const toggleExpand = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openPagoModal = (credito: Credito) => {
    setSelectedCredito(credito);
    const proxima = credito.proximaCuota;
    const saldo = proxima ? cuotaSaldo(proxima) : credito.montoPendiente;
    setPagoMonto(saldo > 0 ? String(saldo) : '');
    setPagoFecha(new Date().toISOString().slice(0, 10));
    setModalFeedback(null);
    setShowPagoModal(true);
  };

  const closePagoModal = () => {
    if (processingPago) return;
    setShowPagoModal(false);
    setSelectedCredito(null);
    setPagoMonto('');
    setModalFeedback(null);
  };

  const handlePagoSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCredito) return;

    const montoSanitizado = Number(pagoMonto.replace(/[^0-9.,-]/g, '').replace(',', '.'));
    if (!Number.isFinite(montoSanitizado) || montoSanitizado <= 0) {
      setModalFeedback({ type: 'error', message: 'Ingresa un monto válido para registrar el pago.' });
      return;
    }

    setProcessingPago(true);
    setModalFeedback(null);
    try {
      const creditoActualizado = await salesController.payCredito(selectedCredito.id, {
        monto: Number(montoSanitizado.toFixed(2)),
        fechaPago: pagoFecha || undefined,
      });

      setCreditos((prev) => {
        const updated = prev.map((item) => (item.id === creditoActualizado.id ? creditoActualizado : item));
        setStats(computeStats(updated));
        return updated;
      });

      if (estadoFiltro === 'pendientes' && creditoActualizado.estado === 'pagado') {
        setEstadoFiltro('pagado');
      }

      setPageFeedback({ type: 'success', message: 'El pago se registró correctamente.' });
      closePagoModal();
    } catch (err) {
      setModalFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'No se pudo registrar el pago.',
      });
    } finally {
      setProcessingPago(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Control de Créditos</h3>
          <p className="text-gray-600 text-sm mt-1">Gestiona los créditos otorgados a clientes</p>
        </div>
        <button
          type="button"
          onClick={() => fetchCreditos(false)}
          disabled={refreshing}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpCircle className="w-4 h-4" />}
          <span>{refreshing ? 'Actualizando...' : 'Actualizar'}</span>
        </button>
      </div>

      {pageFeedback && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            pageFeedback.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {pageFeedback.message}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar crédito por cliente o ID..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <select
            value={estadoFiltro}
            onChange={(event) => setEstadoFiltro(event.target.value as EstadoFiltro)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="pendientes">Activos / Pendientes</option>
            <option value="todos">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="mora">En mora</option>
            <option value="pagado">Pagado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-500">
          <p className="text-gray-600 text-sm mb-1">Total Créditos</p>
          <p className="text-3xl font-bold text-gray-900">{stats.totalCreditos}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm mb-1">Monto Otorgado</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.montoOtorgado)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm mb-1">Monto Cobrado</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.montoCobrado)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm mb-1">Monto Pendiente</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.montoPendiente)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm mb-1">Créditos Vencidos</p>
          <p className="text-3xl font-bold text-gray-900">{stats.creditosVencidos}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
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
                  Próxima cuota
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-gray-500">
                    <div className="inline-flex items-center space-x-3 text-orange-500">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Cargando créditos...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCreditos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <DollarSign className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">No hay créditos para los filtros actuales</p>
                      <p className="text-gray-400 text-sm">Los créditos aparecerán aquí cuando se registren</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCreditos.map((credito) => {
                  const porcentajePagado = credito.montoOriginal
                    ? Math.min(100, Math.round((credito.montoPagado / credito.montoOriginal) * 100))
                    : 0;
                  const proximaCuota = credito.proximaCuota;
                  const saldoProxima = proximaCuota ? cuotaSaldo(proximaCuota) : 0;
                  const expandido = expanded[credito.id];

                  return (
                    <Fragment key={credito.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => toggleExpand(credito.id)}
                            className="inline-flex items-center space-x-2 text-sm font-semibold text-gray-900"
                          >
                            {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            <span>#CRD-{String(credito.id).padStart(5, '0')}</span>
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-gray-900">{credito.clienteNombre}</span>
                          <p className="text-xs text-gray-500">Venta #{credito.ventaId}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-gray-900">{formatCurrency(credito.montoOriginal)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <span className="text-sm font-semibold text-green-600">
                              {formatCurrency(credito.montoPagado)}
                            </span>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${porcentajePagado}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`text-sm font-semibold ${
                              credito.montoPendiente > 0.01 ? 'text-orange-600' : 'text-gray-500'
                            }`}
                          >
                            {formatCurrency(credito.montoPendiente)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {proximaCuota ? (
                            <div className="text-sm text-gray-700">
                              <p className="font-semibold">{formatCurrency(saldoProxima || proximaCuota.valor)}</p>
                              <p className="text-xs text-gray-500">Vence: {formatDate(proximaCuota.fechaVencimiento)}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">sin cuotas pendientes</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                              credito.estado
                            )}`}
                          >
                            {getStatusIcon(credito.estado)}
                            <span className="capitalize">{credito.estado}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            disabled={processingPago || credito.estado === 'pagado'}
                            onClick={() => openPagoModal(credito)}
                            className="text-sm font-medium text-orange-600 hover:text-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Registrar pago
                          </button>
                        </td>
                      </tr>
                      {expandido && (
                        <tr className="bg-gray-50">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {credito.cuotas.map((cuota) => {
                                const saldo = cuotaSaldo(cuota);
                                return (
                                  <div key={cuota.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-semibold text-gray-500">
                                        Cuota #{cuota.numeroCuota}
                                      </span>
                                      <span
                                        className={`text-xs font-semibold ${
                                          saldo <= 0.01
                                            ? 'text-green-600'
                                            : cuota.estado === 'mora'
                                            ? 'text-red-600'
                                            : 'text-orange-600'
                                        }`}
                                      >
                                        {saldo <= 0.01 ? 'Pagada' : 'Pendiente'}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-500 mb-1">Vence {formatDate(cuota.fechaVencimiento)}</p>
                                    <div className="flex items-baseline justify-between">
                                      <span className="text-lg font-bold text-gray-900">
                                        {formatCurrency(cuota.valor)}
                                      </span>
                                      <span className="text-sm text-gray-500">Pagado {formatCurrency(cuota.valorPagado)}</span>
                                    </div>
                                    {saldo > 0.01 && (
                                      <p className="text-xs text-orange-600 mt-1 font-medium">
                                        Saldo pendiente: {formatCurrency(saldo)}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-100 px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between text-sm text-gray-600">
          <span>
            Créditos mostrados: <strong>{filteredCreditos.length}</strong>
          </span>
          <span>
            Total cobrado en vista: <strong>{formatCurrency(totalCobrado)}</strong>
          </span>
          <span>
            Total pendiente en vista: <strong>{formatCurrency(totalPendientes)}</strong>
          </span>
        </div>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">Créditos en mora</h4>
            <p className="text-gray-600 text-sm">
              Actualmente tienes {stats.creditosVencidos} crédito(s) con cuotas vencidas. Da seguimiento oportuno para evitar
              pérdidas.
            </p>
          </div>
        </div>
      </div>

      {showPagoModal && selectedCredito && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 relative">
            <button
              type="button"
              onClick={closePagoModal}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
            <h4 className="text-lg font-semibold text-gray-900 mb-1">Registrar pago de crédito</h4>
            <p className="text-sm text-gray-500 mb-4">
              Cliente: <strong>{selectedCredito.clienteNombre}</strong> · Crédito #{selectedCredito.id}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500 uppercase">Saldo pendiente</p>
                <p className="text-lg font-bold text-orange-600">{formatCurrency(selectedCredito.montoPendiente)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500 uppercase">Próxima cuota</p>
                <p className="text-lg font-bold text-gray-900">
                  {selectedCredito.proximaCuota
                    ? formatCurrency(
                        Math.max(
                          selectedCredito.proximaCuota.valor - selectedCredito.proximaCuota.valorPagado,
                          0
                        )
                      )
                    : '—'}
                </p>
                <p className="text-xs text-gray-500">
                  {selectedCredito.proximaCuota ? formatDate(selectedCredito.proximaCuota.fechaVencimiento) : 'Sin fecha'}
                </p>
              </div>
            </div>

            {modalFeedback && (
              <div
                className={`mb-4 rounded border px-3 py-2 text-sm ${
                  modalFeedback.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {modalFeedback.message}
              </div>
            )}

            <form className="space-y-4" onSubmit={handlePagoSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto a pagar</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pagoMonto}
                  onChange={(event) => setPagoMonto(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Ingresa el monto del pago"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de pago</label>
                <input
                  type="date"
                  value={pagoFecha}
                  onChange={(event) => setPagoFecha(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={closePagoModal}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  disabled={processingPago}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processingPago}
                  className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50"
                >
                  {processingPago ? 'Registrando...' : 'Registrar pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
