import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  UserCog,
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { salesController } from '../controllers/salesController';
import type { CreateUsuarioPayload, UpdateUsuarioPayload, Usuario, UsuariosMetadata } from '../models/types';

type FormState = {
  nombre: string;
  email: string;
  password: string;
  rol: string;
  estado: string;
  telefono: string;
};

const DEFAULT_FORM: FormState = {
  nombre: '',
  email: '',
  password: '',
  rol: '',
  estado: 'activo',
  telefono: '',
};

const DEFAULT_USUARIOS_METADATA: UsuariosMetadata = {
  roles: ['admin', 'vendedor', 'supervisor'],
  estados: ['activo', 'inactivo'],
};

const toLower = (value: string) => String(value || '').trim().toLowerCase();

const formatEnumLabel = (value: string) =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<UsuariosMetadata>(DEFAULT_USUARIOS_METADATA);

  const [search, setSearch] = useState('');
  const [rolFilter, setRolFilter] = useState('todos');
  const [estadoFilter, setEstadoFilter] = useState('todos');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null);

  const loadUsuarios = async () => {
    try {
      setLoading(true);
      const [data, metadataData] = await Promise.all([
        salesController.getUsuarios(),
        salesController.getUsuariosMetadata().catch(() => DEFAULT_USUARIOS_METADATA),
      ]);
      setUsuarios(data);
      setMetadata({
        roles: metadataData.roles?.length ? metadataData.roles : DEFAULT_USUARIOS_METADATA.roles,
        estados: metadataData.estados?.length ? metadataData.estados : DEFAULT_USUARIOS_METADATA.estados,
      });
      setError(null);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsuarios();
  }, []);

  useEffect(() => {
    if (editing || showModal) return;
    if (form.rol) return;

    const defaultRol = metadata.roles[0] ?? DEFAULT_USUARIOS_METADATA.roles[0] ?? 'admin';
    const defaultEstado = metadata.estados[0] ?? DEFAULT_USUARIOS_METADATA.estados[0] ?? 'activo';
    setForm((prev) => ({ ...prev, rol: defaultRol, estado: defaultEstado }));
  }, [metadata.roles, metadata.estados, form.rol, editing, showModal]);

  const filteredUsuarios = useMemo(() => {
    const term = search.trim().toLowerCase();

    return usuarios.filter((usuario) => {
      const matchSearch = term
        ? [usuario.nombre, usuario.email, usuario.telefono || '', usuario.rol]
            .join(' ')
            .toLowerCase()
            .includes(term)
        : true;

      const matchRol = rolFilter === 'todos' ? true : usuario.rol === rolFilter;
      const matchEstado = estadoFilter === 'todos' ? true : usuario.estado === estadoFilter;

      return matchSearch && matchRol && matchEstado;
    });
  }, [usuarios, search, rolFilter, estadoFilter]);

  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    metadata.roles.forEach((rol) => roles.add(String(rol).trim()));
    usuarios.forEach((usuario) => roles.add(String(usuario.rol).trim()));
    if (form.rol) roles.add(String(form.rol).trim());
    return Array.from(roles).filter(Boolean);
  }, [metadata.roles, usuarios, form.rol]);

  const availableEstados = useMemo(() => {
    const estados = new Set<string>();
    metadata.estados.forEach((estado) => estados.add(String(estado).trim()));
    usuarios.forEach((usuario) => estados.add(String(usuario.estado).trim()));
    if (form.estado) estados.add(String(form.estado).trim());
    return Array.from(estados).filter(Boolean);
  }, [metadata.estados, usuarios, form.estado]);

  const stats = useMemo(() => {
    const total = usuarios.length;
    const admins = usuarios.filter((u) => toLower(u.rol) === 'admin').length;
    const vendedores = usuarios.filter((u) => toLower(u.rol) === 'vendedor').length;
    const supervisores = usuarios.filter((u) => toLower(u.rol) === 'supervisor').length;
    return { total, admins, vendedores, supervisores };
  }, [usuarios]);

  const getRolBadge = (rol: string) => {
    const styles = {
      admin: 'bg-red-100 text-red-700',
      vendedor: 'bg-blue-100 text-blue-700',
      supervisor: 'bg-green-100 text-green-700',
    };
    return styles[toLower(rol) as keyof typeof styles] || 'bg-gray-100 text-gray-700';
  };

  const getRolIcon = (rol: string) => {
    switch (toLower(rol)) {
      case 'admin':
        return <Shield className="w-4 h-4" />;
      default:
        return <UserCog className="w-4 h-4" />;
    }
  };

  const openCreate = () => {
    const defaultRol = availableRoles[0] ?? DEFAULT_USUARIOS_METADATA.roles[0] ?? 'admin';
    const defaultEstado = availableEstados[0] ?? DEFAULT_USUARIOS_METADATA.estados[0] ?? 'activo';

    setEditing(null);
    setForm({
      ...DEFAULT_FORM,
      rol: defaultRol,
      estado: defaultEstado,
    });
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (usuario: Usuario) => {
    setEditing(usuario);
    setForm({
      nombre: usuario.nombre,
      email: usuario.email,
      password: '',
      rol: usuario.rol,
      estado: usuario.estado,
      telefono: usuario.telefono || '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm({
      ...DEFAULT_FORM,
      rol: availableRoles[0] ?? DEFAULT_USUARIOS_METADATA.roles[0] ?? 'admin',
      estado: availableEstados[0] ?? DEFAULT_USUARIOS_METADATA.estados[0] ?? 'activo',
    });
    setFormError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!form.nombre.trim() || !form.email.trim()) {
      setFormError('Nombre y correo son obligatorios');
      return;
    }

    if (!editing && !form.password.trim()) {
      setFormError('La contraseña es obligatoria para crear un usuario');
      return;
    }

    setSubmitLoading(true);

    try {
      if (editing) {
        const payload: UpdateUsuarioPayload = {
          nombre: form.nombre.trim(),
          email: form.email.trim(),
          rol: form.rol,
          estado: form.estado,
          telefono: form.telefono.trim() || null,
        };

        if (form.password.trim()) {
          payload.password = form.password.trim();
        }

        const updated = await salesController.updateUsuario(editing.id, payload);
        setUsuarios((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const payload: CreateUsuarioPayload = {
          nombre: form.nombre.trim(),
          email: form.email.trim(),
          password: form.password.trim(),
          rol: form.rol,
          estado: form.estado,
          telefono: form.telefono.trim() || null,
        };

        const created = await salesController.createUsuario(payload);
        setUsuarios((prev) => [created, ...prev]);
      }

      closeModal();
    } catch (e) {
      console.error(e);
      setFormError(e instanceof Error ? e.message : 'No se pudo guardar el usuario');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (usuario: Usuario) => {
    if (!window.confirm(`¿Seguro que deseas eliminar a ${usuario.nombre}?`)) {
      return;
    }

    setDeleteLoadingId(usuario.id);
    try {
      await salesController.deleteUsuario(usuario.id);
      setUsuarios((prev) => prev.filter((item) => item.id !== usuario.id));
    } catch (e) {
      console.error(e);
      window.alert(e instanceof Error ? e.message : 'No se pudo eliminar el usuario');
    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Gestión de Usuarios</h3>
          <p className="text-gray-600 text-sm mt-1">Administra los usuarios del sistema</p>
        </div>
        <button
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          onClick={openCreate}
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, correo, teléfono o rol..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            key={`roles-filter-${availableRoles.join('|')}`}
            title="Filtrar usuarios por rol"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={rolFilter}
            onChange={(event) => setRolFilter(event.target.value)}
          >
            <option value="todos">Todos los roles</option>
            {availableRoles.map((rol) => (
              <option key={rol} value={rol}>{formatEnumLabel(rol)}</option>
            ))}
          </select>
          <select
            key={`estados-filter-${availableEstados.join('|')}`}
            title="Filtrar usuarios por estado"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={estadoFilter}
            onChange={(event) => setEstadoFilter(event.target.value)}
          >
            <option value="todos">Todos los estados</option>
            {availableEstados.map((estado) => (
              <option key={estado} value={estado}>{formatEnumLabel(estado)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm mb-1">Total Usuarios</p>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm mb-1">Administradores</p>
          <p className="text-3xl font-bold text-gray-900">{stats.admins}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm mb-1">Vendedores</p>
          <p className="text-3xl font-bold text-gray-900">{stats.vendedores}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-500">
          <p className="text-gray-600 text-sm mb-1">Supervisores</p>
          <p className="text-3xl font-bold text-gray-900">{stats.supervisores}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100 min-w-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="font-medium">Cargando usuarios...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <p className="text-red-600 font-medium">{error}</p>
            <button
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              onClick={loadUsuarios}
            >
              Reintentar
            </button>
          </div>
        ) : filteredUsuarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <UserCog className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No hay usuarios para mostrar</p>
            <p className="text-gray-400 text-sm">Ajusta filtros o crea un nuevo usuario</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Usuario</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Teléfono</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Rol</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha Registro</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsuarios.map((usuario) => (
                    <tr key={usuario.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-700 font-semibold text-sm">{usuario.nombre.charAt(0).toUpperCase()}</span>
                          </div>
                          <p className="font-semibold text-gray-900">{usuario.nombre}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{usuario.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{usuario.telefono || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium ${getRolBadge(usuario.rol)}`}>
                          {getRolIcon(usuario.rol)}
                          <span className="capitalize">{formatEnumLabel(usuario.rol)}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {usuario.estado === 'activo' ? (
                          <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle className="w-4 h-4" />
                            <span>Activo</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            <XCircle className="w-4 h-4" />
                            <span>Inactivo</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(usuario.fechaCreacion).toLocaleDateString('es-CO')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            onClick={() => openEdit(usuario)}
                            title="Editar usuario"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60"
                            onClick={() => handleDelete(usuario)}
                            disabled={deleteLoadingId === usuario.id}
                            title="Eliminar usuario"
                          >
                            {deleteLoadingId === usuario.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-100">
              {filteredUsuarios.map((usuario) => (
                <div key={usuario.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{usuario.nombre}</p>
                      <p className="text-xs text-gray-500">{usuario.email}</p>
                    </div>
                    <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium ${getRolBadge(usuario.rol)}`}>
                      {getRolIcon(usuario.rol)}
                      <span className="capitalize">{formatEnumLabel(usuario.rol)}</span>
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">Teléfono: {usuario.telefono || '—'}</p>
                  <p className="text-sm text-gray-600">Estado: {usuario.estado === 'activo' ? 'Activo' : 'Inactivo'}</p>
                  <p className="text-sm text-gray-600">Creado: {new Date(usuario.fechaCreacion).toLocaleDateString('es-CO')}</p>
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                      onClick={() => openEdit(usuario)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </button>
                    <button
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-60"
                      onClick={() => handleDelete(usuario)}
                      disabled={deleteLoadingId === usuario.id}
                    >
                      {deleteLoadingId === usuario.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col min-w-0">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Editar usuario' : 'Nuevo usuario'}</h3>
                <p className="text-sm text-gray-500">Completa la información del usuario</p>
              </div>
              <button className="p-2 rounded-full hover:bg-gray-100 text-gray-500" onClick={closeModal} title="Cerrar modal">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Nombre *</label>
                  <input
                    title="Nombre del usuario"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                    value={form.nombre}
                    onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Correo *</label>
                  <input
                    type="email"
                    title="Correo electrónico del usuario"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {editing ? 'Contraseña (opcional)' : 'Contraseña *'}
                  </label>
                  <input
                    type="password"
                    title={editing ? 'Contraseña opcional para actualizar usuario' : 'Contraseña del usuario'}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                    value={form.password}
                    onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder={editing ? 'Déjala vacía para conservar la actual' : ''}
                    required={!editing}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Rol *</label>
                    <select
                      key={`roles-form-${availableRoles.join('|')}`}
                      title="Rol del usuario"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      value={form.rol}
                      onChange={(event) => setForm((prev) => ({ ...prev, rol: event.target.value }))}
                    >
                      {availableRoles.map((rol) => (
                        <option key={rol} value={rol}>{formatEnumLabel(rol)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Estado *</label>
                    <select
                      key={`estados-form-${availableEstados.join('|')}`}
                      title="Estado del usuario"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                      value={form.estado}
                      onChange={(event) => setForm((prev) => ({ ...prev, estado: event.target.value }))}
                    >
                      {availableEstados.map((estado) => (
                        <option key={estado} value={estado}>{formatEnumLabel(estado)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Teléfono</label>
                  <input
                    title="Teléfono del usuario"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                    value={form.telefono}
                    onChange={(event) => setForm((prev) => ({ ...prev, telefono: event.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t bg-white">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                  onClick={closeModal}
                  disabled={submitLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
                  disabled={submitLoading}
                >
                  {submitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <span>{submitLoading ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear usuario'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
