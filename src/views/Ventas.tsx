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
  Printer,
  Truck,
  Undo2,
} from 'lucide-react';
import { salesController } from '../controllers/salesController';
import { inventoryController } from '../controllers/inventoryController';
import { emitVentasEnviosSync, subscribeVentasEnviosSync } from '../lib/syncEvents';
import type {
  CalificacionCliente,
  Cliente,
  Producto,
  Venta,
  VentasMetadata,
  CreateCreditoPayload,
  VentasPrintCompanyProfile,
  VentaPrintAudit,
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
  color: string;
  talla: string;
  cantidad: string;
  precioUnitario: string;
  imei: string;
};

const initialVentaItem = (): VentaItemForm => ({
  id: createItemId(),
  productoId: '',
  color: '',
  talla: '',
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

const escapeHtml = (value: string | number | null | undefined) => {
  const text = value == null ? '' : String(value);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatDateTimePrint = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No disponible';
  return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
};

const openPrintWindow = (content: string): boolean => {
  const printWindow = window.open('', '_blank', 'width=1024,height=900');
  if (!printWindow) {
    window.alert('No se pudo abrir la ventana de impresión. Revisa el bloqueador de ventanas emergentes.');
    return false;
  }
  printWindow.document.write(content);
  printWindow.document.close();
  return true;
};

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

const DEFAULT_EMPRESA_PRINT_PROFILE: VentasPrintCompanyProfile = {
  nombre: 'Sistema Ventas',
  nit: '',
  direccion: '',
  telefono: '',
  ciudad: '',
};

const resolveEstadoPagoLabel = (venta: Venta): string => {
  const tipo = String(venta.tipoVenta || '').toLowerCase();
  const estado = String(venta.estado || '').toLowerCase();

  if (estado === 'cancelada' || estado === 'devuelta') {
    return 'No pagado';
  }

  if (tipo === 'contado') {
    return 'Pagado';
  }

  return 'Pendiente';
};

const DEFAULT_VENTAS_METADATA: VentasMetadata = {
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
};

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

type StockOption = {
  nombre: string;
  cantidad: number;
};

const getProductoColoresDisponibles = (producto: Producto | undefined): StockOption[] =>
  (producto?.colores ?? [])
    .filter((item) => Number(item.cantidad ?? 0) > 0)
    .map((item) => ({ nombre: item.nombre, cantidad: Number(item.cantidad ?? 0) }));

const getProductoTallasDisponibles = (producto: Producto | undefined): StockOption[] =>
  (producto?.tallas ?? [])
    .filter((item) => Number(item.cantidad ?? 0) > 0)
    .map((item) => ({ nombre: item.nombre, cantidad: Number(item.cantidad ?? 0) }));

const toIntegerOrZero = (value: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(Math.trunc(parsed), 0);
};

const calculateCreditoCuotaInicial = (items: VentaItemForm[], productos: Producto[]): number => {
  return items.reduce((acc, item) => {
    if (!item.productoId) return acc;
    const producto = productos.find((p) => String(p.id) === item.productoId);
    if (!producto) return acc;
    const cuotaProducto = Math.max(Number(producto.cuotaInicial ?? 0), 0);
    const cantidad = Math.max(Number(item.cantidad || 0), 0);
    return acc + cuotaProducto * cantidad;
  }, 0);
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

interface VentasProps {
  user?: any;
}

export default function Ventas({ user }: VentasProps) {
  const isVendedor = String(user?.rol || '').toLowerCase() === 'vendedor';
  const currentUserId = Number(user?.id);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [metadata, setMetadata] = useState<VentasMetadata>(DEFAULT_VENTAS_METADATA);
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
  const [empresaPrintProfile, setEmpresaPrintProfile] = useState<VentasPrintCompanyProfile>(DEFAULT_EMPRESA_PRINT_PROFILE);
  const [massPrintedVentaIds, setMassPrintedVentaIds] = useState<number[]>([]);
  const [printedVentaAudits, setPrintedVentaAudits] = useState<VentaPrintAudit[]>([]);
  const [saveEmpresaLoading, setSaveEmpresaLoading] = useState(false);
  const [saveEmpresaMessage, setSaveEmpresaMessage] = useState<string | null>(null);

  const selectedCliente = useMemo(() => {
    if (!selectedVenta) return null;
    return clientes.find((cliente) => cliente.id === selectedVenta.clienteId) ?? null;
  }, [clientes, selectedVenta]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const [ventasData, metadataData, clientesData, productosData, printStateData] = await Promise.all([
          salesController.getVentas().catch(() => []),
          salesController.getVentasMetadata().catch(() => DEFAULT_VENTAS_METADATA),
          salesController.getClientes().catch(() => []),
          inventoryController.getProductos().catch(() => []),
          salesController.getVentasPrintState().catch(() => ({
            empresa: DEFAULT_EMPRESA_PRINT_PROFILE,
            printedVentaIds: [],
            printedAudits: [],
          })),
        ]);

        if (!active) return;
        setVentas(ventasData);
        setMetadata(metadataData);
        setClientes(clientesData);
        setProductos(productosData);
        setEmpresaPrintProfile(printStateData.empresa || DEFAULT_EMPRESA_PRINT_PROFILE);
        setMassPrintedVentaIds(printStateData.printedVentaIds || []);
        setPrintedVentaAudits(printStateData.printedAudits || []);
        if (metadataData.mediosPago.length > 0) {
          setFormMedioPago((prev) => prev || metadataData.mediosPago[0]);
        }
        if (metadataData.tiposVenta.length > 0) {
          setFormTipoVenta((prev) => prev || metadataData.tiposVenta[0]);
        }
        if (metadataData.tiposCredito.length > 0) {
          setFormTipoCredito((prev) => prev || metadataData.tiposCredito[0]);
        }
        setFormFechaPrimerPago((prev) => prev || formatDateInput(new Date()));
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

  useEffect(() => {
    const unsubscribe = subscribeVentasEnviosSync((source) => {
      if (source === 'ventas') return;
      handleReload({ silent: true });
    });

    return unsubscribe;
  }, []);

  const handleReload = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    try {
      if (!silent) {
        setLoading(true);
      }
      const ventasData = await salesController.getVentas();
      setVentas(ventasData);
      setError(null);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las ventas');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const handleSaveEmpresaPrintProfile = async () => {
    setSaveEmpresaMessage(null);
    setSaveEmpresaLoading(true);
    try {
      const saved = await salesController.saveVentasPrintCompanyProfile(empresaPrintProfile);
      setEmpresaPrintProfile(saved);
      setSaveEmpresaMessage('Datos de empresa guardados en base de datos.');
    } catch (e) {
      console.error(e);
      setSaveEmpresaMessage('No se pudo guardar la configuración de empresa.');
    } finally {
      setSaveEmpresaLoading(false);
    }
  };

  const filteredVentas = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ventas.filter((venta) => {
      const matchesOwnership =
        !isVendedor || (Number.isInteger(currentUserId) && Number(venta.usuarioId) === currentUserId);
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
      return matchesOwnership && matchesSearch && matchesEstado;
    });
  }, [ventas, search, estadoFiltro, isVendedor, currentUserId]);

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
    setFormItems((prev) => {
      const getMaxAvailableForItem = (target: VentaItemForm, items: VentaItemForm[]): number | null => {
        if (!target.productoId) return null;

        const producto = productos.find((p) => String(p.id) === target.productoId);
        if (!producto) return null;

        const limits: number[] = [];
        if (typeof producto.cantidad === 'number') {
          limits.push(Math.max(Number(producto.cantidad), 0));
        }

        if (target.color) {
          const stockColor = producto.colores.find((entry) => entry.nombre === target.color)?.cantidad;
          if (typeof stockColor === 'number') {
            limits.push(Math.max(Number(stockColor), 0));
          }
        }

        if (target.talla) {
          const stockTalla = producto.tallas.find((entry) => entry.nombre === target.talla)?.cantidad;
          if (typeof stockTalla === 'number') {
            limits.push(Math.max(Number(stockTalla), 0));
          }
        }

        if (limits.length === 0) return null;

        const baseLimit = Math.min(...limits);
        const usesGlobalProductStock = typeof producto.cantidad === 'number';

        const reservedByOthers = items
          .filter((candidate) => candidate.id !== target.id)
          .filter((candidate) => {
            if (candidate.productoId !== target.productoId) return false;
            if (usesGlobalProductStock) return true;

            const colorMatch = target.color ? candidate.color === target.color : true;
            const tallaMatch = target.talla ? candidate.talla === target.talla : true;
            return colorMatch && tallaMatch;
          })
          .reduce((acc, candidate) => acc + toIntegerOrZero(candidate.cantidad), 0);

        return Math.max(baseLimit - reservedByOthers, 0);
      };

      const next = prev.map((item) => {
        if (item.id !== id) return item;

        const updated: VentaItemForm = { ...item, [field]: value } as VentaItemForm;

        if (field === 'productoId') {
          const producto = productos.find((p) => String(p.id) === value);
          updated.precioUnitario = resolveUnitPrice(producto, formTipoVenta || metadata.tiposVenta[0] || 'contado');
          const colores = getProductoColoresDisponibles(producto);
          const tallas = getProductoTallasDisponibles(producto);
          updated.color = colores[0]?.nombre ?? '';
          updated.talla = tallas[0]?.nombre ?? '';
        }

        return updated;
      });

      return next.map((item) => {
        const maxAvailable = getMaxAvailableForItem(item, next);
        if (maxAvailable === null) return item;

        const current = toIntegerOrZero(item.cantidad);
        if (maxAvailable === 0) {
          return { ...item, cantidad: '0' };
        }
        const clamped = Math.max(1, Math.min(current || 1, maxAvailable));
        return { ...item, cantidad: String(clamped) };
      });
    });
  };

  const getMaxAvailableForItem = (target: VentaItemForm, items: VentaItemForm[]): number | null => {
    if (!target.productoId) return null;

    const producto = productos.find((p) => String(p.id) === target.productoId);
    if (!producto) return null;

    const limits: number[] = [];
    if (typeof producto.cantidad === 'number') {
      limits.push(Math.max(Number(producto.cantidad), 0));
    }

    if (target.color) {
      const stockColor = producto.colores.find((entry) => entry.nombre === target.color)?.cantidad;
      if (typeof stockColor === 'number') {
        limits.push(Math.max(Number(stockColor), 0));
      }
    }

    if (target.talla) {
      const stockTalla = producto.tallas.find((entry) => entry.nombre === target.talla)?.cantidad;
      if (typeof stockTalla === 'number') {
        limits.push(Math.max(Number(stockTalla), 0));
      }
    }

    if (limits.length === 0) return null;

    const baseLimit = Math.min(...limits);
    const usesGlobalProductStock = typeof producto.cantidad === 'number';

    const reservedByOthers = items
      .filter((candidate) => candidate.id !== target.id)
      .filter((candidate) => {
        if (candidate.productoId !== target.productoId) return false;
        if (usesGlobalProductStock) return true;

        const colorMatch = target.color ? candidate.color === target.color : true;
        const tallaMatch = target.talla ? candidate.talla === target.talla : true;
        return colorMatch && tallaMatch;
      })
      .reduce((acc, candidate) => acc + toIntegerOrZero(candidate.cantidad), 0);

    return Math.max(baseLimit - reservedByOthers, 0);
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

  useEffect(() => {
    if (formTipoVenta !== 'credito') return;
    const cuotaInicialCalculada = calculateCreditoCuotaInicial(formItems, productos);
    setFormCuotaInicial(String(cuotaInicialCalculada));
  }, [formTipoVenta, formItems, productos]);

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
        color: item.color?.trim() || undefined,
        talla: item.talla?.trim() || undefined,
        imei: item.imei?.trim() || undefined,
      }))
      .filter((item) => item.productoId && item.cantidad > 0 && item.precioUnitario > 0);

    if (detallePayload.length === 0) {
      setFormError('Agrega al menos un producto válido');
      return;
    }

    for (const item of formItems) {
      if (!item.productoId) continue;
      const cantidad = toIntegerOrZero(item.cantidad);
      const maxAvailable = getMaxAvailableForItem(item, formItems);
      if (maxAvailable !== null && maxAvailable <= 0) {
        setFormError('Uno de los productos seleccionados no tiene inventario disponible.');
        return;
      }
      if (maxAvailable !== null && cantidad > maxAvailable) {
        setFormError('La cantidad de un producto supera el inventario disponible. Ajusta el detalle e intenta de nuevo.');
        return;
      }
    }

    for (const item of detallePayload) {
      if (!item.color) {
        setFormError('Debes seleccionar un color para cada producto.');
        return;
      }
      if (!item.talla) {
        setFormError('Debes seleccionar una talla para cada producto.');
        return;
      }
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
      emitVentasEnviosSync('ventas');
      void handleReload({ silent: true });
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
      emitVentasEnviosSync('ventas');
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
      emitVentasEnviosSync('ventas');
      closeDetailModal();
    } catch (e) {
      console.error(e);
      setDeleteError(e instanceof Error ? e.message : 'No se pudo eliminar la venta');
      setDeleteLoading(false);
    }
  };

  const handlePrintVenta = () => {
    if (!selectedVenta) return;

    const subtotalBruto = selectedVenta.detalles.reduce((acc, item) => acc + Number(item.subtotal || 0), 0);
    const descuento = Number(selectedVenta.descuento || 0);
    const totalNeto = Number(selectedVenta.total || 0);

    const clienteNombre = escapeHtml(selectedVenta.clienteNombre || 'No disponible');
    const clienteDocumento = selectedCliente
      ? `${escapeHtml(selectedCliente.tipoIdentificacion)} ${escapeHtml(selectedCliente.numeroDocumento)}`
      : 'No disponible';
    const clienteTelefono = escapeHtml(selectedCliente?.telefono || 'No registrado');
    const clienteCorreo = escapeHtml(selectedCliente?.correo || 'No registrado');
    const clienteDireccion = escapeHtml(selectedCliente?.direccion || 'No registrada');
    const clienteCiudad = escapeHtml(selectedCliente?.ciudad || 'No registrada');
    const clienteDepartamento = escapeHtml(selectedCliente?.departamento || 'No registrado');
    const clienteBarrio = escapeHtml(selectedCliente?.barrio || 'No registrado');
    const empresaNombre = escapeHtml(empresaPrintProfile.nombre || 'Sistema Ventas');
    const empresaNit = escapeHtml(empresaPrintProfile.nit || 'No registrado');
    const empresaDireccion = escapeHtml(empresaPrintProfile.direccion || 'No registrada');
    const empresaTelefono = escapeHtml(empresaPrintProfile.telefono || 'No registrado');
    const empresaCiudad = escapeHtml(empresaPrintProfile.ciudad || 'No registrada');

    const detalleRows = selectedVenta.detalles.map((detalle) => {
      const producto = escapeHtml(detalle.productoNombre || 'Sin nombre');
      const cantidad = Number(detalle.cantidad || 0);
      const precioUnitario = escapeHtml(formatCurrency(Number(detalle.precioUnitario || 0)));
      const subtotal = escapeHtml(formatCurrency(Number(detalle.subtotal || 0)));
      const color = escapeHtml(detalle.color || '—');
      const talla = escapeHtml(detalle.talla || '—');
      const imei = escapeHtml(detalle.imei || '—');

      return `
        <tr>
          <td>${producto}</td>
          <td>${cantidad}</td>
          <td>${color}</td>
          <td>${talla}</td>
          <td>${imei}</td>
          <td>${precioUnitario}</td>
          <td>${subtotal}</td>
        </tr>
      `;
    }).join('');

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Comprobante Venta #${selectedVenta.id}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 24px;
            color: #111827;
            font-size: 12px;
          }
          .sheet {
            max-width: 980px;
            margin: 0 auto;
          }
          .header {
            border: 2px solid #111827;
            padding: 14px;
            margin-bottom: 16px;
          }
          .title {
            font-size: 20px;
            font-weight: bold;
            margin: 0 0 6px;
          }
          .subtitle {
            margin: 0;
            color: #374151;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 16px;
          }
          .box {
            border: 1px solid #d1d5db;
            padding: 10px;
          }
          .box h3 {
            margin: 0 0 8px;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }
          .row {
            margin-bottom: 4px;
          }
          .label {
            font-weight: bold;
            display: inline-block;
            min-width: 125px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }
          th, td {
            border: 1px solid #d1d5db;
            padding: 6px;
            text-align: left;
          }
          th {
            background: #f3f4f6;
            font-size: 11px;
            text-transform: uppercase;
          }
          .totals {
            margin-top: 12px;
            margin-left: auto;
            max-width: 340px;
            border: 1px solid #d1d5db;
            padding: 10px;
          }
          .totals .line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
          }
          .totals .line.total {
            border-top: 1px solid #d1d5db;
            padding-top: 6px;
            margin-top: 6px;
            font-size: 14px;
            font-weight: bold;
          }
          @media print {
            body {
              padding: 12px;
            }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <p class="title">Comprobante de Venta #${selectedVenta.id}</p>
            <p class="subtitle">Fecha: ${escapeHtml(formatDateTimePrint(selectedVenta.fecha))}</p>
          </div>

          <div class="grid">
            <div class="box">
              <h3>Datos de la Empresa (Remitente)</h3>
              <div class="row"><span class="label">Empresa:</span>${empresaNombre}</div>
              <div class="row"><span class="label">NIT/Documento:</span>${empresaNit}</div>
              <div class="row"><span class="label">Dirección:</span>${empresaDireccion}</div>
              <div class="row"><span class="label">Teléfono:</span>${empresaTelefono}</div>
              <div class="row"><span class="label">Ciudad:</span>${empresaCiudad}</div>
            </div>

            <div class="box">
              <h3>Datos del Cliente</h3>
              <div class="row"><span class="label">Nombre:</span>${clienteNombre}</div>
              <div class="row"><span class="label">Documento:</span>${clienteDocumento}</div>
              <div class="row"><span class="label">Teléfono:</span>${clienteTelefono}</div>
              <div class="row"><span class="label">Correo:</span>${clienteCorreo}</div>
              <div class="row"><span class="label">Dirección:</span>${clienteDireccion}</div>
              <div class="row"><span class="label">Barrio:</span>${clienteBarrio}</div>
              <div class="row"><span class="label">Ciudad:</span>${clienteCiudad}</div>
              <div class="row"><span class="label">Departamento:</span>${clienteDepartamento}</div>
            </div>
          </div>

          <div class="grid">
            <div class="box">
              <h3>Datos de la Venta</h3>
              <div class="row"><span class="label">ID Venta:</span>#${selectedVenta.id}</div>
              <div class="row"><span class="label">Vendedor:</span>${escapeHtml(selectedVenta.usuarioNombre || 'No disponible')}</div>
              <div class="row"><span class="label">Tipo:</span>${escapeHtml(formatEnumLabel(selectedVenta.tipoVenta))}</div>
              <div class="row"><span class="label">Medio de pago:</span>${escapeHtml(formatEnumLabel(selectedVenta.medioPago))}</div>
              <div class="row"><span class="label">Estado:</span>${escapeHtml(formatEnumLabel(selectedVenta.estado))}</div>
              <div class="row"><span class="label">Estado de pago:</span>${escapeHtml(resolveEstadoPagoLabel(selectedVenta))}</div>
              <div class="row"><span class="label">Calificación:</span>${escapeHtml(selectedVenta.calificacion || 'Sin calificar')}</div>
            </div>
          </div>

          <div class="box">
            <h3>Detalle de Productos</h3>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Color</th>
                  <th>Talla</th>
                  <th>IMEI</th>
                  <th>Precio Unitario</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${detalleRows}
              </tbody>
            </table>
          </div>

          <div class="totals">
            <div class="line"><span>Subtotal bruto</span><span>${escapeHtml(formatCurrency(subtotalBruto))}</span></div>
            <div class="line"><span>Descuento</span><span>${escapeHtml(formatCurrency(descuento))}</span></div>
            <div class="line total"><span>Total venta</span><span>${escapeHtml(formatCurrency(totalNeto))}</span></div>
          </div>
        </div>

        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    openPrintWindow(printContent);
  };

  const buildTirillaVentaMarkup = (venta: Venta, cliente: Cliente | null) => {
    const empresaNombre = escapeHtml(empresaPrintProfile.nombre || 'Sistema Ventas');
    const empresaNit = escapeHtml(empresaPrintProfile.nit || 'No registrado');
    const empresaDireccion = escapeHtml(empresaPrintProfile.direccion || 'No registrada');
    const empresaTelefono = escapeHtml(empresaPrintProfile.telefono || 'No registrado');
    const empresaCiudad = escapeHtml(empresaPrintProfile.ciudad || 'No registrada');

    const clienteNombre = escapeHtml(venta.clienteNombre || 'No disponible');
    const clienteDocumento = cliente
      ? `${escapeHtml(cliente.tipoIdentificacion)} ${escapeHtml(cliente.numeroDocumento)}`
      : 'No disponible';
    const clienteTelefono = escapeHtml(cliente?.telefono || 'No registrado');
    const clienteDireccion = escapeHtml(cliente?.direccion || 'No registrada');
    const clienteCiudad = escapeHtml(cliente?.ciudad || 'No registrada');
    const estadoPago = escapeHtml(resolveEstadoPagoLabel(venta));

    const items = venta.detalles.map((detalle) => {
      const descripcion = [
        detalle.productoNombre || 'Producto',
        detalle.color ? `Color ${detalle.color}` : null,
        detalle.talla ? `Talla ${detalle.talla}` : null,
        detalle.imei ? `IMEI ${detalle.imei}` : null,
      ].filter(Boolean).join(' - ');

      return `
        <div class="item">
          <div class="desc">${escapeHtml(descripcion)}</div>
          <div class="line">
            <span>${Number(detalle.cantidad || 0)} x ${escapeHtml(formatCurrency(Number(detalle.precioUnitario || 0)))}</span>
            <strong>${escapeHtml(formatCurrency(Number(detalle.subtotal || 0)))}</strong>
          </div>
        </div>
      `;
    }).join('');

    const subtotalBruto = venta.detalles.reduce((acc, item) => acc + Number(item.subtotal || 0), 0);
    const descuento = Number(venta.descuento || 0);
    const totalNeto = Number(venta.total || 0);

    return `
      <section class="ticket">
        <div class="center strong">REMISION / FACTURA</div>
        <div class="center strong">${empresaNombre}</div>
        <div class="center small">NIT: ${empresaNit}</div>
        <div class="center small">${empresaDireccion}</div>
        <div class="center small">${empresaCiudad} | Tel: ${empresaTelefono}</div>

        <div class="separator"></div>
        <div><span class="strong">Venta:</span> #${venta.id}</div>
        <div><span class="strong">Fecha:</span> ${escapeHtml(formatDateTimePrint(venta.fecha))}</div>
        <div><span class="strong">Vendedor:</span> ${escapeHtml(venta.usuarioNombre || 'No disponible')}</div>

        <div class="separator"></div>
        <div class="strong">Cliente</div>
        <div>${clienteNombre}</div>
        <div class="small">Doc: ${clienteDocumento}</div>
        <div class="small">Tel: ${clienteTelefono}</div>
        <div class="small">Dir: ${clienteDireccion}</div>
        <div class="small">Ciudad: ${clienteCiudad}</div>

        <div class="separator"></div>
        <div class="strong">Descripcion del pedido</div>
        ${items || '<div class="small">Sin detalle disponible</div>'}

        <div class="separator"></div>
        <div class="line"><span>Subtotal</span><span>${escapeHtml(formatCurrency(subtotalBruto))}</span></div>
        <div class="line"><span>Descuento</span><span>${escapeHtml(formatCurrency(descuento))}</span></div>
        <div class="line strong"><span>Total</span><span>${escapeHtml(formatCurrency(totalNeto))}</span></div>

        <div class="separator"></div>
        <div><span class="strong">Tipo:</span> ${escapeHtml(formatEnumLabel(venta.tipoVenta))}</div>
        <div><span class="strong">Medio pago:</span> ${escapeHtml(formatEnumLabel(venta.medioPago))}</div>
        <div><span class="strong">Estado venta:</span> ${escapeHtml(formatEnumLabel(venta.estado))}</div>
        <div><span class="strong">Estado de pago:</span> ${estadoPago}</div>

        <div class="separator"></div>
        <div class="center small">Gracias por su compra</div>
      </section>
    `;
  };

  const handlePrintTirilla = async () => {
    if (!selectedVenta) return;

    const ticketSection = buildTirillaVentaMarkup(selectedVenta, selectedCliente);

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Tirilla Venta #${selectedVenta.id}</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Courier New', monospace;
            color: #111;
            font-size: 11px;
          }
          .ticket {
            width: 58mm;
            max-width: 58mm;
            margin: 0 auto;
            padding: 8px 6px 10px;
            box-sizing: border-box;
          }
          .center {
            text-align: center;
          }
          .strong {
            font-weight: 700;
          }
          .separator {
            border-top: 1px dashed #000;
            margin: 8px 0;
          }
          .line {
            display: flex;
            justify-content: space-between;
            gap: 6px;
          }
          .item {
            margin-bottom: 6px;
          }
          .desc {
            white-space: pre-wrap;
            word-break: break-word;
            margin-bottom: 2px;
          }
          .small {
            font-size: 10px;
          }
          @page {
            size: 58mm auto;
            margin: 3mm;
          }
        </style>
      </head>
      <body>
        ${ticketSection}

        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    const didOpen = openPrintWindow(printContent);
    if (didOpen) {
      try {
        const result = await salesController.markVentasAsPrinted([selectedVenta.id]);
        const markedIds = result.markedIds;
        if (markedIds.length > 0) {
          setMassPrintedVentaIds((prev) => {
            const next = new Set(prev);
            markedIds.forEach((id) => next.add(id));
            return Array.from(next);
          });
          if (result.markedAudits.length > 0) {
            setPrintedVentaAudits((prev) => {
              const next = new Map(prev.map((item) => [item.ventaId, item]));
              result.markedAudits.forEach((audit) => next.set(audit.ventaId, audit));
              return Array.from(next.values());
            });
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const pendingMassPrintVentas = useMemo(
    () => ventas.filter((venta) => !massPrintedVentaIds.includes(venta.id)),
    [ventas, massPrintedVentaIds]
  );

  const printedAuditByVentaId = useMemo(() => {
    const map = new Map<number, VentaPrintAudit>();
    printedVentaAudits.forEach((audit) => {
      if (Number.isInteger(audit.ventaId) && audit.ventaId > 0) {
        map.set(audit.ventaId, audit);
      }
    });
    return map;
  }, [printedVentaAudits]);

  const handleMassPrintPendingVentas = async () => {
    if (pendingMassPrintVentas.length === 0) {
      window.alert('No hay ventas pendientes por imprimir.');
      return;
    }

    const sections = pendingMassPrintVentas.map((venta) => {
      const cliente = clientes.find((item) => item.id === venta.clienteId) ?? null;
      return buildTirillaVentaMarkup(venta, cliente);
    }).join('<div class="ticket-break"></div>');

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Tirillas pendientes (${pendingMassPrintVentas.length})</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Courier New', monospace;
            color: #111;
            font-size: 11px;
          }
          .ticket {
            width: 58mm;
            max-width: 58mm;
            margin: 0 auto;
            padding: 8px 6px 10px;
            box-sizing: border-box;
          }
          .center { text-align: center; }
          .strong { font-weight: 700; }
          .separator { border-top: 1px dashed #000; margin: 8px 0; }
          .line { display: flex; justify-content: space-between; gap: 6px; }
          .item { margin-bottom: 6px; }
          .desc { white-space: pre-wrap; word-break: break-word; margin-bottom: 2px; }
          .small { font-size: 10px; }
          .ticket-break {
            break-after: page;
            page-break-after: always;
            height: 0;
            margin: 0;
            padding: 0;
          }
          .ticket-break:last-child {
            display: none;
          }
          @page {
            size: 58mm auto;
            margin: 3mm;
          }
        </style>
      </head>
      <body>
        ${sections}
        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    const didOpen = openPrintWindow(printContent);
    if (didOpen) {
      try {
        const result = await salesController.markVentasAsPrinted(pendingMassPrintVentas.map((venta) => venta.id));
        const markedIds = result.markedIds;
        if (markedIds.length > 0) {
          setMassPrintedVentaIds((prev) => {
            const next = new Set(prev);
            markedIds.forEach((id) => next.add(id));
            return Array.from(next);
          });
          if (result.markedAudits.length > 0) {
            setPrintedVentaAudits((prev) => {
              const next = new Map(prev.map((item) => [item.ventaId, item]));
              result.markedAudits.forEach((audit) => next.set(audit.ventaId, audit));
              return Array.from(next.values());
            });
          }
        }
      } catch (e) {
        console.error(e);
      }
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
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            className="inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            onClick={handleMassPrintPendingVentas}
            title="Imprimir todas las ventas pendientes por tirilla"
          >
            <Printer className="w-4 h-4" />
            <span>Impresión masiva pendientes ({pendingMassPrintVentas.length})</span>
          </button>
          <button
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            onClick={openCreateModal}
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Venta</span>
          </button>
        </div>
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
            title="Filtrar ventas por estado"
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
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors" onClick={() => void handleReload()}>
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

      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100 min-w-0">
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
              onClick={() => void handleReload()}
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
          <>
          <div className="hidden md:block overflow-x-auto">
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
                    Vendedor
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
                      {printedAuditByVentaId.get(venta.id)?.printedAt && (
                        <p className="mt-1 text-xs text-emerald-700">
                          Impresa: {new Date(printedAuditByVentaId.get(venta.id)?.printedAt || '').toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{venta.clienteNombre}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {venta.usuarioNombre || 'No disponible'}
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
          <div className="md:hidden divide-y divide-gray-100">
            {filteredVentas.map((venta) => (
              <div key={venta.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-gray-900">#{venta.id}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(venta.fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Ver detalle"
                    onClick={() => openDetailModal(venta)}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{venta.clienteNombre}</p>
                  <p className="text-gray-600">Vendedor: {venta.usuarioNombre || 'No disponible'}</p>
                  <p className="text-gray-600">{formatEnumLabel(venta.tipoVenta)} · {formatEnumLabel(venta.medioPago)}</p>
                  {printedAuditByVentaId.get(venta.id)?.printedAt && (
                    <p className="text-xs text-emerald-700 mt-1">
                      Impresa: {new Date(printedAuditByVentaId.get(venta.id)?.printedAt || '').toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">{formatCurrency(venta.total)}</span>
                  <span
                    className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium ${
                      STATUS_STYLES[venta.estado] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {statusIcon(venta.estado)}
                    <span className="capitalize">{formatEnumLabel(venta.estado)}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

  {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col min-w-0">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Nueva venta de contado</h3>
                <p className="text-sm text-gray-500">Selecciona el cliente y los productos vendidos</p>
              </div>
              <button
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
                onClick={closeCreateModal}
                title="Cerrar modal de venta"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Cliente *</label>
                    <select
                      title="Cliente de la venta"
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
                      title="Tipo de venta"
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
                      title="Medio de pago"
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
                      title="Fecha de la venta"
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
                      title="Descuento de la venta"
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
                        title="Tipo de crédito"
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
                        title="Número de cuotas"
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
                        title="Cuota inicial"
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500 bg-gray-100 cursor-not-allowed"
                        value={formCuotaInicial}
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Fecha primer pago</label>
                      <input
                        type="date"
                        title="Fecha del primer pago"
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
                    {formItems.map((item, index) => {
                      const maxCantidadDisponible = getMaxAvailableForItem(item, formItems);
                      const sinStock = maxCantidadDisponible !== null && maxCantidadDisponible <= 0;

                      return (
                      <div key={item.id} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[2fr,110px,130px,1fr,1fr,1fr,40px] gap-3 items-start bg-gray-50 border border-gray-200 rounded-xl p-4 min-w-0">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Producto *</label>
                          <select
                            title="Producto del detalle"
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
                            min={sinStock ? 0 : 1}
                            max={maxCantidadDisponible ?? undefined}
                            title="Cantidad del producto"
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                            value={item.cantidad}
                            onChange={(event) => handleItemChange(item.id, 'cantidad', event.target.value)}
                            required
                          />
                          {maxCantidadDisponible !== null && (
                            <p className={`mt-1 text-xs ${sinStock ? 'text-red-600' : 'text-gray-500'}`}>
                              {sinStock
                                ? 'Sin inventario disponible para esta selección'
                                : `Disponible: ${maxCantidadDisponible}`}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Precio unitario *</label>
                          <input
                            type="number"
                            min={0}
                            title="Precio unitario del producto"
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500 bg-gray-100 cursor-not-allowed"
                            value={item.precioUnitario}
                            readOnly
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Color *</label>
                          <select
                            title="Color del producto"
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                            value={item.color}
                            onChange={(event) => handleItemChange(item.id, 'color', event.target.value)}
                            required
                          >
                            <option value="" disabled>
                              Selecciona color
                            </option>
                            {getProductoColoresDisponibles(
                              productos.find((producto) => String(producto.id) === item.productoId)
                            ).map((color) => (
                              <option key={`${item.id}-color-${color.nombre}`} value={color.nombre}>
                                {`${color.nombre} (${color.cantidad})`}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Talla *</label>
                          <select
                            title="Talla del producto"
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                            value={item.talla}
                            onChange={(event) => handleItemChange(item.id, 'talla', event.target.value)}
                            required
                          >
                            <option value="" disabled>
                              Selecciona talla
                            </option>
                            {getProductoTallasDisponibles(
                              productos.find((producto) => String(producto.id) === item.productoId)
                            ).map((talla) => (
                              <option key={`${item.id}-talla-${talla.nombre}`} value={talla.nombre}>
                                {`${talla.nombre} (${talla.cantidad})`}
                              </option>
                            ))}
                          </select>
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
                        <div className="flex sm:col-span-2 xl:col-span-1 flex-row xl:flex-col items-center xl:items-end justify-between h-full gap-2">
                          <button
                            type="button"
                            title="Eliminar producto del detalle"
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
                      );
                    })}
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

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t bg-white">
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
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col min-w-0">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Venta #{selectedVenta.id}</h3>
                <p className="text-sm text-gray-500">
                  Registrada el {new Date(selectedVenta.fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
                {printedAuditByVentaId.get(selectedVenta.id)?.printedAt && (
                  <p className="text-xs text-emerald-700 mt-1">
                    Impresa: {new Date(printedAuditByVentaId.get(selectedVenta.id)?.printedAt || '').toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                    {' · '}
                    Por: {printedAuditByVentaId.get(selectedVenta.id)?.printedByUserNombre || 'Usuario no disponible'}
                  </p>
                )}
              </div>
              <button
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
                onClick={closeDetailModal}
                title="Cerrar detalle de venta"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateVenta} className="flex-1 overflow-y-auto">
              <div className="px-4 sm:px-6 py-6 space-y-6">
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
                      title="Estado de la venta"
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
                      title="Medio de pago de la venta"
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
                      title="Calificación de la venta"
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
                  <div className="hidden md:block overflow-x-auto">
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
                  <div className="md:hidden divide-y divide-gray-200">
                    {selectedVenta.detalles.map((detalle) => (
                      <div key={detalle.id} className="p-3 space-y-1 text-sm">
                        <p className="font-medium text-gray-900">{detalle.productoNombre}</p>
                        <p className="text-gray-600">Cantidad: {detalle.cantidad}</p>
                        <p className="text-gray-600">Precio: {formatCurrency(detalle.precioUnitario)}</p>
                        <p className="text-gray-600">Subtotal: {formatCurrency(detalle.subtotal)}</p>
                        <p className="text-gray-500">IMEI: {detalle.imei || '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
                    Datos del remitente para impresión
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Empresa</label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                        value={empresaPrintProfile.nombre}
                        onChange={(event) => setEmpresaPrintProfile((prev) => ({ ...prev, nombre: event.target.value }))}
                        placeholder="Nombre de la empresa"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">NIT / Documento</label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                        value={empresaPrintProfile.nit}
                        onChange={(event) => setEmpresaPrintProfile((prev) => ({ ...prev, nit: event.target.value }))}
                        placeholder="NIT o identificación"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Dirección</label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                        value={empresaPrintProfile.direccion}
                        onChange={(event) => setEmpresaPrintProfile((prev) => ({ ...prev, direccion: event.target.value }))}
                        placeholder="Dirección de despacho"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Teléfono</label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                        value={empresaPrintProfile.telefono}
                        onChange={(event) => setEmpresaPrintProfile((prev) => ({ ...prev, telefono: event.target.value }))}
                        placeholder="Teléfono de contacto"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Ciudad</label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-green-500 focus:ring-green-500"
                        value={empresaPrintProfile.ciudad}
                        onChange={(event) => setEmpresaPrintProfile((prev) => ({ ...prev, ciudad: event.target.value }))}
                        placeholder="Ciudad de origen"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                      onClick={handleSaveEmpresaPrintProfile}
                      disabled={saveEmpresaLoading}
                    >
                      {saveEmpresaLoading ? 'Guardando...' : 'Guardar datos de empresa'}
                    </button>
                    {saveEmpresaMessage && (
                      <span className="text-xs text-gray-600">{saveEmpresaMessage}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t bg-white">
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
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-60"
                  onClick={handlePrintVenta}
                  disabled={updateLoading || deleteLoading}
                >
                  <Printer className="mr-2 h-4 w-4" /> Imprimir venta
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-60"
                  onClick={handlePrintTirilla}
                  disabled={updateLoading || deleteLoading}
                >
                  <Printer className="mr-2 h-4 w-4" /> Imprimir tirilla
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
