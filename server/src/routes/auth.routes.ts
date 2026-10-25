import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db } from '../db/db.js';
import { signToken, requireAuth, AuthUser } from '../middleware/auth.js';

const router = Router();

// Register new customer
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check duplicate email
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Role is strictly enforced as customer
    const role = 'customer';
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO users (id, name, email, password, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, name.trim(), normalizedEmail, hashedPassword, role);

    const user: AuthUser = {
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      role,
    };

    const token = signToken(user);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      message: 'Account created successfully',
      user,
      token,
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = db.prepare('SELECT id, name, email, password, role FROM users WHERE email = ?').get(normalizedEmail) as
      | { id: string; name: string; email: string; password: string; role: 'customer' | 'studio' | 'admin' }
      | undefined;

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(String(password), user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const authUser: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const token = signToken(authUser);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: 'Logged in successfully',
      user: authUser,
      token,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  return res.status(200).json({ message: 'Logged out successfully' });
});

// Get current user
router.get('/me', requireAuth, (req: Request, res: Response) => {
  return res.status(200).json({ user: req.user });
});

export default router;
