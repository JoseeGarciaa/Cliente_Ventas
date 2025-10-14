import type {
  Cliente,
  Producto,
  Venta,
  VentaDetalle,
  Envio,
  Credito,
  Pago,
  Usuario,
  CreateClientePayload,
  CreateVentaContadoPayload,
  UpdateVentaPayload,
  VentasMetadata,
  TipoCredito,
  EstadoCredito,
  EstadoCuotaCredito,
  CalificacionCliente,
  CreditosResponse,
  RegistrarPagoCreditoPayload,
  UpdateClientePayload,
} from '../models/types';
import { fetchWithAuth } from '../lib/api';

const DEFAULT_TIPOS_VENTA = ['contado', 'credito'];
const DEFAULT_MEDIOS_PAGO = [
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
];
const DEFAULT_ESTADOS_VENTA = ['pendiente', 'confirmada', 'enviada', 'entregada', 'cancelada', 'devuelta'];
const DEFAULT_TIPOS_CREDITO: TipoCredito[] = ['diario', 'semanal', 'quincenal', 'mensual'];
const DEFAULT_ESTADOS_CREDITO: EstadoCredito[] = ['activo', 'pagado', 'cancelado', 'mora'];
const DEFAULT_ESTADOS_CUOTA_CREDITO: EstadoCuotaCredito[] = ['pendiente', 'pagada', 'vencida'];
const DEFAULT_CALIFICACIONES_CREDITO: CalificacionCliente[] = ['Pendiente', 'Positivo', 'Negativo', 'Hurto'];

export const salesController = {
  getDashboardStats: () => {
    return {
      ventasMes: 0,
      totalIngresos: 1800000,
      totalClientes: 0,
      creditosVencidos: 0,
      perdidasDevoluciones: 0,
      costoInventario: 10000000,
      totalVentas: 1,
    };
  },

  getClientes: async (): Promise<Cliente[]> => {
    const data = await fetchWithAuth<Cliente[]>('/api/clientes');
    return data.map((cliente) => ({
      ...cliente,
      telefono: cliente.telefono ?? null,
      direccion: cliente.direccion ?? null,
      correo: cliente.correo ?? null,
      fechaRegistro: cliente.fechaRegistro ?? null,
      ciudad: cliente.ciudad ?? null,
      departamento: cliente.departamento ?? null,
      calificacion: cliente.calificacion ?? null,
      barrio: cliente.barrio ?? null,
      modoChat: cliente.modoChat ?? null,
    }));
  },

  createCliente: async (payload: CreateClientePayload): Promise<Cliente> => {
    const body = JSON.stringify(payload);
    const data = await fetchWithAuth<Cliente>('/api/clientes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });
    return {
      ...data,
      telefono: data.telefono ?? null,
      direccion: data.direccion ?? null,
      correo: data.correo ?? null,
      fechaRegistro: data.fechaRegistro ?? null,
      ciudad: data.ciudad ?? null,
      departamento: data.departamento ?? null,
      calificacion: data.calificacion ?? null,
      barrio: data.barrio ?? null,
      modoChat: data.modoChat ?? null,
    };
  },

  updateCliente: async (clienteId: number, payload: UpdateClientePayload): Promise<Cliente> => {
    const body = JSON.stringify(payload);
    const data = await fetchWithAuth<Cliente>(`/api/clientes/${clienteId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    return {
      ...data,
      telefono: data.telefono ?? null,
      direccion: data.direccion ?? null,
      correo: data.correo ?? null,
      fechaRegistro: data.fechaRegistro ?? null,
      ciudad: data.ciudad ?? null,
      departamento: data.departamento ?? null,
      calificacion: data.calificacion ?? null,
      barrio: data.barrio ?? null,
      modoChat: data.modoChat ?? null,
    };
  },

  deleteCliente: async (clienteId: number): Promise<{ deleted: boolean }> => {
    return fetchWithAuth<{ deleted: boolean }>(`/api/clientes/${clienteId}`, {
      method: 'DELETE',
    });
  },

  getVentasMetadata: async (): Promise<VentasMetadata> => {
    const metadata = await fetchWithAuth<VentasMetadata>('/api/ventas/metadata');
    const calificacionesRemotas = (metadata.calificacionesCredito ?? []).filter((value): value is CalificacionCliente =>
      DEFAULT_CALIFICACIONES_CREDITO.includes(value as CalificacionCliente)
    );
    return {
      tiposVenta: metadata.tiposVenta?.length ? metadata.tiposVenta : [...DEFAULT_TIPOS_VENTA],
      mediosPago: metadata.mediosPago?.length ? metadata.mediosPago : [...DEFAULT_MEDIOS_PAGO],
      estados: metadata.estados?.length ? metadata.estados : [...DEFAULT_ESTADOS_VENTA],
      tiposCredito: metadata.tiposCredito?.length ? metadata.tiposCredito : [...DEFAULT_TIPOS_CREDITO],
      estadosCredito: metadata.estadosCredito?.length ? metadata.estadosCredito : [...DEFAULT_ESTADOS_CREDITO],
      estadosCuotaCredito: metadata.estadosCuotaCredito?.length
        ? metadata.estadosCuotaCredito
        : [...DEFAULT_ESTADOS_CUOTA_CREDITO],
      calificacionesCredito: calificacionesRemotas.length
        ? calificacionesRemotas
        : [...DEFAULT_CALIFICACIONES_CREDITO],
    };
  },

  getVentas: async (): Promise<Venta[]> => {
    const data = await fetchWithAuth<Venta[]>('/api/ventas');
    return data.map((venta) => ({
      ...venta,
      fecha: venta.fecha,
      total: Number(venta.total ?? 0),
      descuento: Number(venta.descuento ?? 0),
      calificacion: (venta.calificacion ?? null) as Venta['calificacion'],
      detalles: venta.detalles.map((detalle: VentaDetalle) => ({
        ...detalle,
        cantidad: Number(detalle.cantidad ?? 0),
        precioUnitario: Number(detalle.precioUnitario ?? 0),
        subtotal: Number(detalle.subtotal ?? 0),
      })),
    }));
  },

  createVentaContado: async (payload: CreateVentaContadoPayload): Promise<Venta> => {
    const body = JSON.stringify({
      ...payload,
      tipoVenta: payload.tipoVenta ?? 'contado',
    });
    const data = await fetchWithAuth<Venta>('/api/ventas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });
    return {
      ...data,
      total: Number(data.total ?? 0),
      descuento: Number(data.descuento ?? 0),
      calificacion: (data.calificacion ?? null) as Venta['calificacion'],
      detalles: data.detalles.map((detalle) => ({
        ...detalle,
        cantidad: Number(detalle.cantidad ?? 0),
        precioUnitario: Number(detalle.precioUnitario ?? 0),
        subtotal: Number(detalle.subtotal ?? 0),
      })),
    };
  },

  updateVenta: async (ventaId: number, payload: UpdateVentaPayload): Promise<Venta> => {
    const body = JSON.stringify(payload);
    const data = await fetchWithAuth<Venta>(`/api/ventas/${ventaId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });
    return {
      ...data,
      total: Number(data.total ?? 0),
      descuento: Number(data.descuento ?? 0),
      calificacion: (data.calificacion ?? null) as Venta['calificacion'],
      detalles: data.detalles.map((detalle) => ({
        ...detalle,
        cantidad: Number(detalle.cantidad ?? 0),
        precioUnitario: Number(detalle.precioUnitario ?? 0),
        subtotal: Number(detalle.subtotal ?? 0),
      })),
    };
  },

  deleteVenta: async (ventaId: number): Promise<{ deleted: boolean; fueDevuelta: boolean }> => {
    return fetchWithAuth<{ deleted: boolean; fueDevuelta: boolean }>(`/api/ventas/${ventaId}`, {
      method: 'DELETE',
    });
  },

  getProductos: (): Producto[] => {
    return [];
  },

  getEnvios: (): Envio[] => {
    return [];
  },

  getCreditos: async (): Promise<CreditosResponse> => {
    const data = await fetchWithAuth<CreditosResponse>('/api/creditos');
    const stats = {
      totalCreditos: Number(data.stats.totalCreditos ?? 0),
      montoOtorgado: Number(data.stats.montoOtorgado ?? 0),
      montoCobrado: Number(data.stats.montoCobrado ?? 0),
      montoPendiente: Number(data.stats.montoPendiente ?? 0),
      creditosVencidos: Number(data.stats.creditosVencidos ?? 0),
    };

    const creditos = data.creditos.map((credito) => ({
      ...credito,
      numeroCuotas: Number(credito.numeroCuotas ?? credito.cuotas.length ?? 0),
      cuotaInicial: Number(credito.cuotaInicial ?? 0),
      valorCuota: Number(credito.valorCuota ?? 0),
      saldoTotal: Number(credito.saldoTotal ?? 0),
      montoOriginal: Number(credito.montoOriginal ?? 0),
      montoPagado: Number(credito.montoPagado ?? 0),
      montoPendiente: Number(credito.montoPendiente ?? 0),
      totalVenta: Number(credito.totalVenta ?? 0),
      cuotas: credito.cuotas.map((cuota) => ({
        ...cuota,
        valor: Number(cuota.valor ?? 0),
        valorPagado: Number(cuota.valorPagado ?? 0),
      })),
      proximaCuota: credito.proximaCuota
        ? {
            ...credito.proximaCuota,
            valor: Number(credito.proximaCuota.valor ?? 0),
            valorPagado: Number(credito.proximaCuota.valorPagado ?? 0),
          }
        : null,
    }));

    return { stats, creditos };
  },

  payCredito: async (creditoId: number, payload: RegistrarPagoCreditoPayload): Promise<Credito> => {
    const body = JSON.stringify(payload);
    const data = await fetchWithAuth<Credito>(`/api/creditos/${creditoId}/pagos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    return {
      ...data,
      numeroCuotas: Number(data.numeroCuotas ?? data.cuotas.length ?? 0),
      cuotaInicial: Number(data.cuotaInicial ?? 0),
      valorCuota: Number(data.valorCuota ?? 0),
      saldoTotal: Number(data.saldoTotal ?? 0),
      montoOriginal: Number(data.montoOriginal ?? 0),
      montoPagado: Number(data.montoPagado ?? 0),
      montoPendiente: Number(data.montoPendiente ?? 0),
      totalVenta: Number(data.totalVenta ?? 0),
      cuotas: data.cuotas.map((cuota) => ({
        ...cuota,
        valor: Number(cuota.valor ?? 0),
        valorPagado: Number(cuota.valorPagado ?? 0),
      })),
      proximaCuota: data.proximaCuota
        ? {
            ...data.proximaCuota,
            valor: Number(data.proximaCuota.valor ?? 0),
            valorPagado: Number(data.proximaCuota.valorPagado ?? 0),
          }
        : null,
    };
  },

  getPagos: (): Pago[] => {
    return [];
  },

  getUsuarios: (): Usuario[] => {
    return [];
  },
};
