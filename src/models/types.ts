export type TipoIdentificacion = 'CC' | 'CE' | 'NIT' | 'TI' | 'PASAPORTE' | 'PPT';
export type CalificacionCliente = 'Pendiente' | 'Positivo' | 'Negativo' | 'Hurto';
export type ModoChat = 'modo robot' | 'modo humano';
export type TipoCategoria = string;
export type EstadoProducto = 'activo' | 'inactivo' | 'agotado' | string;
export type TipoVenta = 'contado' | 'credito' | string;
export type TipoCredito = 'diario' | 'semanal' | 'quincenal' | 'mensual' | string;
export type MedioPago =
  | 'efectivo'
  | 'transferencia'
  | 'tarjeta_credito'
  | 'tarjeta_debito'
  | 'consignacion'
  | 'bancolombia'
  | 'nequi'
  | 'daviplata'
  | 'codigo_qr'
  | 'contraentrega'
  | string;
export type EstadoVenta =
  | 'pendiente'
  | 'confirmada'
  | 'enviada'
  | 'entregada'
  | 'cancelada'
  | 'devuelta'
  | 'completada'
  | string;
export type EstadoCredito = 'activo' | 'pagado' | 'cancelado' | 'mora' | string;
export type EstadoCuotaCredito = 'pendiente' | 'pagada' | 'vencida' | string;

export interface Cliente {
  id: number;
  nombres: string;
  apellidos: string;
  tipoIdentificacion: TipoIdentificacion;
  numeroDocumento: string;
  telefono: string | null;
  direccion: string | null;
  correo: string | null;
  fechaRegistro: string | null;
  ciudad: string | null;
  departamento: string | null;
  calificacion: CalificacionCliente | null;
  barrio: string | null;
  modoChat: ModoChat | null;
}

export interface CreateClientePayload {
  nombres: string;
  apellidos: string;
  tipoIdentificacion: TipoIdentificacion;
  numeroDocumento: string;
  telefono?: string;
  direccion?: string;
  correo?: string;
  fechaRegistro?: string;
  ciudad?: string;
  departamento?: string;
  calificacion?: CalificacionCliente;
  barrio?: string;
  modoChat?: ModoChat;
}

export interface UpdateClientePayload {
  nombres: string;
  apellidos: string;
  tipoIdentificacion: TipoIdentificacion;
  numeroDocumento: string;
  telefono?: string | null;
  direccion?: string | null;
  correo?: string | null;
  fechaRegistro?: string | null;
  ciudad?: string | null;
  departamento?: string | null;
  calificacion?: CalificacionCliente | null;
  barrio?: string | null;
  modoChat?: ModoChat | null;
}

export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  tipoCategoria: TipoCategoria;
  productosCount: number;
}

export interface CreateCategoriaPayload {
  nombre: string;
  descripcion?: string;
  tipoCategoria: TipoCategoria;
}

export interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  categoriaId: number;
  categoriaNombre: string;
  precioCosto: number;
  precioCredito: number;
  cuotaInicial: number | null;
  precioVentaContado: number | null;
  cantidad: number | null;
  costoDevolucion: number | null;
  imagenUrl: string | null;
  estado: EstadoProducto;
  marca: string | null;
  modelo: string | null;
  fechaCreacion: string;
}

export interface CreateProductoPayload {
  nombre: string;
  descripcion?: string;
  categoriaId: number;
  precioCosto: number;
  precioCredito: number;
  cuotaInicial?: number;
  imagenUrl?: string;
  estado?: EstadoProducto;
  marca?: string;
  modelo?: string;
  cantidad?: number;
  costoDevolucion?: number;
  precioVentaContado?: number;
}

export interface UpdateProductoPayload {
  nombre: string;
  descripcion?: string | null;
  categoriaId: number;
  precioCosto: number;
  precioCredito: number;
  cuotaInicial?: number | null;
  imagenUrl?: string | null;
  estado?: EstadoProducto | null;
  marca?: string | null;
  modelo?: string | null;
  cantidad?: number | null;
  costoDevolucion?: number | null;
  precioVentaContado?: number | null;
}

export interface InventarioMetadata {
  tiposCategoria: TipoCategoria[];
  estadosProducto: EstadoProducto[];
}

export interface VentaDetalle {
  id: number;
  productoId: number;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  imei: string | null;
}

export interface Venta {
  id: number;
  clienteId: number;
  clienteNombre: string;
  usuarioId: number;
  usuarioNombre: string;
  fecha: string;
  tipoVenta: TipoVenta;
  medioPago: MedioPago;
  total: number;
  descuento: number;
  estado: EstadoVenta;
  calificacion: CalificacionCliente | null;
  detalles: VentaDetalle[];
}

export interface CreateVentaDetalle {
  productoId: number;
  cantidad: number;
  precioUnitario: number;
  imei?: string;
}

export interface CreateCreditoPayload {
  tipoCredito: TipoCredito;
  numeroCuotas: number;
  cuotaInicial?: number;
  fechaPrimerPago?: string;
}

export interface CreateVentaPayload {
  clienteId: number;
  medioPago: MedioPago;
  tipoVenta?: TipoVenta;
  fecha?: string;
  descuento?: number;
  detalles: CreateVentaDetalle[];
  credito?: CreateCreditoPayload;
}

export type CreateVentaContadoPayload = CreateVentaPayload;

export interface VentasMetadata {
  tiposVenta: TipoVenta[];
  mediosPago: MedioPago[];
  estados: EstadoVenta[];
  tiposCredito: TipoCredito[];
  estadosCredito: EstadoCredito[];
  estadosCuotaCredito: EstadoCuotaCredito[];
  calificacionesCredito: CalificacionCliente[];
}

export interface UpdateVentaPayload {
  estado?: EstadoVenta;
  medioPago?: MedioPago;
  calificacion?: CalificacionCliente | null;
}

export interface Envio {
  id: string;
  venta_id: string;
  direccion: string;
  ciudad: string;
  estado: 'preparando' | 'en_camino' | 'entregado';
  fecha_estimada: string;
  created_at: string;
}

export interface CuotaCredito {
  id: number;
  numeroCuota: number;
  fechaVencimiento: string | null;
  valor: number;
  valorPagado: number;
  estado: EstadoCuotaCredito;
  fechaPago: string | null;
}

export interface Credito {
  id: number;
  ventaId: number;
  clienteId: number;
  clienteNombre: string;
  tipoCredito: TipoCredito;
  numeroCuotas: number;
  cuotaInicial: number;
  valorCuota: number;
  saldoTotal: number;
  estado: EstadoCredito;
  calificacion: CalificacionCliente | null;
  fechaPrimerPago: string | null;
  fechaInicio: string | null;
  fechaVencimiento: string | null;
  montoOriginal: number;
  montoPagado: number;
  montoPendiente: number;
  cuotas: CuotaCredito[];
  proximaCuota: CuotaCredito | null;
  totalVenta: number;
}

export interface CreditosStats {
  totalCreditos: number;
  montoOtorgado: number;
  montoCobrado: number;
  montoPendiente: number;
  creditosVencidos: number;
}

export interface CreditosResponse {
  stats: CreditosStats;
  creditos: Credito[];
}

export interface RegistrarPagoCreditoPayload {
  monto: number;
  fechaPago?: string;
}

export interface Pago {
  id: string;
  credito_id: string;
  monto: number;
  fecha: string;
  metodo: string;
  referencia: string;
  created_at: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: 'admin' | 'vendedor' | 'almacen';
  activo: boolean;
  created_at: string;
}
