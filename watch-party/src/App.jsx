import React, { useState, useEffect } from 'react'
import WatchPartyRoom from './WatchPartyRoom'
import LandingPage from './LandingPage'
import LoginPage from './LoginPage'
import SignupPage from './SignupPage'

function App() {
  const [currentView, setCurrentView] = useState('landing')
  const [isVerifying, setIsVerifying] = useState(true)

  // --- AUTO-LOGIN SESSION CHECK ---
  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem('token')

      // If there is no token saved, stay on the landing page
      if (!token) {
        setIsVerifying(false)
        return
      }

      try {
        const response = await fetch('https://watch-party-74e5.onrender.com/api/verify', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`, // Pass the JWT token to the backend
          },
        })

        if (response.ok) {
          // Token is valid: route directly into the room
          setCurrentView('room')
        } else {
          // Token is invalid or expired: clear it and show landing page
          localStorage.removeItem('token')
          setCurrentView('landing')
        }
      } catch (error) {
        console.error('Session verification failed:', error)
        setCurrentView('landing')
      } finally {
        setIsVerifying(false)
      }
    }

    verifySession()
  }, [])

  // Avoid flashing the Landing Page while verifying the stored token
  if (isVerifying) {
    return null
  }

  return (
    <>
      {currentView === 'landing' && (
        <LandingPage 
          onJoinParty={() => setCurrentView('room')} 
          onLoginClick={() => setCurrentView('login')}
          onSignupClick={() => setCurrentView('signup')}
        />
      )}

      {currentView === 'login' && (
        <LoginPage 
          onLoginSuccess={() => setCurrentView('room')}
          onNavigateSignup={() => setCurrentView('signup')}
        />
      )}

      {currentView === 'signup' && (
        <SignupPage 
          onSignupSuccess={() => setCurrentView('login')}
          onNavigateLogin={() => setCurrentView('login')}
        />
      )}

      {currentView === 'room' && (
        <div className="min-h-screen bg-white py-10">
          <WatchPartyRoom />
        </div>
      )}
    </>
  )
}

export default App