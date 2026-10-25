import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/db.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'studio' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_art_studio_jwt_token_key_2026';

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    return payload;
  } catch {
    return null;
  }
}

// Middleware to extract user from Authorization header or cookie
export function authenticate(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;

  // 1. Check Bearer Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    // 2. Check cookie
    token = req.cookies.token;
  }

  if (!token) {
    req.user = undefined;
    return next();
  }

  const payload = verifyToken(token);
  if (!payload) {
    req.user = undefined;
    return next();
  }

  // Verify user still exists in database
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(payload.id) as AuthUser | undefined;
  if (!user) {
    req.user = undefined;
    return next();
  }

  req.user = user;
  next();
}

// Require user to be authenticated (HTTP 401 if not)
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

// Require specific role(s) (HTTP 403 if role mismatch)
export function requireRole(allowedRoles: Array<'customer' | 'studio' | 'admin'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const userRole = req.user.role;
    // Normalize 'studio' and 'admin' as administrator roles
    const isAdmin = userRole === 'admin' || userRole === 'studio';
    const hasPermission = allowedRoles.some((r) => {
      if (r === 'admin' || r === 'studio') {
        return isAdmin;
      }
      return r === userRole;
    });

    if (!hasPermission) {
      return res.status(403).json({ error: 'Access forbidden. You do not have permission for this action.' });
    }

    next();
  };
}

export const requireCustomer = requireRole(['customer']);
export const requireAdmin = requireRole(['admin', 'studio']);
