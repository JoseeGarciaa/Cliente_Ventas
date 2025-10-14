import {
  Categoria,
  CreateCategoriaPayload,
  Producto,
  CreateProductoPayload,
  UpdateProductoPayload,
  InventarioMetadata,
  TipoCategoria,
  EstadoProducto,
} from '../models/types';
import { fetchWithAuth } from '../lib/api';

const DEFAULT_TIPOS_CATEGORIA: TipoCategoria[] = ['producto', 'servicio', 'otro'];
const DEFAULT_ESTADOS_PRODUCTO: EstadoProducto[] = ['activo', 'inactivo', 'agotado'];

function parseNumberValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function uniqueValues<T extends string>(values: T[] | undefined, fallback: T[]): T[] {
  if (!values || values.length === 0) return [...fallback];
  return Array.from(new Set(values)) as T[];
}

export const inventoryController = {
  async getMetadata(): Promise<InventarioMetadata> {
    const data = await fetchWithAuth<InventarioMetadata>('/api/inventario/metadata');
    return {
      tiposCategoria: uniqueValues<TipoCategoria>(data.tiposCategoria, DEFAULT_TIPOS_CATEGORIA),
      estadosProducto: uniqueValues<EstadoProducto>(data.estadosProducto, DEFAULT_ESTADOS_PRODUCTO),
    };
  },

  async getCategorias(): Promise<Categoria[]> {
    const data = await fetchWithAuth<Categoria[]>('/api/inventario/categorias');
    return data.map((categoria) => ({
      ...categoria,
      descripcion: categoria.descripcion ?? null,
      productosCount: Number(categoria.productosCount ?? 0),
    }));
  },

  async createCategoria(payload: CreateCategoriaPayload): Promise<Categoria> {
    const body = JSON.stringify(payload);
    const categoria = await fetchWithAuth<Categoria>('/api/inventario/categorias', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });
    return {
      ...categoria,
      descripcion: categoria.descripcion ?? null,
      productosCount: Number(categoria.productosCount ?? 0),
    };
  },

  async getProductos(): Promise<Producto[]> {
    const data = await fetchWithAuth<Producto[]>('/api/inventario/productos');
    return data.map((producto) => ({
      ...producto,
      descripcion: producto.descripcion ?? null,
      categoriaNombre: producto.categoriaNombre ?? '',
      precioCosto: parseNumberValue(producto.precioCosto) ?? 0,
      precioCredito: parseNumberValue(producto.precioCredito) ?? 0,
      cuotaInicial: parseNumberValue(producto.cuotaInicial),
      precioVentaContado: parseNumberValue(producto.precioVentaContado),
      cantidad: parseNumberValue(producto.cantidad),
      costoDevolucion: parseNumberValue(producto.costoDevolucion),
      imagenUrl: producto.imagenUrl ?? null,
      marca: producto.marca ?? null,
      modelo: producto.modelo ?? null,
    }));
  },

  async createProducto(payload: CreateProductoPayload): Promise<Producto> {
    const body = JSON.stringify(payload);
    const producto = await fetchWithAuth<Producto>('/api/inventario/productos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });
    return {
      ...producto,
      descripcion: producto.descripcion ?? null,
      categoriaNombre: producto.categoriaNombre ?? '',
      precioCosto: parseNumberValue(producto.precioCosto) ?? 0,
      precioCredito: parseNumberValue(producto.precioCredito) ?? 0,
      cuotaInicial: parseNumberValue(producto.cuotaInicial),
      precioVentaContado: parseNumberValue(producto.precioVentaContado),
      cantidad: parseNumberValue(producto.cantidad),
      costoDevolucion: parseNumberValue(producto.costoDevolucion),
      imagenUrl: producto.imagenUrl ?? null,
      marca: producto.marca ?? null,
      modelo: producto.modelo ?? null,
    };
  },

  async updateProducto(productoId: number, payload: UpdateProductoPayload): Promise<Producto> {
    const body = JSON.stringify(payload);
    const producto = await fetchWithAuth<Producto>(`/api/inventario/productos/${productoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    return {
      ...producto,
      descripcion: producto.descripcion ?? null,
      categoriaNombre: producto.categoriaNombre ?? '',
      precioCosto: parseNumberValue(producto.precioCosto) ?? 0,
      precioCredito: parseNumberValue(producto.precioCredito) ?? 0,
      cuotaInicial: parseNumberValue(producto.cuotaInicial),
      precioVentaContado: parseNumberValue(producto.precioVentaContado),
      cantidad: parseNumberValue(producto.cantidad),
      costoDevolucion: parseNumberValue(producto.costoDevolucion),
      imagenUrl: producto.imagenUrl ?? null,
      marca: producto.marca ?? null,
      modelo: producto.modelo ?? null,
    };
  },

  async deleteProducto(productoId: number): Promise<{ deleted: boolean }> {
    return fetchWithAuth<{ deleted: boolean }>(`/api/inventario/productos/${productoId}`, {
      method: 'DELETE',
    });
  },
};
