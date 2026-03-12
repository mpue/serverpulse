export type Role = 'admin' | 'operator' | 'viewer';

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: Role;
  totp_secret: string | null;
  created_at: string;
}

export interface UserPublic {
  id: number;
  username: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface JwtPayload {
  id: number;
  username: string;
  role: Role;
}
