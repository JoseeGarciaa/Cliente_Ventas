import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Eye,
  Calendar,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Trash2,
  ShoppingCart,
  Truck,
  Undo2,
} from 'lucide-react';
import { salesController } from '../controllers/salesController';
import { inventoryController } from '../controllers/inventoryController';
import type {
  CalificacionCliente,
  Cliente,
  Producto,
  Venta,
  VentasMetadata,
  CreateCreditoPayload,
} from '../models/types';

const createItemId = () => {
  const globalCrypto = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (globalCrypto && 'randomUUID' in globalCrypto) {
    return globalCrypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

type VentaItemForm = {
  id: string;
  productoId: string;
  cantidad: string;
  precioUnitario: string;
  imei: string;
};

const initialVentaItem = (): VentaItemForm => ({
  id: createItemId(),
  productoId: '',
  cantidad: '1',
  precioUnitario: '',
  imei: '',
});

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number) => currencyFormatter.format(value || 0);

const formatDateTimeLocal = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

const formatDateInput = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
};

const formatEnumLabel = (value: string) =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const CALIFICACIONES: CalificacionCliente[] = ['Pendiente', 'Positivo', 'Negativo', 'Hurto'];

const resolveUnitPrice = (producto: Producto | undefined, tipoVenta: string): string => {
  if (!producto) return '';
  const tipo = tipoVenta?.toLowerCase();
  if (tipo === 'credito') {
    const precio = producto.precioCredito ?? producto.precioCosto ?? producto.precioVentaContado ?? 0;
    return precio ? String(precio) : '';
  }
  const precio = producto.precioCosto ?? producto.precioVentaContado ?? producto.precioCredito ?? 0;
  return precio ? String(precio) : '';
};

const STATUS_STYLES: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  confirmada: 'bg-blue-100 text-blue-700',
  enviada: 'bg-indigo-100 text-indigo-700',
  entregada: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
  devuelta: 'bg-gray-200 text-gray-700',
  completada: 'bg-green-100 text-green-700',
};

const statusIcon = (estado: string) => {
  switch (estado) {
    case 'entregada':
    case 'confirmada':
    case 'completada':
      return <CheckCircle className="w-4 h-4" />;
    case 'enviada':
      return <Truck className="w-4 h-4" />;
    case 'devuelta':
      return <Undo2 className="w-4 h-4" />;
    case 'cancelada':
      return <XCircle className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
};

export default function Ventas() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [metadata, setMetadata] = useState<VentasMetadata>({
    tiposVenta: ['contado', 'credito'],
    mediosPago: [
      'efectivo',
      'transferencia',
      'tarjeta_credito',
      'tarjeta_debito',
      'consignacion',
      'bancolombia',
      'nequi',
      'daviplata',
      'codigo_qr',
      'contraentrega',
    ],
    estados: ['pendiente', 'confirmada', 'enviada', 'entregada', 'cancelada', 'devuelta'],
    tiposCredito: ['diario', 'semanal', 'quincenal', 'mensual'],
    estadosCredito: ['activo', 'pagado', 'cancelado', 'mora'],
    estadosCuotaCredito: ['pendiente', 'pagada', 'vencida'],
    calificacionesCredito: ['Pendiente', 'Positivo', 'Negativo', 'Hurto'],
  });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<Venta | null>(null);
  const [editEstado, setEditEstado] = useState('');
  const [editMedioPago, setEditMedioPago] = useState('');
  const [editCalificacion, setEditCalificacion] = useState<CalificacionCliente | ''>('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [formClienteId, setFormClienteId] = useState('');
  const [formMedioPago, setFormMedioPago] = useState('');
  const [formTipoVenta, setFormTipoVenta] = useState('');
  const [formFecha, setFormFecha] = useState(formatDateTimeLocal(new Date()));
  const [formDescuento, setFormDescuento] = useState('0');
  const [formItems, setFormItems] = useState<VentaItemForm[]>([initialVentaItem()]);
  const [formTipoCredito, setFormTipoCredito] = useState('');
  const [formNumeroCuotas, setFormNumeroCuotas] = useState('1');
  const [formCuotaInicial, setFormCuotaInicial] = useState('0');
  const [formFechaPrimerPago, setFormFechaPrimerPago] = useState(formatDateInput(new Date()));
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const [ventasData, metadataData, clientesData, productosData] = await Promise.all([
          salesController.getVentas().catch(() => []),
          salesController.getVentasMetadata().catch(() => metadata),
          salesController.getClientes().catch(() => []),
          inventoryController.getProductos().catch(() => []),
        ]);

        if (!active) return;
        setVentas(ventasData);
        setMetadata(metadataData);
        setClientes(clientesData);
        setProductos(productosData);
        if (!formMedioPago && metadataData.mediosPago.length > 0) {
          setFormMedioPago(metadataData.mediosPago[0]);
        }
        if (!formTipoVenta && metadataData.tiposVenta.length > 0) {
          setFormTipoVenta(metadataData.tiposVenta[0]);
        }
        if (!formTipoCredito && metadataData.tiposCredito.length > 0) {
          setFormTipoCredito(metadataData.tiposCredito[0]);
        }
        if (!formFechaPrimerPago) {
          setFormFechaPrimerPago(formatDateInput(new Date()));
        }
        setError(null);
      } catch (e) {
        console.error(e);
        if (!active) return;
        setError(e instanceof Error ? e.message : 'No se pudieron cargar las ventas');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const handleReload = async () => {
    try {
      setLoading(true);
      const ventasData = await salesController.getVentas();
      setVentas(ventasData);
      setError(null);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las ventas');
    } finally {
      setLoading(false);
    }
  };

  const filteredVentas = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ventas.filter((venta) => {
      const matchesSearch = term
        ? [
            venta.clienteNombre,
            String(venta.id),
            venta.medioPago,
            venta.usuarioNombre,
            venta.tipoVenta,
          ]
            .join(' ')
            .toLowerCase()
            .includes(term)
        : true;
      const matchesEstado = estadoFiltro ? venta.estado === estadoFiltro : true;
      return matchesSearch && matchesEstado;
    });
  }, [ventas, search, estadoFiltro]);

  const stats = useMemo(() => {
    const totalVentas = ventas.length;
    const ingresos = ventas.reduce((acc, venta) => acc + Number(venta.total || 0), 0);
    const pendientes = ventas.filter((venta) => venta.estado === 'pendiente').length;
    const promedio = totalVentas > 0 ? ingresos / totalVentas : 0;
    return { totalVentas, ingresos, pendientes, promedio };
  }, [ventas]);

  const subtotalItems = useMemo(() =>
    formItems.map((item) => {
      const cantidad = Number(item.cantidad) || 0;
      const precio = Number(item.precioUnitario) || 0;
      return cantidad * precio;
    }),
  [formItems]);

  const totalForm = useMemo(() => {
    const subtotal = subtotalItems.reduce((acc, value) => acc + value, 0);
    const descuento = Number(formDescuento) || 0;
    return Math.max(subtotal - descuento, 0);
  }, [subtotalItems, formDescuento]);

  const isCredito = useMemo(() => {
    const tipo = formTipoVenta || metadata.tiposVenta[0] || 'contado';
    return tipo.toLowerCase() === 'credito';
  }, [formTipoVenta, metadata.tiposVenta]);

  const numeroCuotasValue = useMemo(() => Number(formNumeroCuotas) || 0, [formNumeroCuotas]);
  const cuotaInicialValue = useMemo(() => Number(formCuotaInicial) || 0, [formCuotaInicial]);

  const saldoCredito = useMemo(() => {
    if (!isCredito) return 0;
    return Math.max(totalForm - cuotaInicialValue, 0);
  }, [isCredito, totalForm, cuotaInicialValue]);

  const valorCuotaEstimado = useMemo(() => {
    if (!isCredito || numeroCuotasValue <= 0) return 0;
    return saldoCredito / numeroCuotasValue;
  }, [isCredito, saldoCredito, numeroCuotasValue]);

  const openCreateModal = () => {
    setFormError(null);
    if (!formMedioPago && metadata.mediosPago.length > 0) {
      setFormMedioPago(metadata.mediosPago[0]);
    }
    if (!formTipoVenta && metadata.tiposVenta.length > 0) {
      setFormTipoVenta(metadata.tiposVenta[0]);
    }
    if (!formClienteId && clientes.length > 0) {
      setFormClienteId(String(clientes[0].id));
    }
    if (metadata.tiposCredito.length > 0 && !formTipoCredito) {
      setFormTipoCredito(metadata.tiposCredito[0]);
    }
    if (!formFechaPrimerPago) {
      setFormFechaPrimerPago(formatDateInput(new Date()));
    }
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
  };

  const handleItemChange = (id: string, field: keyof VentaItemForm, value: string) => {
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated: VentaItemForm = { ...item, [field]: value } as VentaItemForm;
        if (field === 'productoId') {
          const producto = productos.find((p) => String(p.id) === value);
          updated.precioUnitario = resolveUnitPrice(producto, formTipoVenta || metadata.tiposVenta[0] || 'contado');
        }
        return updated;
      })
    );
  };

  useEffect(() => {
    setFormItems((prev) =>
      prev.map((item) => {
        if (!item.productoId) return item;
        const producto = productos.find((p) => String(p.id) === item.productoId);
        return {
          ...item,
          precioUnitario: resolveUnitPrice(producto, formTipoVenta || metadata.tiposVenta[0] || 'contado'),
        };
      })
    );
  }, [formTipoVenta, productos, metadata.tiposVenta]);

  useEffect(() => {
    if (formTipoVenta === 'credito') {
      if (!formTipoCredito && metadata.tiposCredito.length > 0) {
        setFormTipoCredito(metadata.tiposCredito[0]);
      }
      if (!formNumeroCuotas || Number(formNumeroCuotas) <= 0) {
        setFormNumeroCuotas('1');
      }
      if (!formFechaPrimerPago) {
        setFormFechaPrimerPago(formatDateInput(new Date()));
      }
    }
  }, [formTipoVenta, formTipoCredito, metadata.tiposCredito, formNumeroCuotas, formFechaPrimerPago]);

  const handleAddItem = () => {
    setFormItems((prev) => [...prev, initialVentaItem()]);
  };

  const handleRemoveItem = (id: string) => {
    setFormItems((prev) => (prev.length === 1 ? prev : prev.filter((item) => item.id !== id)));
  };

  const resetForm = () => {
    setFormClienteId('');
    setFormMedioPago(metadata.mediosPago[0] ?? 'efectivo');
    setFormTipoVenta(metadata.tiposVenta[0] ?? 'contado');
    setFormFecha(formatDateTimeLocal(new Date()));
    setFormDescuento('0');
    setFormItems([initialVentaItem()]);
    setFormTipoCredito(metadata.tiposCredito[0] ?? '');
    setFormNumeroCuotas('1');
    setFormCuotaInicial('0');
    setFormFechaPrimerPago(formatDateInput(new Date()));
    setFormError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!formClienteId) {
      setFormError('Selecciona un cliente para la venta');
      return;
    }

    if (!formTipoVenta) {
      setFormError('Selecciona el tipo de venta');
      return;
    }

    const detallePayload = formItems
      .map((item) => ({
        productoId: Number(item.productoId),
        cantidad: Number(item.cantidad),
        precioUnitario: Number(item.precioUnitario),
        imei: item.imei?.trim() || undefined,
      }))
      .filter((item) => item.productoId && item.cantidad > 0 && item.precioUnitario > 0);

    if (detallePayload.length === 0) {
      setFormError('Agrega al menos un producto válido');
      return;
    }

  let creditoPayload: CreateCreditoPayload | undefined;

    if (isCredito) {
      if (!formTipoCredito) {
        setFormError('Selecciona el tipo de crédito');
        return;
      }
      if (!numeroCuotasValue || numeroCuotasValue <= 0) {
        setFormError('El número de cuotas debe ser mayor que cero');
        return;
      }
      if (!Number.isInteger(numeroCuotasValue)) {
        setFormError('El número de cuotas debe ser un valor entero');
        return;
      }
      if (cuotaInicialValue < 0) {
        setFormError('La cuota inicial no puede ser negativa');
        return;
      }
      if (cuotaInicialValue > totalForm) {
        setFormError('La cuota inicial no puede superar el total de la venta');
        return;
      }
      if (saldoCredito <= 0) {
        setFormError('El saldo a financiar debe ser mayor que cero');
        return;
      }
      if (formFechaPrimerPago) {
        const parsedPrimerPago = new Date(formFechaPrimerPago);
        if (Number.isNaN(parsedPrimerPago.getTime())) {
          setFormError('La fecha de primer pago no es válida');
          return;
        }
      }

      creditoPayload = {
        tipoCredito: formTipoCredito,
        numeroCuotas: numeroCuotasValue,
        cuotaInicial: cuotaInicialValue,
        fechaPrimerPago: formFechaPrimerPago || undefined,
      };
    }

    setSubmitLoading(true);
    try {
      const payload = {
        clienteId: Number(formClienteId),
        medioPago: formMedioPago || metadata.mediosPago[0] || 'efectivo',
        tipoVenta: formTipoVenta || metadata.tiposVenta[0] || 'contado',
        fecha: formFecha ? new Date(formFecha).toISOString() : undefined,
        descuento: Number(formDescuento) || 0,
        detalles: detallePayload,
        credito: creditoPayload,
      };

      const venta = await salesController.createVentaContado(payload);
      setVentas((prev) => [venta, ...prev]);
      resetForm();
      setShowCreateModal(false);
    } catch (e) {
      console.error(e);
      setFormError(e instanceof Error ? e.message : 'No se pudo crear la venta');
    } finally {
      setSubmitLoading(false);
    }
  };

  const openDetailModal = (venta: Venta) => {
    setSelectedVenta(venta);
    setEditEstado(venta.estado);
    setEditMedioPago(venta.medioPago);
    setEditCalificacion((venta.calificacion ?? '') as CalificacionCliente | '');
    setUpdateError(null);
    setDeleteError(null);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedVenta(null);
    setUpdateError(null);
    setDeleteError(null);
    setDeleteLoading(false);
  };

  const handleUpdateVenta = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedVenta) return;

    setUpdateError(null);
    setUpdateLoading(true);
    try {
      const payload = {
        estado: editEstado || selectedVenta.estado,
        medioPago: editMedioPago || selectedVenta.medioPago,
        calificacion: editCalificacion || null,
      };

      const ventaActualizada = await salesController.updateVenta(selectedVenta.id, payload);
      setVentas((prev) => prev.map((venta) => (venta.id === ventaActualizada.id ? ventaActualizada : venta)));
      closeDetailModal();
    } catch (e) {
      console.error(e);
      setUpdateError(e instanceof Error ? e.message : 'No se pudo actualizar la venta');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDeleteVenta = async () => {
    if (!selectedVenta) return;

    const mensajeConfirmacion = selectedVenta.estado === 'devuelta'
      ? '¿Confirmas que deseas eliminar esta venta devuelta? Esta acción es permanente.'
      : 'Esta venta aún no está marcada como devuelta. La eliminaremos marcándola como devuelta primero para devolver el inventario y luego se eliminará definitivamente. ¿Deseas continuar?';

    if (!window.confirm(mensajeConfirmacion)) {
      return;
    }

    setDeleteError(null);
    setDeleteLoading(true);
    try {
      await salesController.deleteVenta(selectedVenta.id);
      setVentas((prev) => prev.filter((venta) => venta.id !== selectedVenta.id));
      closeDetailModal();
    } catch (e) {
      console.error(e);
      setDeleteError(e instanceof Error ? e.message : 'No se pudo eliminar la venta');
      setDeleteLoading(false);
    }
  };

  const isVentaDevuelta = selectedVenta?.estado === 'devuelta';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Registro de Ventas</h3>
          <p className="text-gray-600 text-sm mt-1">Gestiona y consulta todas las ventas realizadas</p>
        </div>
        <button
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          onClick={openCreateModal}
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Venta</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, ID o medio de pago..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            value={estadoFiltro}
            onChange={(event) => setEstadoFiltro(event.target.value)}
          >
            <option value="">Todos los estados</option>
            {metadata.estados.map((estado) => (
              <option key={estado} value={estado}>
                {formatEnumLabel(estado)}
              </option>
            ))}
          </select>
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors" onClick={handleReload}>
            <Calendar className="w-4 h-4" />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm mb-1">Total Ventas</p>
          <p className="text-3xl font-bold text-gray-900">{stats.totalVentas}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm mb-1">Ingresos Totales</p>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.ingresos)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm mb-1">Pendientes</p>
          <p className="text-3xl font-bold text-gray-900">{stats.pendientes}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm mb-1">Promedio Venta</p>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.promedio)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="font-medium">Cargando ventas...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <p className="text-red-600 font-medium">{error}</p>
            <button
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              onClick={handleReload}
            >
              Reintentar
            </button>
          </div>
        ) : filteredVentas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No hay ventas registradas</p>
            <p className="text-gray-400 text-sm">Crea tu primera venta para comenzar</p>
          </div>
        ) : (
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
                    Tipo Venta
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Medio Pago
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
                {filteredVentas.map((venta) => (
                  <tr key={venta.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-semibold text-gray-900">#{venta.id}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(venta.fecha).toLocaleString('es-CO', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{venta.clienteNombre}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 capitalize">{formatEnumLabel(venta.tipoVenta)}</td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-900">{formatCurrency(venta.total)}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 capitalize">{formatEnumLabel(venta.medioPago)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium ${
                          STATUS_STYLES[venta.estado] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {statusIcon(venta.estado)}
                        <span className="capitalize">{formatEnumLabel(venta.estado)}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver detalle"
                          onClick={() => openDetailModal(venta)}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

  {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Nueva venta de contado</h3>
                <p className="text-sm text-gray-500">Selecciona el cliente y los productos vendidos</p>
              </div>
              <button className="p-2 rounded-full hover:bg-gray-100 text-gray-500" onClick={closeCreateModal}>
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Cliente *</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                      value={formClienteId}
                      onChange={(event) => setFormClienteId(event.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Selecciona un cliente
                      </option>
                      {clientes.map((cliente) => (
                        <option key={cliente.id} value={cliente.id}>
                          {cliente.nombres} {cliente.apellidos} · {cliente.numeroDocumento}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Tipo de venta *</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500 capitalize"
                      value={formTipoVenta}
                      onChange={(event) => setFormTipoVenta(event.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Selecciona un tipo de venta
                      </option>
                      {metadata.tiposVenta.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {formatEnumLabel(tipo)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Medio de pago *</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500 capitalize"
                      value={formMedioPago}
                      onChange={(event) => setFormMedioPago(event.target.value)}
                      required
                    >
                      {metadata.mediosPago.map((medio) => (
                        <option key={medio} value={medio}>
                          {formatEnumLabel(medio)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Fecha</label>
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                      value={formFecha}
                      onChange={(event) => setFormFecha(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Descuento</label>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                      value={formDescuento}
                      onChange={(event) => setFormDescuento(event.target.value)}
                    />
                  </div>
                </div>

                {isCredito && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Tipo de crédito *</label>
                      <select
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500 capitalize"
                        value={formTipoCredito}
                        onChange={(event) => setFormTipoCredito(event.target.value)}
                        required
                      >
                        {metadata.tiposCredito.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {formatEnumLabel(tipo)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Número de cuotas *</label>
                      <input
                        type="number"
                        min={1}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                        value={formNumeroCuotas}
                        onChange={(event) => setFormNumeroCuotas(event.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Cuota inicial</label>
                      <input
                        type="number"
                        min={0}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                        value={formCuotaInicial}
                        onChange={(event) => setFormCuotaInicial(event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Fecha primer pago</label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                        value={formFechaPrimerPago}
                        onChange={(event) => setFormFechaPrimerPago(event.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Productos</h4>
                    <button
                      type="button"
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border border-green-500 text-green-600 hover:bg-green-50"
                      onClick={handleAddItem}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Añadir producto
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formItems.map((item, index) => (
                      <div key={item.id} className="grid grid-cols-1 md:grid-cols-[2fr,120px,140px,1fr,40px] gap-3 items-start bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Producto *</label>
                          <select
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                            value={item.productoId}
                            onChange={(event) => handleItemChange(item.id, 'productoId', event.target.value)}
                            required
                          >
                            <option value="" disabled>
                              Selecciona un producto
                            </option>
                            {productos.map((producto) => (
                              <option key={producto.id} value={producto.id}>
                                {producto.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Cantidad *</label>
                          <input
                            type="number"
                            min={1}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                            value={item.cantidad}
                            onChange={(event) => handleItemChange(item.id, 'cantidad', event.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Precio unitario *</label>
                          <input
                            type="number"
                            min={0}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500 bg-gray-100 cursor-not-allowed"
                            value={item.precioUnitario}
                            readOnly
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">IMEI (opcional)</label>
                          <input
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                            value={item.imei}
                            onChange={(event) => handleItemChange(item.id, 'imei', event.target.value)}
                            placeholder="123456789012345"
                          />
                        </div>
                        <div className="flex flex-col items-end justify-between h-full">
                          <button
                            type="button"
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={formItems.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(subtotalItems[index] || 0)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <ShoppingCart className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total a cobrar</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalForm)}</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 space-y-1">
                    <p>Subtotal: {formatCurrency(subtotalItems.reduce((acc, value) => acc + value, 0))}</p>
                    <p>Descuento: {formatCurrency(Number(formDescuento) || 0)}</p>
                    {isCredito && (
                      <>
                        <p>Cuota inicial: {formatCurrency(cuotaInicialValue)}</p>
                        <p>Saldo financiado: {formatCurrency(saldoCredito)}</p>
                        <p>Valor cuota estimada: {formatCurrency(valorCuotaEstimado)}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t bg-white">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                  onClick={closeCreateModal}
                  disabled={submitLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-60"
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    'Registrar venta'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && selectedVenta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Venta #{selectedVenta.id}</h3>
                <p className="text-sm text-gray-500">
                  Registrada el {new Date(selectedVenta.fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <button className="p-2 rounded-full hover:bg-gray-100 text-gray-500" onClick={closeDetailModal}>
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateVenta} className="flex-1 overflow-y-auto">
              <div className="px-6 py-6 space-y-6">
                {updateError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    {updateError}
                  </div>
                )}

                {deleteError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    {deleteError}
                  </div>
                )}

                {isVentaDevuelta && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-3 rounded-lg">
                    Esta venta ya fue marcada como devuelta. Puedes actualizar los datos o eliminarla definitivamente si ya conciliaron el inventario.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cliente</p>
                    <p className="text-sm font-medium text-gray-900">{selectedVenta.clienteNombre}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tipo de venta</p>
                    <p className="text-sm font-medium text-gray-900">{formatEnumLabel(selectedVenta.tipoVenta)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total</p>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(selectedVenta.total)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Estado</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500 capitalize"
                      value={editEstado}
                      onChange={(event) => setEditEstado(event.target.value)}
                      required
                    >
                      {metadata.estados.map((estado) => (
                        <option key={estado} value={estado}>
                          {formatEnumLabel(estado)}
                        </option>
                      ))}
                    </select>
                    {editEstado === 'devuelta' && (
                      <p className="mt-2 text-xs text-green-600">
                        Al marcar como devuelta, las cantidades vendidas se devolverán al inventario.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Medio de pago</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500 capitalize"
                      value={editMedioPago}
                      onChange={(event) => setEditMedioPago(event.target.value)}
                      required
                    >
                      {metadata.mediosPago.map((medio) => (
                        <option key={medio} value={medio}>
                          {formatEnumLabel(medio)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Calificación</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                      value={editCalificacion}
                      onChange={(event) => setEditCalificacion(event.target.value as CalificacionCliente | '')}
                    >
                      <option value="">Sin calificar</option>
                      {CALIFICACIONES.map((calificacion) => (
                        <option key={calificacion} value={calificacion}>
                          {calificacion}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Detalle de productos</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Producto
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Cantidad
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Precio unitario
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Subtotal
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            IMEI
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedVenta.detalles.map((detalle) => (
                          <tr key={detalle.id}>
                            <td className="px-4 py-2 text-sm text-gray-800">{detalle.productoNombre}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">{detalle.cantidad}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">{formatCurrency(detalle.precioUnitario)}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">{formatCurrency(detalle.subtotal)}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{detalle.imei || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t bg-white">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                  onClick={closeDetailModal}
                  disabled={updateLoading || deleteLoading}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-60"
                  onClick={handleDeleteVenta}
                  disabled={deleteLoading || updateLoading}
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar venta
                    </>
                  )}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-60"
                  disabled={updateLoading || deleteLoading}
                >
                  {updateLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    'Guardar cambios'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
