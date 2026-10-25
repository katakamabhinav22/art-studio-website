import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { Footer } from './components/Footer.js';
import { HomePage } from './pages/HomePage.js';
import { PaintingsPage } from './pages/PaintingsPage.js';
import { WallBookingPage } from './pages/WallBookingPage.js';
import { PotteryRequestPage } from './pages/PotteryRequestPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { CustomerDashboardPage } from './pages/CustomerDashboardPage.js';
import { AdminDashboardPage } from './pages/AdminDashboardPage.js';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/paintings" element={<PaintingsPage />} />
              <Route path="/wall-booking" element={<WallBookingPage />} />
              <Route path="/custom-pottery" element={<PotteryRequestPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/dashboard" element={<CustomerDashboardPage />} />
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route
                path="*"
                element={
                  <div className="py-20 text-center container">
                    <h2 className="font-serif text-3xl font-bold text-stone-900 mb-2">Page Not Found</h2>
                    <p className="text-stone-600 mb-6">The page you are looking for does not exist.</p>
                    <Link to="/" className="btn btn-primary">
                      Return Home
                    </Link>
                  </div>
                }
              />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
