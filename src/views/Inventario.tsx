import { Plus, Search, CreditCard as Edit, Trash2, Package, AlertTriangle, TrendingUp } from 'lucide-react';
import { salesController } from '../controllers/salesController';

export default function Inventario() {
  const productos = salesController.getProductos();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Control de Inventario</h3>
          <p className="text-gray-600 text-sm mt-1">Gestiona tus productos y existencias</p>
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          <span>Agregar Producto</span>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar producto por nombre o categoría..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option>Todas las categorías</option>
            <option>Electrónica</option>
            <option>Ropa</option>
            <option>Alimentos</option>
            <option>Hogar</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm mb-1">Total Productos</p>
          <p className="text-3xl font-bold text-gray-900">{productos.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm mb-1">Valor Total</p>
          <p className="text-3xl font-bold text-gray-900">$ 0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-500">
          <p className="text-gray-600 text-sm mb-1">Stock Bajo</p>
          <p className="text-3xl font-bold text-gray-900">0</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm mb-1">Sin Stock</p>
          <p className="text-3xl font-bold text-gray-900">0</p>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {productos.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow-sm p-12">
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No hay productos en inventario</p>
              <p className="text-gray-400 text-sm">Agrega tu primer producto para comenzar</p>
            </div>
          </div>
        ) : (
          productos.map((producto) => (
            <div key={producto.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {/* Product Image */}
              <div className="h-48 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                <Package className="w-16 h-16 text-blue-600" />
              </div>

              {/* Product Info */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-900 line-clamp-1">{producto.nombre}</h4>
                  {producto.stock < 10 && (
                    <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                  )}
                </div>

                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{producto.descripcion}</p>

                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {producto.categoria}
                  </span>
                  <span className={`text-sm font-semibold ${producto.stock > 10 ? 'text-green-600' : 'text-orange-600'}`}>
                    Stock: {producto.stock}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-lg font-bold text-gray-900">
                    $ {producto.precio.toLocaleString()}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick Stats */}
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
    </div>
  );
}
