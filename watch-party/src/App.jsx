import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import WatchPartyRoom from './WatchPartyRoom';
import LandingPage from './LandingPage';
import LoginPage from './LoginPage';
import SignupPage from './SignupPage';

// We put the routes inside a child component so we can use the 'useNavigate' hook!
function AppRoutes() {
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(true);

  // --- AUTO-LOGIN SESSION CHECK ---
  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem('token');

      // If there is no token saved, just finish verifying and let them stay where they are
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
          // Token is valid! Send them to the room if they are on the home or login page
          if (window.location.pathname === '/' || window.location.pathname === '/login') {
            navigate('/room');
          }
        } else {
          // Token is invalid or expired: clear it
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

  // Avoid flashing the wrong page while checking the stored token
  if (isVerifying) {
    return null;
  }

  return (
    <Routes>
      {/* Route 1: The Landing Page */}
      <Route 
        path="/" 
        element={
          <LandingPage 
            // onJoinParty={() => navigate('/room')} 
            onLoginClick={() => navigate('/login')}
            onSignupClick={() => navigate('/signup')}
          />
        } 
      />

      {/* Route 2: The Login Page */}
      <Route 
        path="/login" 
        element={
          <LoginPage 
            onLoginSuccess={() => navigate('/room')}
            onNavigateSignup={() => navigate('/signup')}
          />
        } 
      />

      {/* Route 3: The Signup Page */}
      <Route 
        path="/signup" 
        element={
          <SignupPage 
            onSignupSuccess={() => navigate('/login')}
            onNavigateLogin={() => navigate('/login')}
          />
        } 
      />

      {/* Route 4: The Watch Party Room */}
      <Route 
        path="/room" 
        element={
          <div className="min-h-screen bg-white py-10">
            <WatchPartyRoom />
          </div>
        } 
      />
    </Routes>
  );
}

// The main App component wraps everything in the BrowserRouter
export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}