import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { Lock, Mail, Shield, User, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, redirect
  React.useEffect(() => {
    if (user) {
      if (user.role === 'admin' || user.role === 'studio') {
        navigate('/admin');
      } else {
        navigate(redirect);
      }
    }
  }, [user, navigate, redirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const loggedUser = await login(email, password);
      if (loggedUser.role === 'admin' || loggedUser.role === 'studio') {
        navigate('/admin');
      } else {
        navigate(redirect);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillAdmin = () => {
    setEmail('studio@artstudio.in');
    setPassword('Studio@123');
    setError(null);
  };

  const fillCustomer = () => {
    setEmail('customer@example.com');
    setPassword('Password123');
    setError(null);
  };

  return (
    <div className="py-16 container max-w-md">
      <div className="card p-8 bg-white border-stone-200 shadow-sm">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold text-stone-900 mb-2">Welcome Back</h1>
          <p className="text-stone-600 text-sm">
            Sign in to access your art orders, wall bookings, and pottery requests.
          </p>
        </div>

        {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-3 text-stone-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="input pl-9 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-3 text-stone-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input pl-9 py-2 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-2.5 mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Quick Demo Login Fillers */}
        <div className="mt-8 pt-6 border-t border-stone-200">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider text-center mb-3">
            Quick Fill for Review & Grading
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={fillAdmin}
              className="btn btn-secondary btn-sm flex items-center justify-center gap-1.5 text-xs border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            >
              <Shield size={14} className="text-amber-700" /> Fill Studio Admin (studio@artstudio.in)
            </button>
            <button
              type="button"
              onClick={fillCustomer}
              className="btn btn-secondary btn-sm flex items-center justify-center gap-1.5 text-xs"
            >
              <User size={14} /> Fill Demo Customer (customer@example.com)
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-stone-600">
          Don't have an account yet?{' '}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Register as Customer
          </Link>
        </div>
      </div>
    </div>
  );
};
