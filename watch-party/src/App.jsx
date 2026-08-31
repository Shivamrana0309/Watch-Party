import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import WatchPartyRoom from './WatchPartyRoom';
import WatchPartyRoomRefactored from './WatchPartyRoomRefactored';
import ScreenShareRoom from './ScreenShareRoom';
import LocalVideoPartyRoom from './LocalVideoPartyRoom'; 
import WebRTCWatchParty from './WebRTCWatchParty';
import LandingPage from './LandingPage';
import LoginPage from './LoginPage';
import SignupPage from './SignupPage';
import { CallProvider } from './context/CallContext';
import { Outlet } from 'react-router-dom';

function RoomLayout() {
  return (
    <CallProvider>
      <Outlet />
    </CallProvider>
  );
}

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
            onJoinPartyClick={() => navigate('/party')}
            onScreenShareClick={() => navigate('/screen-share')}
            onLocalSyncClick={() => navigate('/local-sync')} 
            onWebRTCWatchPartyClick={() => navigate('/watch-party')}
          />
        } 
      />
      <Route path="/login" element={<LoginPage onLoginSuccess={() => navigate('/room')} onNavigateSignup={() => navigate('/signup')} />} />
      <Route path="/signup" element={<SignupPage onSignupSuccess={() => navigate('/login')} onNavigateLogin={() => navigate('/login')} />} />
      <Route element={<RoomLayout />}>
        <Route path="/room" element={<div className="min-h-screen bg-white py-10"><WatchPartyRoom /></div>} />
        <Route path="/party" element={<div className="min-h-screen bg-white py-10"><WatchPartyRoomRefactored /></div>} />
        <Route path="/screen-share" element={<div className="min-h-screen bg-white py-10"><ScreenShareRoom /></div>} />
        <Route path="/local-sync" element={<div className="min-h-screen bg-white py-10"><LocalVideoPartyRoom /></div>} />
        <Route path="/watch-party" element={<div className="min-h-screen bg-gray-50 py-10"><WebRTCWatchParty /></div>} />
      </Route>
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