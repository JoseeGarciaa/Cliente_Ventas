import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  CreditCard as Edit,
  Trash2,
  Package,
  AlertTriangle,
  TrendingUp,
  Layers,
  Loader2,
  X,
  Tag,
} from 'lucide-react';
import { inventoryController } from '../controllers/inventoryController';
import {
  Categoria,
  EstadoProducto,
  InventarioMetadata,
  Producto,
  TipoCategoria,
  UpdateProductoPayload,
} from '../models/types';

type ProductFormState = {
  nombre: string;
  descripcion: string;
  categoriaId: string;
  precioCosto: string;
  precioCredito: string;
  cuotaInicial: string;
  precioVentaContado: string;
  costoDevolucion: string;
  cantidad: string;
  imagenUrl: string;
  marca: string;
  modelo: string;
  estado: string;
};

type CategoryFormState = {
  nombre: string;
  descripcion: string;
  tipoCategoria: string;
};

const initialProductForm: ProductFormState = {
  nombre: '',
  descripcion: '',
  categoriaId: '',
  precioCosto: '',
  precioCredito: '',
  cuotaInicial: '',
  precioVentaContado: '',
  costoDevolucion: '',
  cantidad: '',
  imagenUrl: '',
  marca: '',
  modelo: '',
  estado: '',
};

const initialCategoryForm: CategoryFormState = {
  nombre: '',
  descripcion: '',
  tipoCategoria: '',
};

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

type Feedback = {
  type: 'success' | 'error';
  message: string;
};

export default function Inventario() {
  const [metadata, setMetadata] = useState<InventarioMetadata>({ tiposCategoria: [], estadosProducto: [] });
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('');

  const [showProductoModal, setShowProductoModal] = useState(false);
  const [showCategoriaModal, setShowCategoriaModal] = useState(false);
  const [productoForm, setProductoForm] = useState<ProductFormState>(initialProductForm);
  const [categoriaForm, setCategoriaForm] = useState<CategoryFormState>(initialCategoryForm);
  const [productoError, setProductoError] = useState<string | null>(null);
  const [categoriaError, setCategoriaError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null);
  const [pageFeedback, setPageFeedback] = useState<Feedback | null>(null);

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
        const [meta, fetchedCategorias, fetchedProductos] = await Promise.all([
          inventoryController.getMetadata(),
          inventoryController.getCategorias(),
          inventoryController.getProductos(),
        ]);
        if (!active) return;
        setMetadata(meta);
        setCategorias(fetchedCategorias);
        setProductos(fetchedProductos);
        setError(null);
      } catch (e) {
        console.error(e);
        if (!active) return;
        setError(e instanceof Error ? e.message : 'No se pudo cargar el inventario');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const filteredProductos = useMemo(() => {
    const term = search.trim().toLowerCase();
    return productos.filter((producto) => {
      const matchesSearch = term
        ? [
            producto.nombre,
            producto.descripcion ?? '',
            producto.categoriaNombre,
            producto.marca ?? '',
            producto.modelo ?? '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(term)
        : true;
      const matchesCategory = categoriaFiltro ? String(producto.categoriaId) === categoriaFiltro : true;
      return matchesSearch && matchesCategory;
    });
  }, [productos, search, categoriaFiltro]);

  const stats = useMemo(() => {
    const totalProductos = productos.length;
    const valorTotal = productos.reduce((acc, producto) => acc + Number(producto.precioCredito || 0), 0);
    const stockBajo = productos.filter((producto) => {
      if (producto.cantidad === null || producto.cantidad === undefined) return false;
      return producto.cantidad > 0 && producto.cantidad <= 5;
    }).length;
    const sinStock = productos.filter((producto) => (producto.cantidad ?? 0) === 0).length;
    return { totalProductos, valorTotal, stockBajo, sinStock };
  }, [productos]);

  const openProductoModal = () => {
    setEditingProducto(null);
    setProductoForm({ ...initialProductForm, estado: metadata.estadosProducto[0] ?? '' });
    setProductoError(null);
    setShowProductoModal(true);
  };

  const openProductoEditModal = (producto: Producto) => {
    setEditingProducto(producto);
    setProductoForm({
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      categoriaId: String(producto.categoriaId ?? ''),
      precioCosto: producto.precioCosto !== undefined ? String(producto.precioCosto) : '',
      precioCredito: producto.precioCredito !== undefined ? String(producto.precioCredito) : '',
      cuotaInicial: producto.cuotaInicial !== null && producto.cuotaInicial !== undefined ? String(producto.cuotaInicial) : '',
      precioVentaContado:
        producto.precioVentaContado !== null && producto.precioVentaContado !== undefined
          ? String(producto.precioVentaContado)
          : '',
      costoDevolucion:
        producto.costoDevolucion !== null && producto.costoDevolucion !== undefined
          ? String(producto.costoDevolucion)
          : '',
      cantidad: producto.cantidad !== null && producto.cantidad !== undefined ? String(producto.cantidad) : '',
      imagenUrl: producto.imagenUrl ?? '',
      marca: producto.marca ?? '',
      modelo: producto.modelo ?? '',
      estado: producto.estado ?? '',
    });
    setProductoError(null);
    setShowProductoModal(true);
  };

  const closeProductoModal = () => {
    if (submitLoading) return;
    setShowProductoModal(false);
    setEditingProducto(null);
    setProductoError(null);
    setProductoForm(initialProductForm);
  };

  const openCategoriaModal = () => {
    setCategoriaForm({
      nombre: '',
      descripcion: '',
      tipoCategoria: metadata.tiposCategoria[0] ?? '',
    });
    setCategoriaError(null);
    setShowCategoriaModal(true);
  };

  const reloadInventario = async () => {
    try {
      setLoading(true);
      const [fetchedCategorias, fetchedProductos] = await Promise.all([
        inventoryController.getCategorias(),
        inventoryController.getProductos(),
      ]);
      setCategorias(fetchedCategorias);
      setProductos(fetchedProductos);
      setError(null);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudo cargar el inventario');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategoria = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCategoriaError(null);

    if (!categoriaForm.nombre.trim() || !categoriaForm.tipoCategoria) {
      setCategoriaError('Nombre y tipo de categoría son obligatorios');
      return;
    }

    setSubmitLoading(true);
    try {
      const payload = {
        nombre: categoriaForm.nombre.trim(),
        descripcion: categoriaForm.descripcion.trim() || undefined,
        tipoCategoria: categoriaForm.tipoCategoria as TipoCategoria,
      };
      const created = await inventoryController.createCategoria(payload);
      setCategorias((prev) => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setShowCategoriaModal(false);
    } catch (e) {
      console.error(e);
      setCategoriaError(e instanceof Error ? e.message : 'No se pudo crear la categoría');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSubmitProducto = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProductoError(null);

    if (!productoForm.nombre.trim() || !productoForm.categoriaId || !productoForm.precioCosto || !productoForm.precioCredito) {
      setProductoError('Nombre, categoría y precios son obligatorios');
      return;
    }

    setSubmitLoading(true);
    try {
      const toUndefined = (value: string) => {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      };

      const toNull = (value: string) => {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
      };

      const toNumberUndefined = (value: string) => {
        const trimmed = value.trim();
        return trimmed.length > 0 ? Number(trimmed) : undefined;
      };

      const toNumberNull = (value: string) => {
        const trimmed = value.trim();
        return trimmed.length > 0 ? Number(trimmed) : null;
      };

      if (editingProducto) {
        const updatePayload: UpdateProductoPayload = {
          nombre: productoForm.nombre.trim(),
          descripcion: toNull(productoForm.descripcion) ?? null,
          categoriaId: Number(productoForm.categoriaId),
          precioCosto: Number(productoForm.precioCosto),
          precioCredito: Number(productoForm.precioCredito),
          cuotaInicial: toNumberNull(productoForm.cuotaInicial) ?? null,
          costoDevolucion: toNumberNull(productoForm.costoDevolucion) ?? null,
          precioVentaContado: toNumberNull(productoForm.precioVentaContado) ?? null,
          cantidad: toNumberNull(productoForm.cantidad) ?? null,
          imagenUrl: toNull(productoForm.imagenUrl),
          marca: toNull(productoForm.marca),
          modelo: toNull(productoForm.modelo),
          estado: productoForm.estado ? (productoForm.estado as EstadoProducto) : null,
        };

        const updated = await inventoryController.updateProducto(editingProducto.id, updatePayload);
        setProductos((prev) => prev.map((producto) => (producto.id === updated.id ? updated : producto)));
        setPageFeedback({ type: 'success', message: 'Producto actualizado correctamente.' });
      } else {
        const createPayload = {
          nombre: productoForm.nombre.trim(),
          descripcion: toUndefined(productoForm.descripcion),
          categoriaId: Number(productoForm.categoriaId),
          precioCosto: Number(productoForm.precioCosto),
          precioCredito: Number(productoForm.precioCredito),
          cuotaInicial: toNumberUndefined(productoForm.cuotaInicial),
          costoDevolucion: toNumberUndefined(productoForm.costoDevolucion),
          precioVentaContado: toNumberUndefined(productoForm.precioVentaContado),
          cantidad: toNumberUndefined(productoForm.cantidad),
          imagenUrl: toUndefined(productoForm.imagenUrl),
          marca: toUndefined(productoForm.marca),
          modelo: toUndefined(productoForm.modelo),
          estado: productoForm.estado ? (productoForm.estado as EstadoProducto) : undefined,
        };

        const created = await inventoryController.createProducto(createPayload);
        setProductos((prev) => [created, ...prev]);
        setPageFeedback({ type: 'success', message: 'Producto creado correctamente.' });
      }

      closeProductoModal();
    } catch (e) {
      console.error(e);
      setProductoError(e instanceof Error ? e.message : 'No se pudo guardar el producto');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteProducto = async (producto: Producto) => {
    const confirmed = window.confirm(`¿Eliminar el producto ${producto.nombre}?`);
    if (!confirmed) return;

    setDeleteLoadingId(producto.id);
    try {
      await inventoryController.deleteProducto(producto.id);
      setProductos((prev) => prev.filter((item) => item.id !== producto.id));
      setPageFeedback({ type: 'success', message: 'Producto eliminado correctamente.' });
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'No se pudo eliminar el producto';
      setPageFeedback({ type: 'error', message });
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const vacio = !loading && filteredProductos.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Control de Inventario</h3>
          <p className="text-gray-600 text-sm mt-1">Gestiona tus productos y existencias</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            onClick={openCategoriaModal}
          >
            <Layers className="w-4 h-4" />
            <span>Nueva Categoría</span>
          </button>
          <button
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            onClick={openProductoModal}
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Producto</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto por nombre, categoría o marca..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={categoriaFiltro}
            onChange={(event) => setCategoriaFiltro(event.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </select>
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
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm mb-1">Total Productos</p>
          <p className="text-3xl font-bold text-gray-900">{stats.totalProductos}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm mb-1">Valor Total (crédito)</p>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.valorTotal)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-500">
          <p className="text-gray-600 text-sm mb-1">Stock Bajo</p>
          <p className="text-3xl font-bold text-gray-900">{stats.stockBajo}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm mb-1">Sin Stock</p>
          <p className="text-3xl font-bold text-gray-900">{stats.sinStock}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="font-medium">Cargando inventario...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <p className="text-red-600 font-medium">{error}</p>
            <button
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              onClick={reloadInventario}
            >
              Reintentar
            </button>
          </div>
        ) : vacio ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No hay productos en inventario</p>
            <p className="text-gray-400 text-sm">Agrega tu primer producto para comenzar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
            {filteredProductos.map((producto) => (
              <div
                key={producto.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="h-36 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                  {producto.imagenUrl ? (
                    <img src={producto.imagenUrl} alt={producto.nombre} className="h-full w-full object-cover" />
                  ) : (
                    <Package className="w-14 h-14 text-blue-600" />
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 line-clamp-2">{producto.nombre}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {producto.marca ? `${producto.marca}${producto.modelo ? ` · ${producto.modelo}` : ''}` : producto.modelo ?? 'Sin marca'}
                      </p>
                    </div>
                    {producto.cantidad !== null && producto.cantidad <= 5 ? (
                      <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    ) : null}
                  </div>

                  {producto.descripcion ? (
                    <p className="text-sm text-gray-600 line-clamp-2">{producto.descripcion}</p>
                  ) : null}

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                      <Tag className="w-3 h-3" />
                      {producto.categoriaNombre}
                    </span>
                    <span
                      className={`font-semibold ${
                        producto.cantidad && producto.cantidad > 0 ? 'text-green-600' : 'text-red-500'
                      }`}
                    >
                      Stock: {producto.cantidad ?? 0}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>
                      <p className="uppercase text-xs tracking-wide text-gray-400">Precio Crédito</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(producto.precioCredito)}</p>
                    </div>
                    <div>
                      <p className="uppercase text-xs tracking-wide text-gray-400">Precio Contado</p>
                      <p className="font-semibold text-gray-900">
                        {producto.precioVentaContado ? formatCurrency(producto.precioVentaContado) : 'N/D'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-xs font-medium text-gray-500">
                      Estado: <span className="capitalize text-gray-900">{producto.estado}</span>
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                        onClick={() => openProductoEditModal(producto)}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Eliminar"
                        onClick={() => handleDeleteProducto(producto)}
                        disabled={deleteLoadingId === producto.id}
                      >
                        {deleteLoadingId === producto.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-sm p-6 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-1">Productos más vendidos</h4>
            <p className="text-gray-600 text-sm">Revisa el rendimiento de tu inventario</p>
          </div>
          <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-blue-700" />
          </div>
        </div>
      </div>

      {showProductoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingProducto ? 'Editar Producto' : 'Nuevo Producto'}
                </h3>
                <p className="text-sm text-gray-500">
                  {editingProducto
                    ? 'Actualiza la información del producto seleccionado'
                    : 'Registra un nuevo producto en tu inventario'}
                </p>
              </div>
              <button className="p-2 rounded-full hover:bg-gray-100 text-gray-500" onClick={closeProductoModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitProducto} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {productoError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    {productoError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Nombre *</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      value={productoForm.nombre}
                      onChange={(event) => setProductoForm((prev) => ({ ...prev, nombre: event.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Categoría *</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      value={productoForm.categoriaId}
                      onChange={(event) => setProductoForm((prev) => ({ ...prev, categoriaId: event.target.value }))}
                      required
                    >
                      <option value="" disabled>
                        Selecciona una categoría
                      </option>
                      {categorias.map((categoria) => (
                        <option key={categoria.id} value={categoria.id}>
                          {categoria.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Descripción</label>
                    <textarea
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      rows={3}
                      value={productoForm.descripcion}
                      onChange={(event) => setProductoForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Precio costo *</label>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      value={productoForm.precioCosto}
                      onChange={(event) => setProductoForm((prev) => ({ ...prev, precioCosto: event.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Precio crédito *</label>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      value={productoForm.precioCredito}
                      onChange={(event) => setProductoForm((prev) => ({ ...prev, precioCredito: event.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Precio contado</label>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      value={productoForm.precioVentaContado}
                      onChange={(event) =>
                        setProductoForm((prev) => ({ ...prev, precioVentaContado: event.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Cuota inicial</label>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      value={productoForm.cuotaInicial}
                      onChange={(event) => setProductoForm((prev) => ({ ...prev, cuotaInicial: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Costo devolución</label>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      value={productoForm.costoDevolucion}
                      onChange={(event) =>
                        setProductoForm((prev) => ({ ...prev, costoDevolucion: event.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Cantidad</label>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      value={productoForm.cantidad}
                      onChange={(event) => setProductoForm((prev) => ({ ...prev, cantidad: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Marca</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      value={productoForm.marca}
                      onChange={(event) => setProductoForm((prev) => ({ ...prev, marca: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Modelo</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      value={productoForm.modelo}
                      onChange={(event) => setProductoForm((prev) => ({ ...prev, modelo: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Imagen URL</label>
                    <input
                      type="url"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      value={productoForm.imagenUrl}
                      onChange={(event) => setProductoForm((prev) => ({ ...prev, imagenUrl: event.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Estado</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 capitalize"
                      value={productoForm.estado}
                      onChange={(event) => setProductoForm((prev) => ({ ...prev, estado: event.target.value }))}
                    >
                      <option value="">Selecciona un estado</option>
                      {metadata.estadosProducto.map((estado) => (
                        <option key={estado} value={estado}>
                          {estado}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="w-full md:w-auto px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                      onClick={openCategoriaModal}
                    >
                      Nueva categoría
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t bg-white">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                  onClick={closeProductoModal}
                  disabled={submitLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : editingProducto ? (
                    'Actualizar Producto'
                  ) : (
                    'Guardar Producto'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategoriaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Nueva Categoría</h3>
                <p className="text-sm text-gray-500">Clasifica tus productos para organizarlos mejor</p>
              </div>
              <button className="p-2 rounded-full hover:bg-gray-100 text-gray-500" onClick={() => setShowCategoriaModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategoria} className="px-6 py-6 space-y-6">
              {categoriaError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {categoriaError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Nombre *</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                    value={categoriaForm.nombre}
                    onChange={(event) => setCategoriaForm((prev) => ({ ...prev, nombre: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Tipo *</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                    value={categoriaForm.tipoCategoria}
                    onChange={(event) => setCategoriaForm((prev) => ({ ...prev, tipoCategoria: event.target.value }))}
                    required
                  >
                    <option value="" disabled>
                      Selecciona el tipo
                    </option>
                    {metadata.tiposCategoria.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Descripción</label>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                    rows={3}
                    value={categoriaForm.descripcion}
                    onChange={(event) => setCategoriaForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                  onClick={() => setShowCategoriaModal(false)}
                  disabled={submitLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-60"
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    'Guardar Categoría'
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
