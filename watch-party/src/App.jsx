import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import WatchPartyRoom from './WatchPartyRoom';
import ScreenShareRoom from './ScreenShareRoom'; // <-- Import the new room
import LandingPage from './LandingPage';
import LoginPage from './LoginPage';
import SignupPage from './SignupPage';

function AppRoutes() {
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsVerifying(false);
        return;
      }
      try {
        const response = await fetch('https://watch-party-74e5.onrender.com/api/verify', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          if (window.location.pathname === '/' || window.location.pathname === '/login') {
            navigate('/room');
          }
        } else {
          localStorage.removeItem('token');
        }
      } catch (error) {
        console.error('Session verification failed:', error);
      } finally {
        setIsVerifying(false);
      }
    };
    verifySession();
  }, [navigate]);

  if (isVerifying) return null;

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          <LandingPage 
            onLoginClick={() => navigate('/login')}
            onSignupClick={() => navigate('/signup')}
            onScreenShareClick={() => navigate('/screen-share')} // <-- Provide navigation prop
          />
        } 
      />
      <Route 
        path="/login" 
        element={<LoginPage onLoginSuccess={() => navigate('/room')} onNavigateSignup={() => navigate('/signup')} />} 
      />
      <Route 
        path="/signup" 
        element={<SignupPage onSignupSuccess={() => navigate('/login')} onNavigateLogin={() => navigate('/login')} />} 
      />
      <Route 
        path="/room" 
        element={<div className="min-h-screen bg-white py-10"><WatchPartyRoom /></div>} 
      />
      {/* Route 5: The new Screen Share Room */}
      <Route 
        path="/screen-share" 
        element={<div className="min-h-screen bg-white py-10"><ScreenShareRoom /></div>} 
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}