import React, { useState, useEffect, useRef } from "react";
import {
  Copy,
  PhoneCall,
  PhoneOff,
  CheckCircle2,
  User,
  Sun,
  Moon,
} from "lucide-react";

/**
 * Shared header for all room components.
 *
 * Consolidates: dark-mode toggle, user info fetch, profile dropdown,
 * navigation buttons, room ID panel, friend connect panel, call status alert,
 * and the dark-mode <style> block.
 */
export default function RoomHeader({
  activeTab,         // 'party' | 'local-sync' | 'screen-share' | 'watch-party'
  navigate,          // useNavigate() or (path) => window.location.href = path
  peerId,
  isConnected,
  activeRoomId,
  friendId,
  setFriendId,
  callFriend,
  leaveCall,
  callStatus,
  customActionWidget, // ReactNode — room-specific controls below nav buttons
  extraDarkModeCSS = "", // Additional dark-mode CSS rules (e.g. .url-input styles)
  friendIdDisabled,   // explicit disabled check for connect button; defaults to !friendId.trim()
  friendIdUppercase = true, // whether to uppercase the friend ID on change
}) {
  // ── Dark Mode ──
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  // ── User Info ──
  const [userInfo, setUserInfo] = useState({ name: 'Guest User', username: '@guest' });
  const [showProfile, setShowProfile] = useState(false);
  const profileDropdownRef = useRef(null);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch('https://watch-party-74e5.onrender.com/api/verify', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.valid && data.user) {
            setUserInfo({
              name: data.user.name || 'Guest User',
              username: `@${data.user.username}`
            });
          }
        }
      } catch (e) {
        console.error("Failed to fetch user:", e);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Derived state ──
  const displayedRoomId = isConnected ? activeRoomId : peerId;
  const isCalling = callStatus === 'Ringing...';
  const connectDisabled = friendIdDisabled !== undefined ? friendIdDisabled : !friendId.trim();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(displayedRoomId);
  };

  // Navigation button definitions — order matches all room files
  const navButtons = [
    {
      key: 'party',
      label: 'JOIN A PARTY',
      path: '/party',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', width: '16px', height: '16px' }}>
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
          <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
        </svg>
      ),
    },
    {
      key: 'local-sync',
      label: 'SYNC LOCAL VIDEO',
      path: '/local-sync',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', width: '16px', height: '16px' }}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      ),
    },
    {
      key: 'screen-share',
      label: 'SHARE SCREEN',
      path: '/screen-share',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', width: '16px', height: '16px' }}>
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
      ),
    },
    {
      key: 'watch-party',
      label: 'WEBRTC PARTY',
      path: '/watch-party',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', width: '16px', height: '16px' }}>
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>
      ),
    },
  ];

  return (
    <>
      <style>{`
        body.dark-mode {
          background-color: #121212 !important;
          color: #e5e5e5 !important;
        }
        body.dark-mode .watch-party-room {
          background-color: #121212 !important;
        }
        body.dark-mode button.btn-join, body.dark-mode .connect-btn {
          background-color: #1f2937 !important;
          color: #e5e5e5 !important;
          border-color: #374151 !important;
        }
        body.dark-mode button.btn-join.active {
          background-color: #2563eb !important;
          color: #ffffff !important;
          border-color: #1d4ed8 !important;
        }
        body.dark-mode .room-id-panel, body.dark-mode .friend-connect-panel, body.dark-mode .connected-panel-wrap {
          background-color: #1e1e1e !important;
          border-color: #333 !important;
          color: #e5e5e5 !important;
        }
        body.dark-mode .room-id-label, body.dark-mode .room-id-code, body.dark-mode .friend-id-input {
          color: #e5e5e5 !important;
          background-color: transparent !important;
        }
        body.dark-mode .friend-id-input {
          background-color: #1f2937 !important;
          border-color: #374151 !important;
        }
        body.dark-mode .player-panel {
          background-color: #1a1a1a !important;
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.8) !important;
        }
        ${extraDarkModeCSS}
      `}</style>

      <div className="connection-row top-controls-row" style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '1600px', marginBottom: '0.25rem', alignItems: 'flex-end' }}>
        {/* Left: Nav Buttons + Custom Action Widget */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="action-area" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap', width: '100%' }}>
            {navButtons.map((btn) => {
              const isActive = btn.key === activeTab;
              return (
                <button
                  key={btn.key}
                  className={`btn-join${isActive ? ' active' : ''}`}
                  onClick={isActive ? undefined : () => navigate(btn.path)}
                  style={{ flex: 1, whiteSpace: 'nowrap', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0.65rem 0.5rem' }}
                >
                  {btn.icon}
                  {btn.label}
                </button>
              );
            })}
          </div>

          {/* Room-specific action widget */}
          {customActionWidget}
        </div>

        {/* Middle: Room ID */}
        <div className="room-id-panel" style={{ flex: 1, margin: 0, height: '52px', display: 'flex', alignItems: 'center', boxSizing: 'border-box' }}>
          <span className="room-id-label" style={{ whiteSpace: 'nowrap' }}>
            {isConnected ? "Active Room ID:" : "Your Room ID:"}
          </span>
          <code className="room-id-code">{displayedRoomId || "Generating..."}</code>
          <button onClick={copyToClipboard} className="copy-id-btn" title="Copy Room ID">
            <Copy size={16} />
          </button>
        </div>

        {/* Right: Friend Connect Panel */}
        <div className="friend-connect-panel" style={{ flex: 1, margin: 0, height: '52px', position: 'relative', display: 'flex', alignItems: 'center', boxSizing: 'border-box' }}>
          {/* Theme + Profile toggles (absolutely positioned above) */}
          <div style={{ position: 'absolute', top: '-60px', right: '0', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {/* Theme Toggle Switch */}
            <div
              onClick={() => setIsDarkMode(!isDarkMode)}
              style={{
                width: '64px', height: '38px', borderRadius: '19px',
                backgroundColor: isDarkMode ? '#374151' : '#cbd5e1',
                display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative',
                transition: 'background-color 0.3s',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'absolute', left: isDarkMode ? '29px' : '3px', transition: 'left 0.3s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}>
                {isDarkMode ? <Moon size={18} color="#000" /> : <Sun size={18} color="#000" />}
              </div>
            </div>

            {/* Profile Dropdown */}
            <div ref={profileDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowProfile(!showProfile)}
                style={{
                  width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}
              >
                <User size={18} color="#475569" />
              </button>

              {showProfile && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem',
                  backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                  width: '180px', padding: '1rem', zIndex: 50,
                  display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{userInfo.name}</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{userInfo.username}</span>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }} />
                  <button
                    onClick={() => {
                      localStorage.removeItem('token');
                      window.location.href = '/';
                    }}
                    style={{
                      backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '0.25rem',
                      padding: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500, width: '100%'
                    }}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Connection state: Connected / Calling / Input */}
          {isConnected ? (
            <div className="connected-panel-wrap">
              <div className="connected-badge" style={{ whiteSpace: 'nowrap' }}>
                <CheckCircle2 size={18} className="text-green-600" />
                <span>Connected in Room <strong>{activeRoomId}</strong></span>
              </div>
              <button onClick={leaveCall} className="leave-btn" title="Leave Call">
                <PhoneOff size={16} />
                Leave Call
              </button>
            </div>
          ) : isCalling ? (
            <div className="connected-panel-wrap">
              <div className="connected-badge" style={{ whiteSpace: 'nowrap', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                <PhoneCall size={18} className="animate-pulse" />
                <span>Calling <strong>{friendId}</strong>...</span>
              </div>
              <button onClick={leaveCall} className="leave-btn" style={{ backgroundColor: '#ef4444' }} title="Cancel Call">
                <PhoneOff size={16} />
                Cancel
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Paste Friend's ID here..."
                value={friendId}
                onChange={(e) => setFriendId(friendIdUppercase ? e.target.value.toUpperCase() : e.target.value)}
                className="friend-id-input"
                style={{ textTransform: "uppercase", height: '36px' }}
              />
              <button onClick={callFriend} disabled={connectDisabled} className="connect-btn" style={{ whiteSpace: 'nowrap', height: '36px' }}>
                <PhoneCall size={16} />
                Connect
              </button>
            </>
          )}
        </div>
      </div>

      {callStatus && <div className="call-status-alert">{callStatus}</div>}
    </>
  );
}
