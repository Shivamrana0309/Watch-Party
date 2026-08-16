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
} from "lucide-react";
import useWatchPartyVideo from "./hooks/useWatchPartyVideo";
import useWatchPartyCall from "./hooks/useWatchPartyCall";

export default function WatchPartyRoomRefactored() {
  const dataConnRef = useRef(null);
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const user1Ref = useRef(null);
  const user2Ref = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const volumeBarRef = useRef(null);

  const [cam1Pos, setCam1Pos] = useState({ x: 0, y: 0 });
  const [cam2Pos, setCam2Pos] = useState({ x: 0, y: 0 });

  const {
    videoId,
    inputUrl,
    setInputUrl,
    isFullscreen,
    handleReceiveData,
    handleUrlSubmit,
    handlePlay,
    handlePause,
    toggleFullscreen,
  } = useWatchPartyVideo({
    playerRef,
    dataConnRef,
    containerRef,
  });

  const {
    remoteStream,
    peerId,
    friendId,
    setFriendId,
    user1Media,
    user2Media,
    setUser2Media,
    toggleLocalMic,
    toggleLocalCam,
    callFriend,
    incomingCall,  // NEW
    acceptCall,    // NEW
    rejectCall,    // NEW
    callStatus     // NEW
  } = useWatchPartyCall({
    dataConnRef,
    onReceiveData: handleReceiveData,
    videoId,
    localVideoRef,
    remoteVideoRef,
    volumeBarRef,
  });

  return (
    <div className="watch-party-room">
      <form onSubmit={handleUrlSubmit} className="watch-party-form">
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
          />
        </div>
        <button type="submit" className="load-video-btn">
          Load Video
        </button>
      </form>

      <div className="connection-row">
        <div className="room-id-panel">
          <span className="room-id-label">Your Room ID:</span>
          <code className="room-id-code">{peerId || "Generating..."}</code>
          <button
            onClick={() => navigator.clipboard.writeText(peerId)}
            className="copy-id-btn"
            title="Copy ID"
          >
            <Copy size={16} />
          </button>
        </div>

        <div className="friend-connect-panel">
          <input
            type="text"
            placeholder="Paste Friend's ID here..."
            value={friendId}
            onChange={(e) => setFriendId(e.target.value)}
            className="friend-id-input"
            style={{ textTransform: "uppercase" }}
          />
          <button onClick={callFriend} className="connect-btn">
            <PhoneCall size={16} />
            Connect
          </button>
        </div>
      </div>

      {/* NEW: Caller Status Feedback */}
      {callStatus && (
        <div className="call-status-alert">
          {callStatus}
        </div>
      )}

      {/* NEW: Incoming Call Request Prompt */}
      {incomingCall && (
        <div className="incoming-call-modal">
          <span>Incoming request from: <strong>{incomingCall.callerId}</strong></span>
          <div className="incoming-call-actions">
            <button onClick={acceptCall} className="accept-btn">Accept</button>
            <button onClick={rejectCall} className="reject-btn">Reject</button>
          </div>
        </div>
      )}

      <div ref={containerRef} className={isFullscreen ? "video-shell is-fullscreen" : "video-shell"}>
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
              onPlay={handlePlay}
              onPause={handlePause}
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

        <div className={isFullscreen ? "camera-column is-fullscreen" : "camera-column"}>
          <Draggable
            bounds="parent"
            nodeRef={user1Ref}
            disabled={!isFullscreen}
            position={isFullscreen ? cam1Pos : { x: 0, y: 0 }}
            onDrag={(e, data) => setCam1Pos({ x: data.x, y: data.y })}
          >
            <div ref={user1Ref} className={`video-card video-card--self ${isFullscreen ? "is-fullscreen" : "is-inline"}`}>
              <div className="video-surface">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`video-feed video-feed--local ${user1Media.cam ? "is-visible" : "is-hidden"}`}
                />
                {!user1Media.cam && <VideoOff className="video-off-icon" />}
                <div className="participant-tag-wrap">
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
                >
                  {user1Media.mic ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
                <button
                  onClick={toggleLocalCam}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`media-toggle-btn ${user1Media.cam ? "is-on" : "is-off"}`}
                >
                  {user1Media.cam ? <Video size={18} /> : <VideoOff size={18} />}
                </button>
              </div>
            </div>
          </Draggable>

          <Draggable
            bounds="parent"
            nodeRef={user2Ref}
            disabled={!isFullscreen}
            position={isFullscreen ? cam2Pos : { x: 0, y: 0 }}
            onDrag={(e, data) => setCam2Pos({ x: data.x, y: data.y })}
          >
            <div ref={user2Ref} className={`video-card video-card--friend ${isFullscreen ? "is-fullscreen" : "is-inline"}`}>
              <div className="video-surface video-surface--friend">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="video-feed video-feed--remote"
                />

                {!remoteStream && (
                  <div className="waiting-overlay">
                    <VideoOff className="waiting-icon" />
                    <span className="waiting-text">Waiting for friend...</span>
                  </div>
                )}
                <div className="participant-tag-wrap participant-tag-wrap--friend">
                  <span className="participant-tag">Friend</span>
                </div>
              </div>

              <div className="media-controls media-controls--friend">
                <button
                  onClick={() => setUser2Media({ ...user2Media, mic: !user2Media.mic })}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`media-toggle-btn ${user2Media.mic ? "is-on" : "is-off"}`}
                >
                  {user2Media.mic ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
                <button
                  onClick={() => setUser2Media({ ...user2Media, cam: !user2Media.cam })}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`media-toggle-btn ${user2Media.cam ? "is-on" : "is-off"}`}
                >
                  {user2Media.cam ? <Video size={18} /> : <VideoOff size={18} />}
                </button>
              </div>
            </div>
          </Draggable>
        </div>
      </div>
    </div>
  );
}