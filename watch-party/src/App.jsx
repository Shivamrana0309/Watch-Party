import { useState } from 'react'
import WatchPartyRoom from './WatchPartyRoom'
import LandingPage from './LandingPage'
import LoginPage from './LoginPage'
import SignupPage from './SignupPage'

function App() {
  const [currentView, setCurrentView] = useState('landing') 

  return (
    <>
      {currentView === 'landing' && (
        <LandingPage 
          onJoinParty={() => setCurrentView('room')} 
          onLoginClick={() => setCurrentView('login')}
          onSignupClick={() => setCurrentView('signup')} // Wire this up in LandingPage.jsx!
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