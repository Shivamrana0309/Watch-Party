import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import YouTubeRoom from './pages/YouTubeRoom';
import ScreenShareRoom from './pages/ScreenShareRoom';
import LocalSyncRoom from './pages/LocalSyncRoom'; 
import WebRTCRoom from './pages/WebRTCRoom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import { CallProvider } from './context/CallContext';
import { Outlet } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import NotFoundPage from './pages/NotFoundPage';

function RoomLayout() {
  return (
    <CallProvider>
      <Outlet />
    </CallProvider>
  );
}

function AppRoutes() {
  const navigate = useNavigate();

  const handleActionNavigation = async (path) => {
    const token = localStorage.getItem('token');
    if (!token) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/guest-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (response.ok) {
          const data = await response.json();
          localStorage.setItem('token', data.token);
        }
      } catch (error) {
        console.error("Auto guest login failed:", error);
      }
    }
    navigate(path);
  };

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          <LandingPage 
            onLoginClick={() => navigate('/login')}
            onSignupClick={() => navigate('/signup')}
            onJoinPartyClick={() => handleActionNavigation('/party')}
            onScreenShareClick={() => handleActionNavigation('/screen-share')}
            onLocalSyncClick={() => handleActionNavigation('/local-sync')} 
            onWebRTCWatchPartyClick={() => handleActionNavigation('/watch-party')}
          />
        } 
      />
      <Route path="/login" element={<LoginPage onLoginSuccess={() => navigate('/party')} onNavigateSignup={() => navigate('/signup')} />} />
      <Route path="/signup" element={<SignupPage onSignupSuccess={() => navigate('/login')} onNavigateLogin={() => navigate('/login')} />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<RoomLayout />}>
          <Route path="/party/:roomId?" element={<div className="min-h-screen bg-white py-10"><YouTubeRoom /></div>} />
          <Route path="/screen-share/:roomId?" element={<div className="min-h-screen bg-white py-10"><ScreenShareRoom /></div>} />
          <Route path="/local-sync/:roomId?" element={<div className="min-h-screen bg-white py-10"><LocalSyncRoom /></div>} />
          <Route path="/watch-party/:roomId?" element={<div className="min-h-screen bg-gray-50 py-10"><WebRTCRoom /></div>} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
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