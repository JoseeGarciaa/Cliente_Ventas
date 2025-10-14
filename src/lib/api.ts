export type LoginResponse = {
  token: string;
  user: any;
  tenant: string;
};

const TOKEN_KEY = 'auth_token';

export const auth = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
};

export async function login(payload: { email: string; password: string }): Promise<LoginResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  const data: LoginResponse = await res.json();
  auth.setToken(data.token);
  return data;
}

export async function me(): Promise<{ user: any; tenant: string }> {
  const token = auth.getToken();
  if (!token) throw new Error('No token');
  const res = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {}
  auth.clear();
}

export async function fetchWithAuth<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const token = auth.getToken();
  if (!token) {
    throw new Error('No hay sesión activa. Inicia sesión nuevamente.');
  }

  const headers = new Headers(init?.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => 'Error desconocido');
    throw new Error(message || 'Error al comunicar con el servidor');
  }

  return response.json();
}
