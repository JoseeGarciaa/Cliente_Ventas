import { Cliente, Producto, Venta, Envio, Credito, Pago, Usuario } from '../models/types';

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

  getClientes: (): Cliente[] => {
    return [];
  },

  getProductos: (): Producto[] => {
    return [];
  },

  getVentas: (): Venta[] => {
    return [];
  },

  getEnvios: (): Envio[] => {
    return [];
  },

  getCreditos: (): Credito[] => {
    return [];
  },

  getPagos: (): Pago[] => {
    return [];
  },

  getUsuarios: (): Usuario[] => {
    return [];
  },
};
