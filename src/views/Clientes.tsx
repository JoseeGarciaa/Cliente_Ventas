import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  CreditCard as Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  User2,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react';
import { salesController } from '../controllers/salesController';
import type {
  Cliente,
  CreateClientePayload,
  CalificacionCliente,
  ModoChat,
  TipoIdentificacion,
  UpdateClientePayload,
} from '../models/types';

const initialForm: CreateClientePayload = {
  nombres: '',
  apellidos: '',
  tipoIdentificacion: 'CC',
  numeroDocumento: '',
  telefono: '',
  correo: '',
  direccion: '',
  ciudad: '',
  departamento: '',
  barrio: '',
  calificacion: 'Pendiente',
  modoChat: 'modo robot',
};

const TIPO_IDENTIFICACION_OPTIONS: TipoIdentificacion[] = ['CC', 'CE', 'NIT', 'TI', 'PASAPORTE', 'PPT'];
const CALIFICACION_OPTIONS: CalificacionCliente[] = ['Pendiente', 'Positivo', 'Negativo', 'Hurto'];
const MODO_CHAT_OPTIONS: ModoChat[] = ['modo robot', 'modo humano'];

const formatOptionLabel = (value: string) =>
  value
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

type Feedback = {
  type: 'success' | 'error';
  message: string;
};

function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        {description ? <p className="text-xs text-gray-500">{description}</p> : null}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formValues, setFormValues] = useState<CreateClientePayload>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [pageFeedback, setPageFeedback] = useState<Feedback | null>(null);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null);

  useEffect(() => {
    if (!pageFeedback) return undefined;
    const timeoutId = window.setTimeout(() => setPageFeedback(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [pageFeedback]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await salesController.getClientes();
        if (!active) return;
        setClientes(data);
        setError(null);
      } catch (e) {
        console.error(e);
        if (!active) return;
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los clientes');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const reload = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await salesController.getClientes();
      setClientes(data);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los clientes');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCliente(null);
    setFormValues(initialForm);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormValues({
      nombres: cliente.nombres,
      apellidos: cliente.apellidos,
      tipoIdentificacion: cliente.tipoIdentificacion,
      numeroDocumento: cliente.numeroDocumento,
      telefono: cliente.telefono ?? '',
      correo: cliente.correo ?? '',
      direccion: cliente.direccion ?? '',
      ciudad: cliente.ciudad ?? '',
      departamento: cliente.departamento ?? '',
      barrio: cliente.barrio ?? '',
      calificacion: cliente.calificacion ?? 'Pendiente',
      modoChat: cliente.modoChat ?? 'modo robot',
    });
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    if (formLoading) return;
    setShowModal(false);
    setEditingCliente(null);
    setFormError(null);
  };

  const handleSubmitCliente = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (
      !formValues.nombres?.trim() ||
      !formValues.apellidos?.trim() ||
      !formValues.tipoIdentificacion?.trim() ||
      !formValues.numeroDocumento?.trim()
    ) {
      setFormError('Completa todos los campos obligatorios');
      return;
    }

    setFormLoading(true);
    try {
      const optionalToUndefined = (value?: string) => {
        const trimmedValue = value?.trim();
        return trimmedValue && trimmedValue.length > 0 ? trimmedValue : undefined;
      };
      const optionalToNull = (value?: string) => {
        const trimmedValue = value?.trim();
        return trimmedValue && trimmedValue.length > 0 ? trimmedValue : null;
      };

      const basePayload = {
        nombres: formValues.nombres.trim(),
        apellidos: formValues.apellidos.trim(),
        tipoIdentificacion: formValues.tipoIdentificacion,
        numeroDocumento: formValues.numeroDocumento.trim(),
        calificacion: formValues.calificacion ?? 'Pendiente',
        modoChat: formValues.modoChat ?? 'modo robot',
      };

      if (editingCliente) {
        const updatePayload: UpdateClientePayload = {
          ...basePayload,
          telefono: optionalToNull(formValues.telefono),
          correo: optionalToNull(formValues.correo),
          direccion: optionalToNull(formValues.direccion),
          ciudad: optionalToNull(formValues.ciudad),
          departamento: optionalToNull(formValues.departamento),
          calificacion: formValues.calificacion ?? 'Pendiente',
          barrio: optionalToNull(formValues.barrio),
          modoChat: formValues.modoChat ?? 'modo robot',
        };

        const updated = await salesController.updateCliente(editingCliente.id, updatePayload);
        setClientes((prev) => prev.map((cliente) => (cliente.id === updated.id ? updated : cliente)));
        setPageFeedback({ type: 'success', message: 'Cliente actualizado correctamente.' });
      } else {
        const createPayload: CreateClientePayload = {
          ...basePayload,
          telefono: optionalToUndefined(formValues.telefono),
          correo: optionalToUndefined(formValues.correo),
          direccion: optionalToUndefined(formValues.direccion),
          ciudad: optionalToUndefined(formValues.ciudad),
          departamento: optionalToUndefined(formValues.departamento),
          barrio: optionalToUndefined(formValues.barrio),
        };

        const created = await salesController.createCliente(createPayload);
        setClientes((prev) => [created, ...prev]);
        setPageFeedback({ type: 'success', message: 'Cliente creado correctamente.' });
      }

      closeModal();
    } catch (e) {
      console.error(e);
      setFormError(e instanceof Error ? e.message : 'No se pudo guardar el cliente');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteCliente = async (cliente: Cliente) => {
    const confirmed = window.confirm(`¿Eliminar al cliente ${cliente.nombres} ${cliente.apellidos}?`);
    if (!confirmed) return;

    setDeleteLoadingId(cliente.id);
    try {
      await salesController.deleteCliente(cliente.id);
      setClientes((prev) => prev.filter((item) => item.id !== cliente.id));
      setPageFeedback({ type: 'success', message: 'Cliente eliminado correctamente.' });
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'No se pudo eliminar el cliente';
      setPageFeedback({ type: 'error', message });
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const filteredClientes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clientes;
    return clientes.filter((cliente) => {
      const values = [
        cliente.nombres,
        cliente.apellidos,
        cliente.correo ?? '',
        cliente.telefono ?? '',
        cliente.numeroDocumento,
        cliente.ciudad ?? '',
        cliente.departamento ?? '',
      ];
      return values.some((value) => String(value).toLowerCase().includes(term));
    });
  }, [clientes, search]);

  const stats = useMemo(() => {
    const total = clientes.length;
    const activos = clientes.length; // Placeholder hasta tener campo de estado
    const conCredito = clientes.filter((c) => c.calificacion === 'Positivo').length;
    const nuevos30d = clientes.filter((cliente) => {
      if (!cliente.fechaRegistro) return false;
      const fecha = new Date(cliente.fechaRegistro);
      if (Number.isNaN(fecha.getTime())) return false;
      const diff = Date.now() - fecha.getTime();
      const days = diff / (1000 * 60 * 60 * 24);
      return days <= 30;
    }).length;

    return { total, activos, conCredito, nuevos30d };
  }, [clientes]);

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Gestión de Clientes</h3>
            <p className="text-gray-600 text-sm mt-1">Administra la información de tus clientes</p>
          </div>
          <button
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            onClick={openCreateModal}
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar cliente por nombre, email o teléfono..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {pageFeedback && (
          <div
            className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium shadow-sm ${
              pageFeedback.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            <span>{pageFeedback.message}</span>
            <button
              type="button"
              className="ml-4 text-xs uppercase tracking-wide"
              onClick={() => setPageFeedback(null)}
            >
              Cerrar
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
            <p className="text-gray-600 text-sm mb-1">Total Clientes</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
            <p className="text-gray-600 text-sm mb-1">Activos</p>
            <p className="text-3xl font-bold text-gray-900">{stats.activos}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
            <p className="text-gray-600 text-sm mb-1">Con Crédito</p>
            <p className="text-3xl font-bold text-gray-900">{stats.conCredito}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
            <p className="text-gray-600 text-sm mb-1">Nuevos (30d)</p>
            <p className="text-3xl font-bold text-gray-900">{stats.nuevos30d}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ubicación
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Fecha Registro
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3 text-gray-500">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                          <User2 className="w-8 h-8 animate-pulse" />
                        </div>
                        <p className="font-medium">Cargando clientes...</p>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                          <AlertCircle className="w-8 h-8 text-red-600" />
                        </div>
                        <p className="text-red-600 font-medium">{error}</p>
                        <button
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          onClick={reload}
                        >
                          Reintentar
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredClientes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                          <Mail className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">No hay clientes registrados</p>
                        <p className="text-gray-400 text-sm">Agrega tu primer cliente para comenzar</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredClientes.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-700 font-semibold text-sm">
                              {cliente.nombres ? cliente.nombres.charAt(0) : '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {cliente.nombres} {cliente.apellidos}
                            </p>
                            <p className="text-xs text-gray-500">
                              {cliente.tipoIdentificacion} · {cliente.numeroDocumento}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4" />
                            <span>{cliente.correo ?? 'Sin correo'}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Phone className="w-4 h-4" />
                            <span>{cliente.telefono ?? 'Sin teléfono'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span>
                            {[cliente.ciudad, cliente.departamento].filter(Boolean).join(', ') || 'Sin ubicación'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {cliente.fechaRegistro ? new Date(cliente.fechaRegistro).toLocaleDateString() : 'Sin registro'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            onClick={() => openEditModal(cliente)}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => handleDeleteCliente(cliente)}
                            disabled={deleteLoadingId === cliente.id}
                          >
                            {deleteLoadingId === cliente.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
                </h3>
                <p className="text-sm text-gray-500">
                  {editingCliente
                    ? 'Actualiza la información del cliente seleccionado'
                    : 'Registra un nuevo cliente en tu base de datos'}
                </p>
              </div>
              <button className="p-2 rounded-full hover:bg-gray-100 text-gray-500" onClick={closeModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCliente} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    {formError}
                  </div>
                )}

                <FormSection title="Identidad del cliente" description="Datos básicos obligatorios">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Nombres *</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500"
                      value={formValues.nombres}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, nombres: event.target.value }))}
                      autoComplete="given-name"
                      placeholder="Ej. Juan Carlos"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Apellidos *</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500"
                      value={formValues.apellidos}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, apellidos: event.target.value }))}
                      autoComplete="family-name"
                      placeholder="Ej. Pérez López"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Tipo Identificación *
                    </label>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500 capitalize"
                      value={formValues.tipoIdentificacion}
                      onChange={(event) =>
                        setFormValues((prev) => ({
                          ...prev,
                          tipoIdentificacion: event.target.value as TipoIdentificacion,
                        }))
                      }
                      required
                    >
                      <option value="" disabled>
                        Selecciona un tipo
                      </option>
                      {TIPO_IDENTIFICACION_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Número Documento *
                    </label>
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500"
                      value={formValues.numeroDocumento}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, numeroDocumento: event.target.value }))}
                      inputMode="numeric"
                      maxLength={20}
                      placeholder="Ingresa el número sin guiones"
                      required
                    />
                  </div>
                </FormSection>

                <FormSection title="Información de contacto" description="Campos opcionales para mantener comunicación">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Teléfono</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500"
                      value={formValues.telefono ?? ''}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, telefono: event.target.value }))}
                      inputMode="tel"
                      maxLength={20}
                      placeholder="Ej. 3004567890"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Correo</label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500"
                      value={formValues.correo ?? ''}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, correo: event.target.value }))}
                      placeholder="correo@ejemplo.com"
                      autoComplete="email"
                      spellCheck={false}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Dirección</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500"
                      value={formValues.direccion ?? ''}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, direccion: event.target.value }))}
                      autoComplete="street-address"
                      placeholder="Calle 123 #45-67"
                    />
                  </div>
                </FormSection>

                <FormSection title="Ubicación" description="Complementa la ubicación del cliente">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Ciudad</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500"
                      value={formValues.ciudad ?? ''}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, ciudad: event.target.value }))}
                      placeholder="Ciudad"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Departamento</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500"
                      value={formValues.departamento ?? ''}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, departamento: event.target.value }))}
                      placeholder="Departamento"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Barrio</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500"
                      value={formValues.barrio ?? ''}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, barrio: event.target.value }))}
                      placeholder="Barrio"
                    />
                  </div>
                </FormSection>

                <FormSection title="Clasificación" description="Configura el estado inicial del cliente">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Calificación</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500 capitalize"
                      value={formValues.calificacion ?? 'Pendiente'}
                      onChange={(event) =>
                        setFormValues((prev) => ({
                          ...prev,
                          calificacion: event.target.value as CalificacionCliente,
                        }))
                      }
                    >
                      {CALIFICACION_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {formatOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Modo de chat</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-green-500 focus:ring-green-500 capitalize"
                      value={formValues.modoChat ?? 'modo robot'}
                      onChange={(event) =>
                        setFormValues((prev) => ({
                          ...prev,
                          modoChat: event.target.value as ModoChat,
                        }))
                      }
                    >
                      {MODO_CHAT_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {formatOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                </FormSection>
              </div>

              <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t bg-white">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                  onClick={closeModal}
                  disabled={formLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-60"
                  disabled={formLoading}
                >
                  {formLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    'Guardar Cliente'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
