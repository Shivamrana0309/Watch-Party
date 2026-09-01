import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import YouTube from "react-youtube";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Link,
} from "lucide-react";

import "./LandingPage.css"; // Ensure btn styles are available
import RoomHeader from "./components/RoomHeader";
import DraggableVideoFeeds from "./components/DraggableVideoFeeds";

export default function OfflineRoom() {
  const navigate = useNavigate();
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const user1Ref = useRef(null);
  const user2Ref = useRef(null);

  const [inputUrl, setInputUrl] = useState("");
  const [videoId, setVideoId] = useState("dQw4w9WgXcQ");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [cam1Pos, setCam1Pos] = useState({ x: 0, y: 0 });
  const [cam2Pos, setCam2Pos] = useState({ x: 0, y: 0 });

  const [user1Media] = useState({ mic: false, cam: false });
  const [user2Media] = useState({ mic: true, cam: true });

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

  const callFriend = () => {
    if (friendId) setIsConnected(true);
  };
  const leaveCall = () => {
    setIsConnected(false);
    setFriendId("");
  };



  const EXTRA_DARK_CSS = `
    body.dark-mode .load-video-btn {
      background-color: #1f2937 !important;
      color: #e5e5e5 !important;
      border-color: #374151 !important;
    }
    body.dark-mode .url-input {
      background-color: #1f2937 !important;
      color: #e5e5e5 !important;
      border-color: #374151 !important;
    }
  `;

  return (
    <div className="watch-party-room">
      <RoomHeader
        activeTab="offline"
        navigate={navigate}
        peerId={displayedRoomId}
        isConnected={isConnected}
        activeRoomId={activeRoomId}
        friendId={friendId}
        setFriendId={setFriendId}
        callFriend={callFriend}
        leaveCall={leaveCall}
        callStatus={null}
        extraDarkModeCSS={EXTRA_DARK_CSS}
        customActionWidget={
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
        }
      />

      <div
        ref={containerRef}
        className={isFullscreen ? "video-shell is-fullscreen" : "video-shell"}
      >
        <div className={isFullscreen ? "player-panel is-fullscreen" : "player-panel"}>
          <div className="youtube-host">
            <div style={{ width: '100%', height: '100%', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#475569', fontSize: '1.25rem', fontWeight: 500 }}>
                Join a party to start watching
              </span>
            </div>
          </div>
          <div className="player-controls-overlay">
            {/* Fullscreen button removed from offline room */}
          </div>
        </div>

        <DraggableVideoFeeds
          isFullscreen={isFullscreen}
          user1Ref={user1Ref}
          user2Ref={user2Ref}
          cam1Pos={cam1Pos}
          setCam1Pos={setCam1Pos}
          cam2Pos={cam2Pos}
          setCam2Pos={setCam2Pos}
          user1Media={user1Media}
          user2Media={user2Media}
          isConnected={isConnected}
          useIsConnectedForRemote={true}
          localVideoContent={
            <div style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>
              <div style={{ width: "100%", height: "100%", backgroundColor: "#333" }} />
            </div>
          }
          remoteVideoContent={
            <div style={{width: "100%", height: "100%", backgroundColor: "#333", borderRadius: "12px"}} />
          }
          localControlsOverride={
            <div className="media-controls">
              <button
                disabled
                onMouseDown={(e) => e.stopPropagation()}
                className="media-toggle-btn is-off"
                title="Microphone disabled in offline mode"
                style={{ opacity: 0.5, cursor: 'not-allowed' }}
              >
                <MicOff size={18} />
              </button>
              <button
                disabled
                onMouseDown={(e) => e.stopPropagation()}
                className="media-toggle-btn is-off"
                title="Camera disabled in offline mode"
                style={{ opacity: 0.5, cursor: 'not-allowed' }}
              >
                <VideoOff size={18} />
              </button>
            </div>
          }
        />
      </div>
    </div>
  );
}
