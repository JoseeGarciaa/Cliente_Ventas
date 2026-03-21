import type {
  Cliente,
  Producto,
  Venta,
  VentaDetalle,
  Envio,
  Credito,
  Pago,
  Usuario,
  UsuariosMetadata,
  CreateUsuarioPayload,
  UpdateUsuarioPayload,
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
  CreateEnvioPayload,
  UpdateEnvioPayload,
  EnviosResponse,
  EnviosStats,
  VentasSinEnvioResponse,
  DashboardStats,
  VentasPrintCompanyProfile,
  VentasPrintState,
  VentaPrintAudit,
} from '../models/types';
import { fetchWithAuth } from '../lib/api';
import { inventoryController } from './inventoryController';

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

const toIsoStringOrNull = (value: unknown): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const salesController = {
  getDashboardStats: async (): Promise<DashboardStats> => {
    const [ventas, clientes, creditosResponse, productos, enviosResponse] = await Promise.all([
      salesController.getVentas(),
      salesController.getClientes(),
      salesController.getCreditos(),
      inventoryController.getProductos(),
      salesController.getEnvios({ limit: 1000 }),
    ]);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const ventasMes = ventas.filter((venta) => {
      if (!venta.fecha) return false;
      const fechaVenta = new Date(venta.fecha);
      if (Number.isNaN(fechaVenta.getTime())) return false;
      return fechaVenta.getMonth() === currentMonth && fechaVenta.getFullYear() === currentYear;
    }).length;

    const ventasContadoEntregadasConEnvio = new Set<number>();
    const ingresosContadoEntregadoDesdeEnvios = (enviosResponse.envios || []).reduce((acc, envio) => {
      const estadoEnvio = String(envio.Estado || '').trim().toLowerCase();
      const tipoVenta = String(envio.venta?.tipoVenta || '').trim().toLowerCase();
      if (estadoEnvio !== 'entregada' || tipoVenta !== 'contado') return acc;

      const ventaId = Number(envio.VentaId);
      if (Number.isFinite(ventaId) && ventaId > 0) {
        ventasContadoEntregadasConEnvio.add(ventaId);
      }

      return acc + Number(envio.venta?.total ?? 0);
    }, 0);

    const ingresosContadoEntregadoSinEnvio = ventas.reduce((acc, venta) => {
      const tipoVenta = String(venta.tipoVenta || '').trim().toLowerCase();
      const estadoVenta = String(venta.estado || '').trim().toLowerCase();
      if (tipoVenta !== 'contado' || estadoVenta !== 'entregada') return acc;

      const ventaId = Number(venta.id);
      if (ventasContadoEntregadasConEnvio.has(ventaId)) return acc;

      return acc + Number(venta.total ?? 0);
    }, 0);

    const ingresosContadoEntregado = ingresosContadoEntregadoDesdeEnvios + ingresosContadoEntregadoSinEnvio;

    // Para créditos solo se considera dinero efectivamente recibido (cuotas pagadas).
    const ingresosCreditosPagados = Number(creditosResponse.stats.montoCobrado ?? 0);
    const totalIngresos = ingresosContadoEntregado + ingresosCreditosPagados;

    const perdidasDevoluciones = ventas.reduce((acc, venta) => {
      if (venta.estado !== 'devuelta') return acc;
      return acc + Number(venta.total ?? 0);
    }, 0);

    const costoInventario = productos.reduce((acc, producto) => {
      const cantidad = Number(producto.cantidad ?? 0);
      const precioCosto = Number(producto.precioCosto ?? 0);
      return acc + cantidad * precioCosto;
    }, 0);

    return {
      ventasMes,
      totalIngresos,
      totalClientes: clientes.length,
      creditosVencidos: Number(creditosResponse.stats.creditosVencidos ?? 0),
      perdidasDevoluciones,
      costoInventario,
      totalVentas: ventas.length,
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
        color: detalle.color ?? null,
        talla: detalle.talla ?? null,
      })),
    }));
  },

  getVentasIds: async (): Promise<number[]> => {
    const data = await fetchWithAuth<{ ids?: number[] }>('/api/ventas/ids');
    return Array.isArray(data?.ids)
      ? data.ids
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0)
      : [];
  },

  getVentasPrintState: async (): Promise<VentasPrintState> => {
    const data = await fetchWithAuth<VentasPrintState>('/api/ventas/impresion/estado');
    return {
      empresa: {
        nombre: String(data?.empresa?.nombre ?? 'Sistema Ventas'),
        nit: String(data?.empresa?.nit ?? ''),
        direccion: String(data?.empresa?.direccion ?? ''),
        telefono: String(data?.empresa?.telefono ?? ''),
        ciudad: String(data?.empresa?.ciudad ?? ''),
      },
      printedVentaIds: Array.isArray(data?.printedVentaIds)
        ? data.printedVentaIds
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0)
        : [],
      printedAudits: Array.isArray(data?.printedAudits)
        ? data.printedAudits
            .map((entry) => ({
              ventaId: Number(entry.ventaId),
              printedAt: entry.printedAt ? new Date(entry.printedAt).toISOString() : null,
              printedByUserId:
                entry.printedByUserId !== null && entry.printedByUserId !== undefined
                  ? Number(entry.printedByUserId)
                  : null,
              printedByUserNombre: entry.printedByUserNombre ? String(entry.printedByUserNombre) : null,
            }))
            .filter((entry) => Number.isInteger(entry.ventaId) && entry.ventaId > 0)
        : [],
    };
  },

  saveVentasPrintCompanyProfile: async (payload: VentasPrintCompanyProfile): Promise<VentasPrintCompanyProfile> => {
    const data = await fetchWithAuth<VentasPrintCompanyProfile>('/api/ventas/impresion/empresa', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return {
      nombre: String(data?.nombre ?? 'Sistema Ventas'),
      nit: String(data?.nit ?? ''),
      direccion: String(data?.direccion ?? ''),
      telefono: String(data?.telefono ?? ''),
      ciudad: String(data?.ciudad ?? ''),
    };
  },

  markVentasAsPrinted: async (ventaIds: number[]): Promise<{ markedIds: number[]; markedAudits: VentaPrintAudit[] }> => {
    const cleanedIds = Array.from(
      new Set(
        (ventaIds || [])
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );

    if (cleanedIds.length === 0) {
      return { markedIds: [], markedAudits: [] };
    }

    const response = await fetchWithAuth<{ markedIds: number[]; markedAudits?: VentaPrintAudit[] }>('/api/ventas/impresion/marcar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ventaIds: cleanedIds }),
    });

    return {
      markedIds: Array.isArray(response?.markedIds)
        ? response.markedIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
        : [],
      markedAudits: Array.isArray(response?.markedAudits)
        ? response.markedAudits
            .map((entry) => ({
              ventaId: Number(entry.ventaId),
              printedAt: entry.printedAt ? new Date(entry.printedAt).toISOString() : null,
              printedByUserId:
                entry.printedByUserId !== null && entry.printedByUserId !== undefined
                  ? Number(entry.printedByUserId)
                  : null,
              printedByUserNombre: entry.printedByUserNombre ? String(entry.printedByUserNombre) : null,
            }))
            .filter((entry) => Number.isInteger(entry.ventaId) && entry.ventaId > 0)
        : [],
    };
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
        color: detalle.color ?? null,
        talla: detalle.talla ?? null,
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
        color: detalle.color ?? null,
        talla: detalle.talla ?? null,
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

  getEnvios: async (params?: { page?: number; limit?: number }): Promise<EnviosResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page && Number.isFinite(params.page) && params.page > 0) {
      queryParams.set('page', String(params.page));
    }
    if (params?.limit && Number.isFinite(params.limit) && params.limit > 0) {
      queryParams.set('limit', String(params.limit));
    }

    const endpoint = queryParams.toString() ? `/api/envios?${queryParams.toString()}` : '/api/envios';
    const data = await fetchWithAuth<EnviosResponse>(endpoint);
    return {
      envios: (data.envios || []).map((envio) => ({
        ...envio,
        id: Number(envio.id),
        VentaId: Number(envio.VentaId),
        FechaEnvio: toIsoStringOrNull(envio.FechaEnvio),
        FechaEntrega: toIsoStringOrNull(envio.FechaEntrega),
        OperadorLogistico: envio.OperadorLogistico ?? null,
        NumeroGuia: envio.NumeroGuia ?? null,
        Observaciones: envio.Observaciones ?? null,
        Ciudad: envio.Ciudad ?? null,
        Departamento: envio.Departamento ?? null,
        Barrio: envio.Barrio ?? null,
        venta: envio.venta
          ? {
              ...envio.venta,
              id: Number(envio.venta.id ?? envio.VentaId),
              numero: Number(envio.venta.numero ?? envio.VentaId),
              usuarioId:
                envio.venta.usuarioId !== null && envio.venta.usuarioId !== undefined
                  ? Number(envio.venta.usuarioId)
                  : undefined,
              fecha: toIsoStringOrNull(envio.venta.fecha),
              total: Number(envio.venta.total ?? 0),
            }
          : undefined,
        cliente: envio.cliente
          ? {
              ...envio.cliente,
              id: Number(envio.cliente.id ?? 0),
              telefono: envio.cliente.telefono ?? null,
              correo: envio.cliente.correo ?? null,
              direccion: envio.cliente.direccion ?? null,
              ciudad: envio.cliente.ciudad ?? null,
              departamento: envio.cliente.departamento ?? null,
              barrio: envio.cliente.barrio ?? null,
            }
          : undefined,
      })),
      pagination: data.pagination || { page: 1, limit: 50, total: 0, pages: 0 }
    };
  },

  getEnviosStats: async (): Promise<EnviosStats> => {
    const data = await fetchWithAuth<EnviosStats>('/api/envios/stats');
    return {
      totalEnvios: Number(data.totalEnvios ?? 0),
      pendientes: Number(data.pendientes ?? 0),
      confirmados: Number(data.confirmados ?? 0),
      enviados: Number(data.enviados ?? 0),
      entregados: Number(data.entregados ?? 0),
      cancelados: Number(data.cancelados ?? 0),
      devueltos: Number(data.devueltos ?? 0)
    };
  },

  createEnvio: async (payload: CreateEnvioPayload): Promise<Envio> => {
    const data = await fetchWithAuth<Envio>('/api/envios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    return data;
  },

  updateEnvio: async (id: number, payload: UpdateEnvioPayload): Promise<Envio> => {
    const data = await fetchWithAuth<Envio>(`/api/envios/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    return data;
  },

  deleteEnvio: async (id: number): Promise<void> => {
    await fetchWithAuth(`/api/envios/${id}`, {
      method: 'DELETE'
    });
  },

  getVentasSinEnvio: async (): Promise<VentasSinEnvioResponse> => {
    const data = await fetchWithAuth<VentasSinEnvioResponse>('/api/ventas/sin-envio');
    return {
      ventas: data.ventas || [],
      pagination: data.pagination || { page: 1, limit: 50, total: 0, pages: 0 }
    };
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

  getUsuarios: async (): Promise<Usuario[]> => {
    const data = await fetchWithAuth<Usuario[]>('/api/usuarios');
    return (data || []).map((usuario) => ({
      ...usuario,
      id: Number(usuario.id),
      telefono: usuario.telefono ?? null,
      fechaCreacion: usuario.fechaCreacion,
      estado: usuario.estado ?? 'activo',
    }));
  },

  getUsuariosMetadata: async (): Promise<UsuariosMetadata> => {
    const data = await fetchWithAuth<UsuariosMetadata>('/api/usuarios/metadata');
    return {
      roles: (data.roles || []).map((role) => String(role).trim()).filter(Boolean),
      estados: (data.estados || []).map((estado) => String(estado).trim()).filter(Boolean),
    };
  },

  createUsuario: async (payload: CreateUsuarioPayload): Promise<Usuario> => {
    const data = await fetchWithAuth<Usuario>('/api/usuarios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return {
      ...data,
      id: Number(data.id),
      telefono: data.telefono ?? null,
      estado: data.estado ?? 'activo',
    };
  },

  updateUsuario: async (id: number, payload: UpdateUsuarioPayload): Promise<Usuario> => {
    const data = await fetchWithAuth<Usuario>(`/api/usuarios/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return {
      ...data,
      id: Number(data.id),
      telefono: data.telefono ?? null,
      estado: data.estado ?? 'activo',
    };
  },

  deleteUsuario: async (id: number): Promise<{ deleted: boolean }> => {
    return fetchWithAuth<{ deleted: boolean }>(`/api/usuarios/${id}`, {
      method: 'DELETE',
    });
  },
};
