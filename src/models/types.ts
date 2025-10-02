export interface Cliente {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  created_at: string;
}

export interface Producto {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
  categoria: string;
  imagen?: string;
  created_at: string;
}

export interface Venta {
  id: string;
  cliente_id: string;
  fecha: string;
  total: number;
  estado: 'pendiente' | 'completada' | 'cancelada';
  metodo_pago: string;
  created_at: string;
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

export interface Credito {
  id: string;
  cliente_id: string;
  monto_total: number;
  monto_pagado: number;
  monto_pendiente: number;
  fecha_vencimiento: string;
  estado: 'activo' | 'vencido' | 'pagado';
  created_at: string;
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
