import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorAlert } from '../components/ErrorAlert.js';
import { User, Mail, Lock, ShieldCheck } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-16 container max-w-md">
      <div className="card p-8 bg-white border-stone-200 shadow-sm">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold text-stone-900 mb-2">Create Customer Account</h1>
          <p className="text-stone-600 text-sm">
            Join Varnika Art Studio to collect original paintings, commission murals, and order custom pottery.
          </p>
        </div>

        {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
              Full Name
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-3 text-stone-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Priya Sharma"
                required
                className="input pl-9 py-2 text-sm"
              />
            </div>
          </div>

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
                placeholder="priya@example.com"
                required
                className="input pl-9 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1">
              Password (min 6 characters)
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-3 text-stone-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="input pl-9 py-2 text-sm"
              />
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded border border-stone-200 text-xs text-stone-600 flex items-start gap-2">
            <ShieldCheck size={16} className="text-primary flex-shrink-0 mt-0.5" />
            <span>
              All registered users receive the <strong>Customer</strong> role. Studio administrator access is reserved and pre-seeded.
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-2.5 mt-2"
          >
            {loading ? 'Creating Account...' : 'Complete Registration'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-stone-600 border-t border-stone-200 pt-6">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
};
