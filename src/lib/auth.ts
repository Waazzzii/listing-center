// Stubbed auth — Wazzi SSO integration added manually later

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'viewer';
}

const STUB_USER: User = {
  id: 'stub-jason',
  name: 'Jason Pratts',
  email: 'jason@casagodeserttocoast.com',
  role: 'admin',
};

export function getCurrentUser(): User {
  return STUB_USER;
}

export function isAdmin(user: User): boolean {
  return user.role === 'admin';
}
