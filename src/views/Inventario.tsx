import { useEffect, useMemo, useRef, useState } from 'react';
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
  imagenes: Array<{ nombreArchivo: string; url: string }>;
  marca: string;
  modelo: string;
  estado: string;
  colores: Array<{ nombre: string; cantidad: string }>;
  tallas: Array<{ nombre: string; cantidad: string }>;
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
  imagenes: [],
  marca: '',
  modelo: '',
  estado: '',
  colores: [{ nombre: '', cantidad: '' }],
  tallas: [{ nombre: '', cantidad: '' }],
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

const MAX_IMAGE_FILE_SIZE_MB = 3;
const MAX_IMAGE_FILE_SIZE_BYTES = MAX_IMAGE_FILE_SIZE_MB * 1024 * 1024;
const NORMALIZED_IMAGE_TYPE = 'image/webp';
const NORMALIZED_IMAGE_QUALITY = 0.82;
const NORMALIZED_IMAGE_MAX_SIDE = 1200;

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

type Feedback = {
  type: 'success' | 'error';
  message: string;
};

interface InventarioProps {
  user?: any;
}

export default function Inventario({ user }: InventarioProps) {
  type StockFilterMode = 'all' | 'low' | 'out';
  const canViewPrices = String(user?.rol || '').toLowerCase() !== 'vendedor';

  const [metadata, setMetadata] = useState<InventarioMetadata>({ tiposCategoria: [], estadosProducto: [] });
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('');
  const [stockFiltro, setStockFiltro] = useState<StockFilterMode>('all');

  const [showProductoModal, setShowProductoModal] = useState(false);
  const [showCategoriaModal, setShowCategoriaModal] = useState(false);
  const [productoForm, setProductoForm] = useState<ProductFormState>(initialProductForm);
  const [categoriaForm, setCategoriaForm] = useState<CategoryFormState>(initialCategoryForm);
  const [productoError, setProductoError] = useState<string | null>(null);
  const [categoriaError, setCategoriaError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
  const [editLoadingId, setEditLoadingId] = useState<number | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null);
  const [pageFeedback, setPageFeedback] = useState<Feedback | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);

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
    const STOCK_BAJO_LIMITE = 24;
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

      const cantidadRaw = Number(producto.cantidad ?? 0);
      const cantidad = Number.isFinite(cantidadRaw) ? Math.max(0, Math.floor(cantidadRaw)) : 0;

      const matchesStockFilter =
        stockFiltro === 'all'
          ? true
          : stockFiltro === 'low'
            ? cantidad > 0 && cantidad < STOCK_BAJO_LIMITE
            : cantidad === 0;

      return matchesSearch && matchesCategory && matchesStockFilter;
    });
  }, [productos, search, categoriaFiltro, stockFiltro]);

  const stats = useMemo(() => {
    const LIMITE_STOCK_BAJO = 24;

    const modelKeys = new Set<string>();
    let totalPrendas = 0;
    let valorInventarioCompra = 0;
    let valorInventarioCredito = 0;
    let modelosBajoStock = 0;
    let modelosSinStock = 0;
    let modelosConStock = 0;

    for (const producto of productos) {
      const cantidadRaw = Number(producto.cantidad ?? 0);
      const cantidad = Number.isFinite(cantidadRaw) ? Math.max(0, Math.floor(cantidadRaw)) : 0;
      const precioCosto = Number(producto.precioCosto ?? 0);
      const precioCredito = Number(producto.precioCredito ?? 0);

      const keyModelo = [producto.marca ?? '', producto.modelo ?? producto.nombre]
        .join('::')
        .trim()
        .toLowerCase();
      modelKeys.add(keyModelo);

      totalPrendas += cantidad;
      valorInventarioCompra += cantidad * (Number.isFinite(precioCosto) ? precioCosto : 0);
      valorInventarioCredito += cantidad * (Number.isFinite(precioCredito) ? precioCredito : 0);

      if (cantidad === 0) {
        modelosSinStock += 1;
      } else {
        modelosConStock += 1;
      }

      if (cantidad > 0 && cantidad < LIMITE_STOCK_BAJO) {
        modelosBajoStock += 1;
      }
    }

    const totalModelos = modelKeys.size;
    const promedioPrendasPorModelo = totalModelos > 0 ? totalPrendas / totalModelos : 0;

    return {
      totalPrendas,
      totalModelos,
      valorInventarioCompra,
      valorInventarioCredito,
      modelosBajoStock,
      modelosSinStock,
      modelosConStock,
      promedioPrendasPorModelo,
      limiteStockBajo: LIMITE_STOCK_BAJO,
    };
  }, [productos]);

  const normalizeStockRows = (rows: Array<{ nombre: string; cantidad: string }>) => {
    const seen = new Set<string>();
    const normalized: Array<{ nombre: string; cantidad: number }> = [];
    for (const row of rows) {
      const nombre = row.nombre.trim();
      if (!nombre) continue;
      const key = nombre.toLowerCase();
      if (seen.has(key)) continue;
      const cantidadRaw = Number(row.cantidad || 0);
      const cantidad = Number.isFinite(cantidadRaw) ? Math.max(0, Math.floor(cantidadRaw)) : 0;
      normalized.push({ nombre, cantidad });
      seen.add(key);
    }
    return normalized;
  };

  const parsePreviewCantidad = (value: string) => {
    const normalized = String(value ?? '').replace(',', '.').trim();
    if (!normalized) return 0;
    const num = Number(normalized);
    return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 0;
  };

  const totalColoresForm = useMemo(
    () => productoForm.colores.reduce((acc, item) => acc + parsePreviewCantidad(item.cantidad), 0),
    [productoForm.colores]
  );

  const totalTallasForm = useMemo(
    () => productoForm.tallas.reduce((acc, item) => acc + parsePreviewCantidad(item.cantidad), 0),
    [productoForm.tallas]
  );

  const totalsMatch = totalColoresForm === totalTallasForm && totalColoresForm > 0;

  const openProductoModal = () => {
    if (!canViewPrices) {
      setPageFeedback({ type: 'error', message: 'No tienes permisos para editar inventario.' });
      return;
    }

    setEditingProducto(null);
    setProductoForm({
      ...initialProductForm,
      estado: metadata.estadosProducto[0] ?? '',
      colores: [{ nombre: '', cantidad: '' }],
      tallas: [{ nombre: '', cantidad: '' }],
    });
    setProductoError(null);
    setShowProductoModal(true);
  };

  const mapProductoToForm = (producto: Producto): ProductFormState => {
    const totalProducto = Number(producto.cantidad ?? 0);

    const normalizeFormRows = (
      rows: Array<Record<string, unknown>> | undefined,
      fallbackNombre: string
    ): Array<{ nombre: string; cantidad: string }> => {
      const safeRows = Array.isArray(rows) ? rows : [];

      if (safeRows.length === 0) {
        if (totalProducto > 0) {
          return [{ nombre: fallbackNombre, cantidad: String(totalProducto) }];
        }
        return [{ nombre: '', cantidad: '' }];
      }

      const normalized = safeRows.map((item) => {
        const nombreRaw = item.nombre ?? item.color ?? item.talla ?? '';
        const nombre = String(nombreRaw ?? '').trim();

        const cantidadRaw = item.cantidad ?? item.stock ?? item.qty ?? item.cantidadStock;
        const cantidadTexto =
          cantidadRaw === null || cantidadRaw === undefined ? '' : String(cantidadRaw).trim();
        const cantidadNumerica = cantidadTexto.length > 0 ? Number(cantidadTexto) : Number.NaN;
        const cantidad = Number.isFinite(cantidadNumerica) ? String(Math.max(0, Math.floor(cantidadNumerica))) : '';

        return {
          nombre,
          cantidad,
        };
      });

      const totalNormalizado = normalized.reduce((acc, row) => {
        const n = Number(row.cantidad || 0);
        return acc + (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
      }, 0);

      if (totalNormalizado <= 0 && totalProducto > 0) {
        if (normalized.length === 1) {
          normalized[0] = { ...normalized[0], cantidad: String(totalProducto) };
        } else {
          const base = Math.floor(totalProducto / normalized.length);
          let restante = totalProducto - base * normalized.length;
          for (let idx = 0; idx < normalized.length; idx += 1) {
            const extra = restante > 0 ? 1 : 0;
            restante = Math.max(0, restante - 1);
            normalized[idx] = { ...normalized[idx], cantidad: String(base + extra) };
          }
        }
      }

      const completadas = normalized.map((row, index) => {
        if (row.cantidad.trim().length > 0) return row;
        if (normalized.length === 1 && totalProducto > 0) {
          return { ...row, cantidad: String(totalProducto) };
        }
        return { ...row, cantidad: '0' };
      });

      return completadas.length > 0 ? completadas : [{ nombre: '', cantidad: '' }];
    };

    let imagenes =
      producto.imagenes && producto.imagenes.length > 0
        ? producto.imagenes.map((item) => ({ nombreArchivo: item.nombreArchivo, url: item.url }))
        : [];

    if (imagenes.length === 0 && producto.imagenUrl) {
      const raw = String(producto.imagenUrl).trim();
      if (raw.startsWith('[')) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            imagenes = parsed
              .map((item, index) => {
                if (!item || typeof item !== 'object') return null;
                const url = String((item as { url?: unknown }).url ?? '').trim();
                if (!url) return null;
                const nombreArchivo = String((item as { nombreArchivo?: unknown }).nombreArchivo ?? '').trim();
                return {
                  nombreArchivo: nombreArchivo || `imagen-${index + 1}.webp`,
                  url,
                };
              })
              .filter((item): item is { nombreArchivo: string; url: string } => Boolean(item));
          }
        } catch {
          imagenes = [{ nombreArchivo: 'imagen-portada.webp', url: raw }];
        }
      } else {
        imagenes = [{ nombreArchivo: 'imagen-portada.webp', url: raw }];
      }
    }

    return {
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
      imagenes,
      marca: producto.marca ?? '',
      modelo: producto.modelo ?? '',
      estado: producto.estado ?? '',
      colores: normalizeFormRows((producto.colores as Array<Record<string, unknown>> | undefined) ?? [], 'Único'),
      tallas: normalizeFormRows((producto.tallas as Array<Record<string, unknown>> | undefined) ?? [], 'Única'),
    };
  };

  const openProductoEditModal = async (productoBase: Producto) => {
    if (!canViewPrices) {
      setPageFeedback({ type: 'error', message: 'No tienes permisos para editar inventario.' });
      return;
    }

    setEditLoadingId(productoBase.id);
    try {
      const producto = await inventoryController.getProductoById(productoBase.id);
      setEditingProducto(producto);
      setProductoForm(mapProductoToForm(producto));
      setProductoError(null);
      setShowProductoModal(true);
    } catch (e) {
      console.error(e);
      setPageFeedback({
        type: 'error',
        message: e instanceof Error ? e.message : 'No se pudo cargar la información completa del producto',
      });
    } finally {
      setEditLoadingId(null);
    }
  };

  const closeProductoModal = () => {
    if (submitLoading) return;
    setShowProductoModal(false);
    setEditingProducto(null);
    setProductoError(null);
    setProductoForm(initialProductForm);
    if (imageFileInputRef.current) imageFileInputRef.current.value = '';
  };

  const toDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('No se pudo leer la imagen seleccionada'));
          return;
        }
        resolve(reader.result);
      };
      reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada'));
      reader.readAsDataURL(file);
    });

  const loadImageElement = (file: File): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('No se pudo abrir la imagen seleccionada'));
      };
      img.src = objectUrl;
    });

  const normalizeImageToWebp = async (file: File): Promise<string> => {
    const img = await loadImageElement(file);
    const srcWidth = img.naturalWidth || img.width;
    const srcHeight = img.naturalHeight || img.height;
    const maxSide = Math.max(srcWidth, srcHeight);
    const scale = maxSide > NORMALIZED_IMAGE_MAX_SIDE ? NORMALIZED_IMAGE_MAX_SIDE / maxSide : 1;
    const targetWidth = Math.max(1, Math.round(srcWidth * scale));
    const targetHeight = Math.max(1, Math.round(srcHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No fue posible procesar la imagen.');
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL(NORMALIZED_IMAGE_TYPE, NORMALIZED_IMAGE_QUALITY);
  };

  const slugifyText = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);

  const buildTraceableImageName = (index: number) => {
    const nombreBase = slugifyText(productoForm.nombre || 'producto');
    const modeloBase = slugifyText(productoForm.modelo || 'sin-modelo');
    return `${nombreBase}-${modeloBase}-${Date.now()}-${String(index + 1).padStart(2, '0')}.webp`;
  };

  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) return;

    const loadedImages: Array<{ nombreArchivo: string; url: string }> = [];

    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const selectedFile = selectedFiles[index];
        if (!selectedFile.type.startsWith('image/')) {
          throw new Error(`El archivo ${selectedFile.name} no es una imagen válida.`);
        }
        if (selectedFile.size > MAX_IMAGE_FILE_SIZE_BYTES) {
          throw new Error(`La imagen ${selectedFile.name} supera ${MAX_IMAGE_FILE_SIZE_MB} MB.`);
        }

        let imageDataUrl: string;
        try {
          imageDataUrl = await normalizeImageToWebp(selectedFile);
        } catch {
          imageDataUrl = await toDataUrl(selectedFile);
        }

        loadedImages.push({
          nombreArchivo: buildTraceableImageName(index),
          url: imageDataUrl,
        });
      }

      setProductoForm((prev) => {
        const imagenes = [...prev.imagenes, ...loadedImages];
        return {
          ...prev,
          imagenes,
          imagenUrl: imagenes[0]?.url ?? prev.imagenUrl,
        };
      });
      setProductoError(null);
    } catch (e) {
      console.error(e);
      setProductoError(e instanceof Error ? e.message : 'No se pudieron procesar las imágenes seleccionadas.');
    } finally {
      event.target.value = '';
    }
  };

  const openCategoriaModal = () => {
    if (!canViewPrices) {
      setPageFeedback({ type: 'error', message: 'No tienes permisos para crear categorías.' });
      return;
    }

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

    if (!canViewPrices) {
      setProductoError('No tienes permisos para guardar cambios de inventario.');
      return;
    }

    setProductoError(null);

    if (!productoForm.nombre.trim() || !productoForm.categoriaId || !productoForm.precioCosto || !productoForm.precioCredito) {
      setProductoError('Nombre, categoría y precios son obligatorios');
      return;
    }

    const coloresPayload = normalizeStockRows(productoForm.colores);
    const tallasPayload = normalizeStockRows(productoForm.tallas);

    if (coloresPayload.length === 0) {
      setProductoError('Debes crear al menos un color con cantidad.');
      return;
    }
    if (tallasPayload.length === 0) {
      setProductoError('Debes crear al menos una talla con cantidad.');
      return;
    }

    const totalColores = coloresPayload.reduce((acc, item) => acc + item.cantidad, 0);
    const totalTallas = tallasPayload.reduce((acc, item) => acc + item.cantidad, 0);
    if (totalColores <= 0 || totalTallas <= 0) {
      setProductoError('Las cantidades de colores y tallas deben ser mayores que cero.');
      return;
    }
    if (totalColores !== totalTallas) {
      setProductoError('La suma total por colores debe coincidir con la suma total por tallas.');
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

      const normalizedImages = productoForm.imagenes.filter((item) => item.url.trim().length > 0);
      const portada = normalizedImages[0]?.url ?? toNull(productoForm.imagenUrl);

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
          cantidad: totalColores,
          imagenUrl: portada,
          imagenes: normalizedImages,
          marca: toNull(productoForm.marca),
          modelo: toNull(productoForm.modelo),
          estado: productoForm.estado ? (productoForm.estado as EstadoProducto) : null,
          colores: coloresPayload,
          tallas: tallasPayload,
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
          cantidad: totalColores,
          imagenUrl: portada ?? undefined,
          imagenes: normalizedImages,
          marca: toUndefined(productoForm.marca),
          modelo: toUndefined(productoForm.modelo),
          estado: productoForm.estado ? (productoForm.estado as EstadoProducto) : undefined,
          colores: coloresPayload,
          tallas: tallasPayload,
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
    if (!canViewPrices) {
      setPageFeedback({ type: 'error', message: 'No tienes permisos para eliminar productos.' });
      return;
    }

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

  const addColorRow = () => {
    setProductoForm((prev) => ({
      ...prev,
      colores: [...prev.colores, { nombre: '', cantidad: '' }],
    }));
  };

  const removeColorRow = (index: number) => {
    setProductoForm((prev) => ({
      ...prev,
      colores: prev.colores.length > 1 ? prev.colores.filter((_, idx) => idx !== index) : prev.colores,
    }));
  };

  const updateColorRow = (index: number, field: 'nombre' | 'cantidad', value: string) => {
    setProductoForm((prev) => ({
      ...prev,
      colores: prev.colores.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)),
    }));
  };

  const addTallaRow = () => {
    setProductoForm((prev) => ({
      ...prev,
      tallas: [...prev.tallas, { nombre: '', cantidad: '' }],
    }));
  };

  const removeTallaRow = (index: number) => {
    setProductoForm((prev) => ({
      ...prev,
      tallas: prev.tallas.length > 1 ? prev.tallas.filter((_, idx) => idx !== index) : prev.tallas,
    }));
  };

  const updateTallaRow = (index: number, field: 'nombre' | 'cantidad', value: string) => {
    setProductoForm((prev) => ({
      ...prev,
      tallas: prev.tallas.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)),
    }));
  };

  const removeImageAtIndex = (index: number) => {
    setProductoForm((prev) => {
      const imagenes = prev.imagenes.filter((_, idx) => idx !== index);
      return {
        ...prev,
        imagenes,
        imagenUrl: imagenes[0]?.url ?? '',
      };
    });
  };

  const vacio = !loading && filteredProductos.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Control de Inventario</h3>
          <p className="text-gray-600 text-sm mt-1">Gestiona tus productos y existencias</p>
        </div>
        {canViewPrices ? (
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
        ) : null}
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
            title="Filtrar por categoría"
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
          {stockFiltro !== 'all' && (
            <button
              type="button"
              className="px-4 py-2 border border-blue-200 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              onClick={() => setStockFiltro('all')}
            >
              Mostrar todo
            </button>
          )}
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
          <p className="text-gray-600 text-sm mb-1">Total Prendas</p>
          <p className="text-3xl font-bold text-gray-900">{stats.totalPrendas}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm mb-1">Valor Inventario (compra)</p>
          {canViewPrices ? (
            <>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.valorInventarioCompra)}</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-700">Restringido</p>
              <p className="text-xs text-gray-500 mt-1">Los valores de precio no están disponibles para tu rol.</p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setStockFiltro((prev) => (prev === 'low' ? 'all' : 'low'))}
          className={`text-left bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-500 transition-colors ${
            stockFiltro === 'low' ? 'ring-2 ring-orange-300 bg-orange-50' : 'hover:bg-orange-50'
          }`}
          title="Filtrar modelos con stock bajo"
        >
          <p className="text-gray-600 text-sm mb-1">Modelos Bajo Stock</p>
          <p className="text-3xl font-bold text-gray-900">{stats.modelosBajoStock}</p>
          <p className="text-xs text-gray-500 mt-1">Menor a {stats.limiteStockBajo} unidades</p>
        </button>
        <button
          type="button"
          onClick={() => setStockFiltro((prev) => (prev === 'out' ? 'all' : 'out'))}
          className={`text-left bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500 transition-colors ${
            stockFiltro === 'out' ? 'ring-2 ring-red-300 bg-red-50' : 'hover:bg-red-50'
          }`}
          title="Filtrar modelos sin stock"
        >
          <p className="text-gray-600 text-sm mb-1">Modelos Sin Stock</p>
          <p className="text-3xl font-bold text-gray-900">{stats.modelosSinStock}</p>
          <p className="text-xs text-gray-500 mt-1">
            Promedio por modelo: {Number.isFinite(stats.promedioPrendasPorModelo) ? stats.promedioPrendasPorModelo.toFixed(1) : '0.0'}
          </p>
        </button>
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

                  {canViewPrices ? (
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
                  ) : (
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                      Precios ocultos para tu rol.
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-xs font-medium text-gray-500">
                      Estado: <span className="capitalize text-gray-900">{producto.estado}</span>
                    </span>
                    {canViewPrices ? (
                      <div className="flex items-center space-x-2">
                        <button
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                          onClick={() => openProductoEditModal(producto)}
                          disabled={editLoadingId === producto.id}
                        >
                          {editLoadingId === producto.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Edit className="w-4 h-4" />
                          )}
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
                    ) : null}
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
              <button
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
                onClick={closeProductoModal}
                title="Cerrar modal de producto"
              >
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
                      title="Nombre del producto"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      value={productoForm.nombre}
                      onChange={(event) => setProductoForm((prev) => ({ ...prev, nombre: event.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Categoría *</label>
                    <select
                      title="Categoría del producto"
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
                      title="Descripción del producto"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      rows={3}
                      value={productoForm.descripcion}
                      onChange={(event) => setProductoForm((prev) => ({ ...prev, descripcion: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {canViewPrices ? (
                    <>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Precio costo *</label>
                        <input
                          type="number"
                          min={0}
                          title="Precio de costo"
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
                          title="Precio a crédito"
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
                          title="Precio de contado"
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
                          title="Cuota inicial"
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
                          title="Costo de devolución"
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                          value={productoForm.costoDevolucion}
                          onChange={(event) =>
                            setProductoForm((prev) => ({ ...prev, costoDevolucion: event.target.value }))
                          }
                        />
                      </div>
                    </>
                  ) : (
                    <div className="md:col-span-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                      Los campos de precios están ocultos para tu rol.
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Cantidad</label>
                    <input
                      type="text"
                      title="Cantidad en inventario"
                      className={`mt-1 w-full rounded-lg border px-3 py-2 focus:ring-blue-500 ${
                        totalsMatch ? 'border-gray-200 focus:border-blue-500' : 'border-red-300 text-red-700 focus:border-red-500'
                      }`}
                      value={totalsMatch ? String(totalColoresForm) : `${totalColoresForm} / ${totalTallasForm}`}
                      readOnly
                    />
                    {!totalsMatch && (
                      <p className="text-xs text-red-600">
                        Los totales de colores y tallas deben coincidir exactamente para guardar.
                      </p>
                    )}
                    <p className="text-xs text-gray-500">La cantidad total del producto es la suma por color.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Colores *</h4>
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        onClick={addColorRow}
                      >
                        Crear color
                      </button>
                    </div>
                    {productoForm.colores.map((row, index) => (
                      <div key={`color-${index}`} className="grid grid-cols-[1fr,120px,36px] gap-2 items-end">
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Color</label>
                          <input
                            title="Nombre del color"
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                            value={row.nombre}
                            onChange={(event) => updateColorRow(index, 'nombre', event.target.value)}
                            placeholder="Blanco"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Cantidad</label>
                          <input
                            type="number"
                            min={0}
                            title="Cantidad del color"
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                            value={row.cantidad}
                            onChange={(event) => updateColorRow(index, 'cantidad', event.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          className="h-10 w-9 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => removeColorRow(index)}
                          disabled={productoForm.colores.length === 1}
                          title="Eliminar color"
                        >
                          <Trash2 className="mx-auto h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-gray-500">Total colores: {totalColoresForm}</p>
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Tallas *</h4>
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        onClick={addTallaRow}
                      >
                        Crear talla
                      </button>
                    </div>
                    {productoForm.tallas.map((row, index) => (
                      <div key={`talla-${index}`} className="grid grid-cols-[1fr,120px,36px] gap-2 items-end">
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Talla</label>
                          <input
                            title="Nombre de la talla"
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                            value={row.nombre}
                            onChange={(event) => updateTallaRow(index, 'nombre', event.target.value)}
                            placeholder="M"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Cantidad</label>
                          <input
                            type="number"
                            min={0}
                            title="Cantidad de la talla"
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                            value={row.cantidad}
                            onChange={(event) => updateTallaRow(index, 'cantidad', event.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          className="h-10 w-9 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => removeTallaRow(index)}
                          disabled={productoForm.tallas.length === 1}
                          title="Eliminar talla"
                        >
                          <Trash2 className="mx-auto h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-gray-500">Total tallas: {totalTallasForm}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Marca</label>
                    <input
                      title="Marca del producto"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      value={productoForm.marca}
                      onChange={(event) => setProductoForm((prev) => ({ ...prev, marca: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Modelo</label>
                    <input
                      title="Modelo del producto"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      value={productoForm.modelo}
                      onChange={(event) => setProductoForm((prev) => ({ ...prev, modelo: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Imágenes</label>
                    <input
                      ref={imageFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      title="Seleccionar imágenes del producto"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                      onChange={handleImageFileChange}
                    />
                    <p className="mt-1 text-xs text-gray-500">Puedes seleccionar varias imágenes desde galería/carpeta o pegar una URL.</p>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      value={productoForm.imagenUrl}
                      onChange={(event) => {
                        const value = event.target.value;
                        setProductoForm((prev) => {
                          if (!value.trim()) {
                            return { ...prev, imagenUrl: '', imagenes: [] };
                          }
                          const manualImage = { nombreArchivo: 'imagen-manual.webp', url: value };
                          const imagenes = prev.imagenes.length > 0 ? [manualImage, ...prev.imagenes.slice(1)] : [manualImage];
                          return { ...prev, imagenUrl: value, imagenes };
                        });
                      }}
                      placeholder="https://... o data:image/..."
                    />
                    {productoForm.imagenes.length > 0 ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {productoForm.imagenes.map((imagen, index) => (
                          <div key={`${imagen.nombreArchivo}-${index}`} className="rounded-lg border border-gray-200 p-2">
                            <img
                              src={imagen.url}
                              alt={`Imagen ${index + 1} del producto`}
                              className="h-20 w-full rounded object-cover"
                            />
                            <p className="mt-1 truncate text-[11px] text-gray-500" title={imagen.nombreArchivo}>
                              {imagen.nombreArchivo}
                            </p>
                            <button
                              type="button"
                              className="mt-1 text-xs font-medium text-red-600 hover:text-red-700"
                              onClick={() => removeImageAtIndex(index)}
                            >
                              Quitar
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {productoForm.imagenUrl ? (
                      <button
                        type="button"
                        className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
                        onClick={() => {
                          setProductoForm((prev) => ({ ...prev, imagenUrl: '', imagenes: [] }));
                          if (imageFileInputRef.current) imageFileInputRef.current.value = '';
                        }}
                      >
                        Quitar todas
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Estado</label>
                    <select
                      title="Estado del producto"
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
              <button
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
                onClick={() => setShowCategoriaModal(false)}
                title="Cerrar modal de categoría"
              >
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
                    title="Nombre de la categoría"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                    value={categoriaForm.nombre}
                    onChange={(event) => setCategoriaForm((prev) => ({ ...prev, nombre: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Tipo *</label>
                  <select
                    title="Tipo de categoría"
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
                    title="Descripción de la categoría"
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
