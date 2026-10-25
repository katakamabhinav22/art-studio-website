import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Palette, LogOut, User, Shield, Menu, X } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAdmin, isCustomer, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
      <div className="container flex items-center justify-between py-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 text-stone-900 group">
          <div className="p-2 bg-primary-light text-primary rounded-lg group-hover:bg-primary group-hover:text-white transition">
            <Palette size={24} />
          </div>
          <div>
            <span className="font-serif text-xl font-bold tracking-tight block leading-tight">Varnika</span>
            <span className="text-xs uppercase tracking-widest text-stone-500 block font-semibold">Art Studio</span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-700">
          <Link
            to="/paintings"
            className={`hover:text-primary transition pb-1 ${isActive('/paintings') ? 'text-primary font-semibold border-b-2 border-primary' : ''}`}
          >
            Paintings Catalogue
          </Link>
          <Link
            to="/wall-booking"
            className={`hover:text-primary transition pb-1 ${isActive('/wall-booking') ? 'text-primary font-semibold border-b-2 border-primary' : ''}`}
          >
            Wall Murals
          </Link>
          <Link
            to="/custom-pottery"
            className={`hover:text-primary transition pb-1 ${isActive('/custom-pottery') ? 'text-primary font-semibold border-b-2 border-primary' : ''}`}
          >
            Custom Pottery
          </Link>
        </nav>

        {/* User Auth Controls */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              {isAdmin ? (
                <Link
                  to="/admin"
                  className="btn btn-secondary btn-sm flex items-center gap-1.5 border-primary text-primary font-semibold"
                >
                  <Shield size={16} /> Admin Dashboard
                </Link>
              ) : (
                <Link
                  to="/dashboard"
                  className="btn btn-secondary btn-sm flex items-center gap-1.5"
                >
                  <User size={16} /> My Dashboard
                </Link>
              )}

              <div className="text-xs text-right mr-1">
                <div className="font-semibold text-stone-800">{user.name}</div>
                <div className="text-stone-500 uppercase tracking-wider text-[10px]">
                  {isAdmin ? 'Studio Admin' : 'Customer'}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="btn btn-outline btn-sm text-stone-600 hover:text-red-700 hover:border-red-600 p-2"
                title="Log out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn btn-secondary btn-sm">
                Log In
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-stone-700 hover:text-primary"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-stone-200 bg-white px-4 py-4 flex flex-col gap-3">
          <Link
            to="/paintings"
            onClick={() => setMobileMenuOpen(false)}
            className="py-2 text-stone-700 hover:text-primary font-medium"
          >
            Paintings Catalogue
          </Link>
          <Link
            to="/wall-booking"
            onClick={() => setMobileMenuOpen(false)}
            className="py-2 text-stone-700 hover:text-primary font-medium"
          >
            Wall Murals
          </Link>
          <Link
            to="/custom-pottery"
            onClick={() => setMobileMenuOpen(false)}
            className="py-2 text-stone-700 hover:text-primary font-medium"
          >
            Custom Pottery
          </Link>

          <hr className="my-1 border-stone-200" />

          {user ? (
            <div className="flex flex-col gap-2">
              <div className="text-xs text-stone-500">
                Signed in as <span className="font-semibold text-stone-800">{user.name}</span> ({user.role})
              </div>
              {isAdmin ? (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-primary btn-sm w-full text-center"
                >
                  Admin Dashboard
                </Link>
              ) : (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-primary btn-sm w-full text-center"
                >
                  My Dashboard
                </Link>
              )}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="btn btn-secondary btn-sm w-full text-center text-red-600"
              >
                Log Out
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="btn btn-secondary btn-sm flex-1 text-center"
              >
                Log In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="btn btn-primary btn-sm flex-1 text-center"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
