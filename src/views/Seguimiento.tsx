import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Filter,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
  Save,
  Search,
} from 'lucide-react';
import { salesController } from '../controllers/salesController';
import type { Credito, CuotaCredito } from '../models/types';

type ResultadoGestion =
  | 'sin_respuesta'
  | 'promesa_pago'
  | 'acuerdo_reestructuracion'
  | 'pago_realizado'
  | 'cliente_no_reconoce_deuda'
  | 'escalar_visita';

type CanalGestion = 'llamada' | 'whatsapp' | 'sms' | 'visita' | 'correo';
type Prioridad = 'alta' | 'media' | 'baja';

type SeguimientoEntry = {
  id: string;
  fechaRegistro: string;
  canal: CanalGestion;
  resultado: ResultadoGestion;
  comentario: string;
  fechaProximaGestion: string | null;
  notaClienteAnterior: string;
};

type FormState = {
  canal: CanalGestion;
  resultado: ResultadoGestion;
  comentario: string;
  fechaProximaGestion: string;
  notaClienteAnterior: string;
};

type CreditoVencidoView = {
  credito: Credito;
  cuotasVencidas: Array<CuotaCredito & { saldo: number; diasMora: number }>;
  diasMoraMax: number;
  saldoVencido: number;
  prioridad: Prioridad;
};

const STORAGE_KEY = 'seguimiento_cobro_entries_v1';

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const RESULTADO_LABEL: Record<ResultadoGestion, string> = {
  sin_respuesta: 'Sin respuesta',
  promesa_pago: 'Promesa de pago',
  acuerdo_reestructuracion: 'Acuerdo / reestructuración',
  pago_realizado: 'Pago realizado',
  cliente_no_reconoce_deuda: 'Cliente no reconoce deuda',
  escalar_visita: 'Escalar a visita',
};

const CANAL_LABEL: Record<CanalGestion, string> = {
  llamada: 'Llamada',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  visita: 'Visita',
  correo: 'Correo',
};

const PRIORIDAD_STYLE: Record<Prioridad, string> = {
  alta: 'bg-red-100 text-red-700 border-red-200',
  media: 'bg-amber-100 text-amber-700 border-amber-200',
  baja: 'bg-blue-100 text-blue-700 border-blue-200',
};

function formatDate(value: string | null): string {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return dateFormatter.format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha inválida';
  return dateTimeFormatter.format(date);
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function getStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDaysOverdue(fechaVencimiento: string): number {
  const fecha = new Date(fechaVencimiento);
  if (Number.isNaN(fecha.getTime())) return 0;
  const diff = getStartOfDay(new Date()).getTime() - getStartOfDay(fecha).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function toCuotaSaldo(cuota: CuotaCredito): number {
  return Math.max(Number((cuota.valor - cuota.valorPagado).toFixed(2)), 0);
}

function getPrioridad(diasMoraMax: number): Prioridad {
  if (diasMoraMax >= 45) return 'alta';
  if (diasMoraMax >= 20) return 'media';
  return 'baja';
}

function getDefaultFormState(): FormState {
  return {
    canal: 'llamada',
    resultado: 'sin_respuesta',
    comentario: '',
    fechaProximaGestion: '',
    notaClienteAnterior: '',
  };
}

function parseEntries(): Record<string, SeguimientoEntry[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, SeguimientoEntry[]>;
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function saveEntries(entries: Record<string, SeguimientoEntry[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export default function Seguimiento() {
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [entriesByCredito, setEntriesByCredito] = useState<Record<string, SeguimientoEntry[]>>({});
  const [formByCredito, setFormByCredito] = useState<Record<number, FormState>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const [search, setSearch] = useState('');
  const [prioridadFiltro, setPrioridadFiltro] = useState<'todas' | Prioridad>('todas');
  const [soloConProximaHoy, setSoloConProximaHoy] = useState(false);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la cartera vencida');
    } finally {
      if (showLoader) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    setEntriesByCredito(parseEntries());
    fetchCreditos(true);
  }, []);

  const creditosVencidos = useMemo<CreditoVencidoView[]>(() => {
    const today = getStartOfDay(new Date()).getTime();

    return creditos
      .map((credito) => {
        const cuotasVencidas = credito.cuotas
          .map((cuota) => {
            if (!cuota.fechaVencimiento) return null;
            const fechaV = new Date(cuota.fechaVencimiento);
            if (Number.isNaN(fechaV.getTime()) || fechaV.getTime() >= today) return null;
            const saldo = toCuotaSaldo(cuota);
            if (saldo <= 0.01) return null;

            return {
              ...cuota,
              saldo,
              diasMora: getDaysOverdue(cuota.fechaVencimiento),
            };
          })
          .filter((cuota): cuota is CuotaCredito & { saldo: number; diasMora: number } => Boolean(cuota))
          .sort((a, b) => b.diasMora - a.diasMora);

        if (!cuotasVencidas.length) return null;

        const diasMoraMax = cuotasVencidas[0]?.diasMora ?? 0;
        const saldoVencido = cuotasVencidas.reduce((acc, cuota) => acc + cuota.saldo, 0);

        return {
          credito,
          cuotasVencidas,
          diasMoraMax,
          saldoVencido,
          prioridad: getPrioridad(diasMoraMax),
        };
      })
      .filter((item): item is CreditoVencidoView => Boolean(item))
      .sort((a, b) => {
        const prioridadPeso = { alta: 3, media: 2, baja: 1 };
        if (prioridadPeso[b.prioridad] !== prioridadPeso[a.prioridad]) {
          return prioridadPeso[b.prioridad] - prioridadPeso[a.prioridad];
        }
        if (b.diasMoraMax !== a.diasMoraMax) {
          return b.diasMoraMax - a.diasMoraMax;
        }
        return b.saldoVencido - a.saldoVencido;
      });
  }, [creditos]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    const todayIso = new Date().toISOString().slice(0, 10);

    return creditosVencidos.filter((item) => {
      const matchesSearch = term
        ? item.credito.clienteNombre.toLowerCase().includes(term) || String(item.credito.id).includes(term)
        : true;
      const matchesPrioridad = prioridadFiltro === 'todas' ? true : item.prioridad === prioridadFiltro;
      const entries = entriesByCredito[String(item.credito.id)] || [];
      const latest = entries[0];
      const matchesProxima = soloConProximaHoy
        ? Boolean(latest?.fechaProximaGestion && latest.fechaProximaGestion === todayIso)
        : true;
      return matchesSearch && matchesPrioridad && matchesProxima;
    });
  }, [creditosVencidos, search, prioridadFiltro, soloConProximaHoy, entriesByCredito]);

  const totalSaldoVencido = useMemo(
    () => filteredItems.reduce((acc, item) => acc + item.saldoVencido, 0),
    [filteredItems]
  );

  const compromisosHoy = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    return filteredItems.reduce((acc, item) => {
      const latest = (entriesByCredito[String(item.credito.id)] || [])[0];
      if (latest?.fechaProximaGestion === todayIso) return acc + 1;
      return acc;
    }, 0);
  }, [filteredItems, entriesByCredito]);

  const sinGestionRegistrada = useMemo(
    () => filteredItems.filter((item) => (entriesByCredito[String(item.credito.id)] || []).length === 0).length,
    [filteredItems, entriesByCredito]
  );

  const ensureForm = (creditoId: number) => {
    setFormByCredito((prev) => {
      if (prev[creditoId]) return prev;
      return { ...prev, [creditoId]: getDefaultFormState() };
    });
  };

  const handleToggle = (creditoId: number) => {
    ensureForm(creditoId);
    setExpanded((prev) => ({ ...prev, [creditoId]: !prev[creditoId] }));
  };

  const updateForm = (creditoId: number, patch: Partial<FormState>) => {
    setFormByCredito((prev) => ({
      ...prev,
      [creditoId]: { ...(prev[creditoId] ?? getDefaultFormState()), ...patch },
    }));
  };

  const handleSaveGestion = (creditoId: number) => {
    const form = formByCredito[creditoId] ?? getDefaultFormState();
    const comentario = form.comentario.trim();

    if (comentario.length < 8) {
      setFeedback('La bitácora requiere un comentario más descriptivo (mínimo 8 caracteres).');
      return;
    }

    const entry: SeguimientoEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fechaRegistro: new Date().toISOString(),
      canal: form.canal,
      resultado: form.resultado,
      comentario,
      fechaProximaGestion: form.fechaProximaGestion || null,
      notaClienteAnterior: form.notaClienteAnterior.trim(),
    };

    setEntriesByCredito((prev) => {
      const key = String(creditoId);
      const updated = {
        ...prev,
        [key]: [entry, ...(prev[key] || [])],
      };
      saveEntries(updated);
      return updated;
    });

    setFormByCredito((prev) => ({
      ...prev,
      [creditoId]: {
        ...getDefaultFormState(),
        canal: form.canal,
      },
    }));

    setFeedback('Gestión guardada en la minuta del crédito.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Gestión de Cobro - Créditos Vencidos</h3>
          <p className="text-sm text-gray-600 mt-1">
            Registra resultado de contacto, respuesta del cliente y programa la próxima gestión.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchCreditos(false)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span>{refreshing ? 'Actualizando' : 'Actualizar cartera'}</span>
        </button>
      </div>

      {feedback && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{feedback}</div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-red-500">
          <p className="text-xs uppercase tracking-wide text-gray-500">Clientes en mora</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{filteredItems.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-orange-500">
          <p className="text-xs uppercase tracking-wide text-gray-500">Saldo vencido</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalSaldoVencido)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-emerald-500">
          <p className="text-xs uppercase tracking-wide text-gray-500">Compromisos para hoy</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{compromisosHoy}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-slate-500">
          <p className="text-xs uppercase tracking-wide text-gray-500">Sin gestión registrada</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{sinGestionRegistrada}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por cliente o ID de crédito"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="lg:col-span-3">
            <label className="sr-only" htmlFor="filtro-prioridad">Prioridad</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                id="filtro-prioridad"
                value={prioridadFiltro}
                onChange={(event) => setPrioridadFiltro(event.target.value as 'todas' | Prioridad)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todas">Todas las prioridades</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>

          <div className="lg:col-span-3 flex items-center">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={soloConProximaHoy}
                onChange={(event) => setSoloConProximaHoy(event.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Mostrar solo próximos contactos de hoy
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm px-6 py-16 text-center text-gray-500">
            <div className="inline-flex items-center gap-2 text-blue-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              Cargando cartera vencida...
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm px-6 py-16 text-center">
            <AlertTriangle className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No hay créditos vencidos para los filtros actuales.</p>
            <p className="text-gray-500 text-sm mt-1">Ajusta los filtros para continuar la gestión.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const { credito, cuotasVencidas, diasMoraMax, saldoVencido, prioridad } = item;
            const entries = entriesByCredito[String(credito.id)] || [];
            const latest = entries[0];
            const isExpanded = expanded[credito.id] || false;
            const form = formByCredito[credito.id] ?? getDefaultFormState();

            return (
              <div key={credito.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleToggle(credito.id)}
                  className="w-full px-4 py-4 md:px-6 flex flex-col md:flex-row md:items-center gap-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2 min-w-[220px] text-left">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <div>
                      <p className="font-semibold text-gray-900">{credito.clienteNombre}</p>
                      <p className="text-xs text-gray-500">Crédito #CRD-{String(credito.id).padStart(5, '0')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full text-left">
                    <div>
                      <p className="text-xs text-gray-500">Días en mora</p>
                      <p className="text-sm font-semibold text-gray-900">{diasMoraMax} días</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Saldo vencido</p>
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(saldoVencido)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Cuotas vencidas</p>
                      <p className="text-sm font-semibold text-gray-900">{cuotasVencidas.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Prioridad</p>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-wide ${PRIORIDAD_STYLE[prioridad]}`}
                      >
                        {prioridad}
                      </span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 md:px-6 md:py-5 space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="rounded-lg border border-gray-200 p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Detalle de vencimiento</h4>
                        <div className="space-y-2">
                          {cuotasVencidas.map((cuota) => (
                            <div key={cuota.id} className="flex items-center justify-between text-sm">
                              <div>
                                <p className="font-medium text-gray-800">Cuota #{cuota.numeroCuota}</p>
                                <p className="text-xs text-gray-500">Venció {formatDate(cuota.fechaVencimiento)}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-gray-900">{formatCurrency(cuota.saldo)}</p>
                                <p className="text-xs text-red-600">{cuota.diasMora} días</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-gray-200 p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Última gestión registrada</h4>
                        {latest ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-gray-700">
                              <Clock3 className="w-4 h-4" />
                              {formatDateTime(latest.fechaRegistro)}
                            </div>
                            <div className="flex items-center gap-2 text-gray-700">
                              {latest.canal === 'llamada' ? (
                                <Phone className="w-4 h-4" />
                              ) : (
                                <MessageSquare className="w-4 h-4" />
                              )}
                              {CANAL_LABEL[latest.canal]} - {RESULTADO_LABEL[latest.resultado]}
                            </div>
                            <p className="text-gray-700 bg-gray-50 border border-gray-100 rounded-md p-2">{latest.comentario}</p>
                            {latest.notaClienteAnterior && (
                              <p className="text-xs text-gray-600">
                                <span className="font-medium">Cliente reportó:</span> {latest.notaClienteAnterior}
                              </p>
                            )}
                            {latest.fechaProximaGestion && (
                              <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 text-blue-700 px-2.5 py-1.5 text-xs font-medium">
                                <Calendar className="w-4 h-4" /> Próximo contacto: {formatDate(latest.fechaProximaGestion)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Aun no hay minuta para este crédito.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">Registrar nueva gestión</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor={`canal-${credito.id}`}>
                            Canal
                          </label>
                          <select
                            id={`canal-${credito.id}`}
                            value={form.canal}
                            onChange={(event) => updateForm(credito.id, { canal: event.target.value as CanalGestion })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="llamada">Llamada</option>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="sms">SMS</option>
                            <option value="visita">Visita</option>
                            <option value="correo">Correo</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor={`resultado-${credito.id}`}>
                            Resultado
                          </label>
                          <select
                            id={`resultado-${credito.id}`}
                            value={form.resultado}
                            onChange={(event) =>
                              updateForm(credito.id, { resultado: event.target.value as ResultadoGestion })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="sin_respuesta">Sin respuesta</option>
                            <option value="promesa_pago">Promesa de pago</option>
                            <option value="acuerdo_reestructuracion">Acuerdo / reestructuración</option>
                            <option value="pago_realizado">Pago realizado</option>
                            <option value="cliente_no_reconoce_deuda">No reconoce deuda</option>
                            <option value="escalar_visita">Escalar a visita</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor={`proxima-${credito.id}`}>
                            Próxima gestión
                          </label>
                          <input
                            id={`proxima-${credito.id}`}
                            type="date"
                            value={form.fechaProximaGestion}
                            onChange={(event) => updateForm(credito.id, { fechaProximaGestion: event.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => handleSaveGestion(credito.id)}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                          >
                            <Save className="w-4 h-4" /> Guardar gestión
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor={`comentario-${credito.id}`}>
                            Comentario de la gestión
                          </label>
                          <textarea
                            id={`comentario-${credito.id}`}
                            rows={3}
                            value={form.comentario}
                            onChange={(event) => updateForm(credito.id, { comentario: event.target.value })}
                            placeholder="Ej: cliente confirma pago parcial el viernes, solicita recordatorio por WhatsApp..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor={`nota-${credito.id}`}>
                            Que dijo el cliente en el contacto anterior
                          </label>
                          <input
                            id={`nota-${credito.id}`}
                            type="text"
                            value={form.notaClienteAnterior}
                            onChange={(event) => updateForm(credito.id, { notaClienteAnterior: event.target.value })}
                            placeholder="Ej: esperaba pago de quincena / reporta dificultad temporal"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>

                    {entries.length > 0 && (
                      <div className="rounded-lg border border-gray-200 p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Historial de minuta</h4>
                        <div className="space-y-2">
                          {entries.slice(0, 6).map((entry) => (
                            <div key={entry.id} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                                <p className="text-sm font-medium text-gray-800">
                                  {CANAL_LABEL[entry.canal]} - {RESULTADO_LABEL[entry.resultado]}
                                </p>
                                <p className="text-xs text-gray-500">{formatDateTime(entry.fechaRegistro)}</p>
                              </div>
                              <p className="text-sm text-gray-700 mt-1">{entry.comentario}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {entry.fechaProximaGestion && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                                    <Calendar className="w-3.5 h-3.5" /> {formatDate(entry.fechaProximaGestion)}
                                  </span>
                                )}
                                {entry.resultado === 'pago_realizado' && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Pago confirmado
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
