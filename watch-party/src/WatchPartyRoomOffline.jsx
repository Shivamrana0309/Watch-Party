import { useRef, useState } from "react";
import Draggable from "react-draggable";
import YouTube from "react-youtube";
import {
  Maximize,
  Minimize,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Link,
  Copy,
  PhoneCall,
  PhoneOff,
  CheckCircle2,
} from "lucide-react";

import "./LandingPage.css"; // Ensure btn styles are available

export default function WatchPartyRoomOffline() {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const user1Ref = useRef(null);
  const user2Ref = useRef(null);
  
  const [inputUrl, setInputUrl] = useState("");
  const [videoId, setVideoId] = useState("dQw4w9WgXcQ");
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [cam1Pos, setCam1Pos] = useState({ x: 0, y: 0 });
  const [cam2Pos, setCam2Pos] = useState({ x: 0, y: 0 });

  const [user1Media, setUser1Media] = useState({ mic: true, cam: true });
  const [user2Media, setUser2Media] = useState({ mic: true, cam: true });
  
  const [friendId, setFriendId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const activeRoomId = "OFFLINE-MODE";
  const displayedRoomId = "YOUR-ID-123";
  
  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (inputUrl) {
      let vId = inputUrl;
      if (inputUrl.includes("v=")) {
        vId = inputUrl.split("v=")[1].substring(0, 11);
      } else if (inputUrl.includes("youtu.be/")) {
        vId = inputUrl.split("youtu.be/")[1].substring(0, 11);
      }
      setVideoId(vId);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const toggleLocalMic = () => setUser1Media(prev => ({ ...prev, mic: !prev.mic }));
  const toggleLocalCam = () => setUser1Media(prev => ({ ...prev, cam: !prev.cam }));

  const callFriend = () => {
    if(friendId) setIsConnected(true);
  };
  const leaveCall = () => {
    setIsConnected(false);
    setFriendId("");
  };

  return (
    <div className="watch-party-room">
      <div className="connection-row top-controls-row" style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '1600px', marginBottom: '0.25rem', alignItems: 'flex-end' }}>
        
        {/* Left: Buttons + YouTube URL */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="action-area" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-join" onClick={() => window.location.href='/room'} style={{ 
              fontSize: '0.85rem', 
              padding: '0.65rem 1.25rem',
              border: '1px solid #dbeafe', 
              backgroundColor: '#eff6ff', 
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
            }}>
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              JOIN A PARTY
            </button>
            <button className="btn btn-join" onClick={() => window.location.href='/local-sync'} style={{ 
              backgroundColor: '#2563eb', 
              color: '#fff', 
              fontSize: '0.85rem', 
              padding: '0.65rem 1.25rem',
              border: '1px solid #2563eb',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              SYNC LOCAL VIDEO
            </button>
            <button className="btn btn-join" onClick={() => window.location.href='/screen-share'} style={{ 
              fontSize: '0.85rem', 
              padding: '0.65rem 1.25rem',
              border: '1px solid #dbeafe', 
              backgroundColor: '#eff6ff', 
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              SHARE SCREEN
            </button>
          </div>
          <form onSubmit={handleUrlSubmit} className="watch-party-form" style={{ margin: 0, padding: 0 }}>
            <div className="url-input-wrap">
              <div className="url-input-icon">
                <Link size={20} className="url-input-icon-svg" />
              </div>
              <input
                type="text"
                placeholder="Paste YouTube URL here..."
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="url-input"
                style={{ height: '52px' }}
              />
            </div>
            <button type="submit" className="load-video-btn" style={{ height: '52px' }}>
              Load Video
            </button>
          </form>
        </div>

        {/* Middle: Room ID */}
        <div className="room-id-panel" style={{ flex: 1, margin: 0, height: '52px' }}>
          <span className="room-id-label" style={{ whiteSpace: 'nowrap' }}>
            {isConnected ? "Active Room ID:" : "Your Room ID:"}
          </span>
          <code className="room-id-code">{isConnected ? activeRoomId : displayedRoomId}</code>
          <button
            onClick={() => navigator.clipboard.writeText(isConnected ? activeRoomId : displayedRoomId)}
            className="copy-id-btn"
            title="Copy Room ID"
          >
            <Copy size={16} />
          </button>
        </div>

        {/* Right: Friend Connect */}
        <div className="friend-connect-panel" style={{ flex: 1, margin: 0, height: '52px' }}>
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

      <div
        ref={containerRef}
        className={isFullscreen ? "video-shell is-fullscreen" : "video-shell"}
      >
        <div className={isFullscreen ? "player-panel is-fullscreen" : "player-panel"}>
          <div className="youtube-host">
            <YouTube
              videoId={videoId}
              ref={playerRef}
              opts={{
                width: "100%",
                height: "100%",
                playerVars: { autoplay: 0, modestbranding: 1, rel: 0, fs: 0 },
              }}
              className="youtube-iframe"
              iframeClassName="youtube-iframe"
            />
          </div>
          <div className="player-controls-overlay">
            <div className="controls-click-target">
              <button onClick={toggleFullscreen} className="fullscreen-toggle">
                {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
              </button>
            </div>
          </div>
        </div>

        <div
          className={
            isFullscreen ? "camera-column is-fullscreen" : "camera-column"
          }
        >
          {/* Local Feed */}
          <Draggable
            bounds="parent"
            nodeRef={user1Ref}
            disabled={!isFullscreen}
            position={isFullscreen ? cam1Pos : { x: 0, y: 0 }}
            onDrag={(e, data) => setCam1Pos({ x: data.x, y: data.y })}
          >
            <div
              ref={user1Ref}
              className={`video-card video-card--self ${
                isFullscreen ? "is-fullscreen" : "is-inline"
              }`}
            >
              <div className="video-surface">
                {/* Dummy video surface */}
                <div style={{width: "100%", height: "100%", backgroundColor: "#333", borderRadius: "12px"}} />
                {!user1Media.cam && <VideoOff className="video-off-icon" />}
                <div className="participant-tag-wrap">
                  <span className="participant-tag">You</span>
                </div>
              </div>
              <div className="media-controls">
                <button
                  onClick={toggleLocalMic}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`media-toggle-btn ${
                    user1Media.mic ? "is-on" : "is-off"
                  }`}
                  title={user1Media.mic ? "Mute Microphone" : "Unmute Microphone"}
                >
                  {user1Media.mic ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
                <button
                  onClick={toggleLocalCam}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`media-toggle-btn ${
                    user1Media.cam ? "is-on" : "is-off"
                  }`}
                  title={user1Media.cam ? "Turn Off Camera" : "Turn On Camera"}
                >
                  {user1Media.cam ? <Video size={18} /> : <VideoOff size={18} />}
                </button>
              </div>
            </div>
          </Draggable>

          {/* Friend Feed */}
          <Draggable
            bounds="parent"
            nodeRef={user2Ref}
            disabled={!isFullscreen}
            position={isFullscreen ? cam2Pos : { x: 0, y: 0 }}
            onDrag={(e, data) => setCam2Pos({ x: data.x, y: data.y })}
          >
            <div
              ref={user2Ref}
              className={`video-card video-card--friend ${
                isFullscreen ? "is-fullscreen" : "is-inline"
              }`}
            >
              <div className="video-surface video-surface--friend">
                 {/* Dummy video surface */}
                 <div style={{width: "100%", height: "100%", backgroundColor: "#333", borderRadius: "12px"}} />
                
                {!isConnected && (
                  <div className="waiting-overlay">
                    <VideoOff className="waiting-icon" />
                    <span className="waiting-text">Waiting for friend...</span>
                  </div>
                )}

                {isConnected && !user2Media.cam && (
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
                  className={`media-indicator-badge ${
                    user2Media.mic ? "is-on" : "is-off"
                  }`}
                  title={user2Media.mic ? "Friend's Mic is On" : "Friend is Muted"}
                >
                  {user2Media.mic ? <Mic size={18} /> : <MicOff size={18} />}
                </div>
                <div
                  className={`media-indicator-badge ${
                    user2Media.cam ? "is-on" : "is-off"
                  }`}
                  title={user2Media.cam ? "Friend's Camera is On" : "Friend's Camera is Off"}
                >
                  {user2Media.cam ? <Video size={18} /> : <VideoOff size={18} />}
                </div>
              </div>
            </div>
          </Draggable>
        </div>
      </div>
    </div>
  );
}
