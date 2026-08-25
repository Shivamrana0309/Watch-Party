import { useRef, useState, useEffect } from "react";
import Draggable from "react-draggable";
import {
  Maximize,
  Minimize,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  FolderOpen,
  Copy,
  PhoneCall,
  PhoneOff,
  CheckCircle2,
  FileCheck,
  Play,
  Pause,
  User,
  Sun,
  Moon,
} from "lucide-react";
import useLocalVideoParty from "./hooks/useLocalVideoParty";
import { useCallContext } from "./context/CallContext";
import { useNavigate } from "react-router-dom";

export default function LocalVideoPartyRoom() {
  const navigate = useNavigate();
  const videoPlayerRef = useRef(null);
  const containerRef = useRef(null);
  const user1Ref = useRef(null);
  const user2Ref = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const volumeBarRef = useRef(null);

  const [cam1Pos, setCam1Pos] = useState({ x: 0, y: 0 });
  const [cam2Pos, setCam2Pos] = useState({ x: 0, y: 0 });
  const profileDropdownRef = useRef(null);

  const [showProfile, setShowProfile] = useState(false);
  const [userInfo, setUserInfo] = useState({ name: 'Guest User', username: '@guest' });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

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

  const {
    localStream,
    remoteStream,
    peerId,
    friendId,
    setFriendId,
    user1Media,
    user2Media,
    toggleLocalMic,
    toggleLocalCam,
    callFriend,
    acceptCall,
    rejectCall,
    leaveCall,
    incomingCall,
    callStatus,
    isConnected,
    activeRoomId,
    dataConnRef,
    subscribeToData,
    localVideoDOM,
    remoteVideoDOM,
  } = useCallContext();

  // Notice the updated destructured variables here to power the custom controls
  const {
    videoSrc,
    fileName,
    peerFileName,
    isFullscreen,
    isPlaying,
    currentTime,
    duration,
    handleFileSelect,
    handleReceiveData,
    togglePlayPause,
    handleSeek,
    toggleFullscreen,
  } = useLocalVideoParty({
    videoRef: videoPlayerRef,
    dataConnRef,
    containerRef,
  });

  const displayedRoomId = isConnected ? activeRoomId : peerId;

  // Stream playback logic - Append persistent DOM nodes
  useEffect(() => {
    if (localVideoRef.current && localVideoDOM) {
      localVideoRef.current.appendChild(localVideoDOM);
      localVideoDOM.className = `video-feed video-feed--local ${user1Media.cam ? "is-visible" : "is-hidden"}`;
      localVideoDOM.play().catch(() => {});
    }
  }, [localVideoDOM, user1Media.cam]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteVideoDOM) {
      remoteVideoRef.current.appendChild(remoteVideoDOM);
      remoteVideoDOM.className = `video-feed video-feed--remote ${user2Media.cam ? "is-visible" : "is-hidden"}`;
      remoteVideoDOM.play().catch(() => {});
    }
  }, [remoteVideoDOM, user2Media.cam]);

  // Subscribe to generic data for WatchPartyVideo sync
  useEffect(() => {
    const unsub = subscribeToData((data) => {
      handleReceiveData(data);
    });
    return unsub;
  }, [handleReceiveData, subscribeToData]);

  // Volume Bar Logic
  useEffect(() => {
    let audioContext, analyser, source, animationFrameId;
    if (localStream && user1Media.mic) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.smoothingTimeConstant = 0.7;
      analyser.fftSize = 256;

      source = audioContext.createMediaStreamSource(localStream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        if (volumeBarRef.current) volumeBarRef.current.style.height = `${Math.min(average * 1.5, 100)}%`;
        animationFrameId = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } else if (volumeBarRef.current) {
      volumeBarRef.current.style.height = "0%";
    }
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (audioContext && audioContext.state !== "closed") audioContext.close();
    };
  }, [localStream, user1Media.mic]);

  // Helper to format seconds into M:SS
  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const m = Math.floor(timeInSeconds / 60);
    const s = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="watch-party-room">
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
        body.dark-mode .video-surface > div {
          background-color: #1a1a1a !important;
        }
      `}</style>
      <div className="connection-row top-controls-row" style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '1600px', marginBottom: '0.25rem', alignItems: 'flex-end' }}>
        
        {/* Left: Buttons, Upload & File Names */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="action-area" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn-join" onClick={() => navigate('/party')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', width: '16px', height: '16px' }}>
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
                <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
              </svg>
              JOIN A PARTY
            </button>
            <button className="btn-join active">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', width: '16px', height: '16px' }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              SYNC LOCAL VIDEO
            </button>
            <button className="btn-join" onClick={() => navigate('/screen-share')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', width: '16px', height: '16px' }}>
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              SHARE SCREEN
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem', margin: 0, height: '52px', alignItems: 'center' }}>
            <label className="btn btn-join" style={{ 
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.5rem", 
              fontSize: '0.85rem', padding: '0.65rem 1.25rem', border: '1px solid #dbeafe', backgroundColor: '#eff6ff', boxShadow: '0 1px 2px rgba(0,0,0,0.06)', margin: 0, height: '100%'
            }}>
              <FolderOpen size={16} />
              UPLOAD VIDEO
              <input type="file" accept="video/*" onChange={handleFileSelect} style={{ display: "none" }} />
            </label>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: '100%', marginLeft: '0.5rem' }}>
              <div style={{ display: "flex", alignItems: "center", fontSize: "0.85rem", color: "#475569", whiteSpace: "nowrap", flex: 1 }}>
                <strong>Your File:</strong> &nbsp;{fileName || "None"}
              </div>
              <div style={{ display: "flex", alignItems: "center", fontSize: "0.85rem", color: "#16a34a", whiteSpace: "nowrap", flex: 1 }}>
                <strong>Friend's File:</strong> &nbsp;{peerFileName || "None"}
              </div>
            </div>
          </div>
        </div>

        {/* Middle: Room ID */}
        <div className="room-id-panel" style={{ flex: 1, margin: 0, height: '52px' }}>
          <span className="room-id-label" style={{ whiteSpace: 'nowrap' }}>
            {isConnected ? "Active Room ID:" : "Your Room ID:"}
          </span>
          <code className="room-id-code">{displayedRoomId || "Generating..."}</code>
          <button
            onClick={() => navigator.clipboard.writeText(displayedRoomId)}
            className="copy-id-btn"
            title="Copy Room ID"
          >
            <Copy size={16} />
          </button>
        </div>

        {/* Right: Friend Connect (with absolute positioned Profile & Theme Toggle above) */}
        <div className="friend-connect-panel" style={{ flex: 1, margin: 0, height: '52px', position: 'relative' }}>
          
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
                    window.location.href='/';
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
          ) : (
            <>
              <input
                type="text"
                placeholder="Paste Friend's ID here..."
                value={friendId}
                onChange={(e) => setFriendId(e.target.value)}
                className="friend-id-input"
                style={{ textTransform: "uppercase", height: '36px' }}
              />
              <button onClick={callFriend} className="connect-btn" style={{ whiteSpace: 'nowrap', height: '36px' }}>
                <PhoneCall size={16} />
                Connect
              </button>
            </>
          )}
        </div>
      </div>

      {callStatus && <div className="call-status-alert">{callStatus}</div>}

      {incomingCall && (
        <div className="incoming-call-modal">
          <span>Incoming request from: <strong>{incomingCall.callerId}</strong></span>
          <div className="incoming-call-actions">
            <button onClick={acceptCall} className="accept-btn">Accept</button>
            <button onClick={rejectCall} className="reject-btn">Reject</button>
          </div>
        </div>
      )}

      {/* Main Player & Draggable Feeds */}
      <div
        ref={containerRef}
        className={isFullscreen ? "video-shell is-fullscreen" : "video-shell"}
      >
        <div className={isFullscreen ? "player-panel is-fullscreen" : "player-panel"}>
          <div
            className="local-video-host"
            style={{ width: "100%", height: "100%", backgroundColor: isDarkMode ? '#1a1a1a' : '#000', position: "relative" }}
          >
            {videoSrc ? (
              <video
                ref={videoPlayerRef}
                src={videoSrc}
                playsInline
                onClick={togglePlayPause}
                style={{ width: "100%", height: "100%", objectFit: "contain", cursor: "pointer" }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  color: "#9ca3af",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <FolderOpen size={48} />
                <p>Please select a local video file above to start watching.</p>
              </div>
            )}
          </div>

          {/* CUSTOM SHARED CONTROLS OVERLAY */}
          <div 
            className="player-controls-overlay" 
            style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              gap: "1.5rem",
              background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)"
            }}
          >
            <div className="controls-click-target" style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1 }}>
              
              <button 
                onClick={togglePlayPause} 
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "white", display: "flex" }}
                disabled={!videoSrc}
              >
                {isPlaying ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" />}
              </button>

              <span style={{ color: "white", fontSize: "0.875rem", fontFamily: "monospace", minWidth: "80px" }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <input 
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={(e) => handleSeek(Number(e.target.value))}
                disabled={!videoSrc}
                style={{ flex: 1, cursor: "pointer", height: "4px", accentColor: "#2563eb" }}
              />
            </div>

            <div className="controls-click-target">
              <button onClick={toggleFullscreen} className="fullscreen-toggle" style={{ background: "transparent", border: "none", display: "flex" }}>
                {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Floating / Column Cameras */}
        <div className={isFullscreen ? "camera-column is-fullscreen" : "camera-column"}>
          {/* User 1: Local Stream */}
          <Draggable
            bounds="parent"
            nodeRef={user1Ref}
            disabled={!isFullscreen}
            position={isFullscreen ? cam1Pos : { x: 0, y: 0 }}
            onDrag={(e, data) => setCam1Pos({ x: data.x, y: data.y })}
          >
            <div
              ref={user1Ref}
              className={`video-card video-card--self ${isFullscreen ? "is-fullscreen" : "is-inline"}`}
            >
              <div className="video-surface">
                <div ref={localVideoRef} style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }} />
                {!user1Media.cam && (
                  <div className="waiting-overlay">
                    <VideoOff className="waiting-icon" />
                    <span className="waiting-text">Camera Off</span>
                  </div>
                )}
                <div className="participant-tag-wrap" style={{ zIndex: 30 }}>
                  <span className="participant-tag">You</span>
                  <div className="local-volume-meter">
                    <div ref={volumeBarRef} className="local-volume-fill" />
                  </div>
                </div>
              </div>
              <div className="media-controls">
                <button
                  onClick={toggleLocalMic}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`media-toggle-btn ${user1Media.mic ? "is-on" : "is-off"}`}
                  title={user1Media.mic ? "Mute Microphone" : "Unmute Microphone"}
                >
                  {user1Media.mic ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
                <button
                  onClick={toggleLocalCam}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`media-toggle-btn ${user1Media.cam ? "is-on" : "is-off"}`}
                  title={user1Media.cam ? "Turn Off Camera" : "Turn On Camera"}
                >
                  {user1Media.cam ? <VideoIcon size={18} /> : <VideoOff size={18} />}
                </button>
              </div>
            </div>
          </Draggable>

          {/* User 2: Friend Stream */}
          <Draggable
            bounds="parent"
            nodeRef={user2Ref}
            disabled={!isFullscreen}
            position={isFullscreen ? cam2Pos : { x: 0, y: 0 }}
            onDrag={(e, data) => setCam2Pos({ x: data.x, y: data.y })}
          >
            <div
              ref={user2Ref}
              className={`video-card video-card--friend ${isFullscreen ? "is-fullscreen" : "is-inline"}`}
            >
              <div className="video-surface video-surface--friend">
                <div ref={remoteVideoRef} style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }} />

                {!remoteStream && (
                  <div className="waiting-overlay">
                    <VideoOff className="waiting-icon" />
                    <span className="waiting-text">Waiting for friend...</span>
                  </div>
                )}
                {remoteStream && !user2Media.cam && (
                  <div className="waiting-overlay">
                    <VideoOff className="waiting-icon" />
                    <span className="waiting-text">Friend's camera is off</span>
                  </div>
                )}
                <div className="participant-tag-wrap participant-tag-wrap--friend">
                  <span className="participant-tag">Friend</span>
                </div>
              </div>
              <div className="media-controls media-controls--friend">
                <div
                  className={`media-indicator-badge ${user2Media.mic ? "is-on" : "is-off"}`}
                  title={user2Media.mic ? "Friend's Mic is On" : "Friend is Muted"}
                >
                  {user2Media.mic ? <Mic size={18} /> : <MicOff size={18} />}
                </div>
                <div
                  className={`media-indicator-badge ${user2Media.cam ? "is-on" : "is-off"}`}
                  title={user2Media.cam ? "Friend's Camera is On" : "Friend's Camera is Off"}
                >
                  {user2Media.cam ? <VideoIcon size={18} /> : <VideoOff size={18} />}
                </div>
              </div>
            </div>
          </Draggable>
        </div>
      </div>
    </div>
  );
}