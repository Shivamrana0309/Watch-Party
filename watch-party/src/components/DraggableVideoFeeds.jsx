import React from "react";
import Draggable from "react-draggable";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
} from "lucide-react";

export default function DraggableVideoFeeds({
  isFullscreen,
  user1Ref,
  user2Ref,
  cam1Pos,
  setCam1Pos,
  cam2Pos,
  setCam2Pos,
  localVideoRef,
  remoteVideoRef,
  volumeBarRef,
  user1Media,
  user2Media,
  toggleLocalMic,
  toggleLocalCam,
  remoteStream,
  isConnected,
  // Optional overrides for rooms with custom video surfaces
  localVideoContent,
  remoteVideoContent,
  localControlsOverride,
  // WebRTC + Offline use isConnected for the "waiting" overlay; others use !remoteStream
  useIsConnectedForRemote = false,
}) {
  // Determine whether to show "waiting for friend" overlay
  const showRemoteWaiting = useIsConnectedForRemote ? !isConnected : !remoteStream;
  // Determine whether to show "friend's camera is off" overlay
  const showRemoteCamOff = useIsConnectedForRemote
    ? isConnected && !user2Media.cam
    : remoteStream && !user2Media.cam;

  return (
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
            {localVideoContent ? (
              localVideoContent
            ) : (
              <div ref={localVideoRef} style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }} />
            )}
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
          {localControlsOverride ? (
            localControlsOverride
          ) : (
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
          )}
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
            {remoteVideoContent ? (
              remoteVideoContent
            ) : (
              <div ref={remoteVideoRef} style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }} />
            )}

            {showRemoteWaiting && (
              <div className="waiting-overlay">
                <VideoOff className="waiting-icon" />
                <span className="waiting-text">Waiting for friend...</span>
              </div>
            )}
            {showRemoteCamOff && (
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
  );
}
