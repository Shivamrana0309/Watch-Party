import React from 'react';
import './LandingPage.css';

export default function LandingPage({ 
  onLoginClick, 
  onSignupClick, 
  onJoinPartyClick,
  onScreenShareClick, 
  onLocalSyncClick,
  onWebRTCWatchPartyClick
}) {
  return (
    <div className="landing-body">
      <div className="landing-container">
        <nav className="navbar">
          <div className="nav-left">
            <div className="logo"></div>
            <div className="nav-links">
              <a href="#">Products</a>
              <a href="#">App</a>
              <a href="#">About</a>
              <a href="#">FAQ</a>
            </div>
          </div>
          <div className="nav-right">
            <button className="btn btn-login" onClick={onLoginClick}>LOG IN</button>
            <button className="btn btn-signup" onClick={onSignupClick}>SIGN UP</button>
          </div>
        </nav>

        <main className="bento-grid">
          <div className="bento-card dark-card">
            <div>
              <div className="small-text" style={{ color: '#888' }}>
                Synchronized Viewing Platform
              </div>
              <h1>Connect. Sync.<br />And watch<br />together.</h1>
            </div>
            
            <div className="dark-card-graphics"></div>

            <div className="action-area" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-join" onClick={onJoinPartyClick}>
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                JOIN A PARTY
              </button>
              
              <button className="btn btn-join" onClick={onLocalSyncClick} style={{ backgroundColor: '#2563eb' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                SYNC LOCAL VIDEO
              </button>

              <button className="btn btn-join" onClick={onScreenShareClick}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
                SHARE SCREEN
              </button>

              <button className="btn btn-join" onClick={onWebRTCWatchPartyClick} style={{ backgroundColor: '#8b5cf6' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
                WEBRTC PARTY
              </button>
            </div>
          </div>

          <div className="right-column">
            <div className="bento-card blog-card">
              <div className="small-text">Streaming Community Insights</div>
              <h2>View our blog</h2>
              <div className="planet-large"></div>
              <div className="planet-small"></div>
              <svg className="icon-top-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17L17 7M17 7H7M17 7V17" />
              </svg>
            </div>

            <div className="bottom-row">
              <div className="bento-card info-card purple-card">
                <div className="small-text">Discover<br />Our Vision</div>
                <h2>About us</h2>
                <svg className="icon-top-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </div>

              <div className="bento-card info-card green-card">
                <div className="small-text">Support Team<br />On Standby</div>
                <h2>Contact us</h2>
                <svg className="icon-top-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                </svg>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}