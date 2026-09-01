import React, { useState, useEffect, useRef } from 'react';
import { FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCallContext } from '../context/CallContext';
import RoomHeader from '../components/RoomHeader';
import IncomingCallModal from '../components/IncomingCallModal';
import DraggableVideoFeeds from '../components/DraggableVideoFeeds';
import useWebRTCStreamer from '../hooks/useWebRTCStreamer';
import VideoPlayerControls from '../components/VideoPlayerControls';

export default function WebRTCRoom() {
  const navigate = useNavigate();

  // ── Pull everything from the global CallContext ──
  const {
    peerId, friendId, setFriendId,
    localStream, remoteStream,
    remoteMovieStream, startMovieShare, stopMovieShare,
    callFriend, acceptCall, rejectCall, leaveCall,
    isConnected, callStatus, incomingCall,
    user1Media, user2Media, toggleLocalMic, toggleLocalCam,
    sendData, subscribeToData,
    activeRoomId
  } = useCallContext();

  const { 
    videoRef, videoUrlRef, fileName, isStreamer, currentTime, duration, 
    isPaused, handleFileChange, handleVideoLoadedMetadata, 
    handleTimeUpdate, handlePlayPauseEvent, handleWaiting, 
    togglePlayPause, handleSeek, formatTime, setIsScrubbing 
  } = useWebRTCStreamer({ 
    isConnected, sendData, subscribeToData, startMovieShare, stopMovieShare 
  });

  // UI State
  const [cam1Pos, setCam1Pos] = useState({ x: 0, y: 0 });
  const [cam2Pos, setCam2Pos] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const containerRef = useRef(null);
  const user1Ref = useRef(null);
  const user2Ref = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // Webcam video element refs — these attach to context streams
  const localVideoCamRef = useRef(null);
  const remoteVideoCamRef = useRef(null);
  const volumeBarRef = useRef(null);

  const handleMouseMove = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setControlsVisible(false), 5000);
  };

  const handleMouseLeave = () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setControlsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // ── Attach context webcam streams to local video elements ──
  useEffect(() => {
    if (localVideoCamRef.current && localStream) {
      localVideoCamRef.current.srcObject = localStream;
      localVideoCamRef.current.play().catch(() => {});
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoCamRef.current && remoteStream) {
      remoteVideoCamRef.current.srcObject = remoteStream;
      remoteVideoCamRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // Volume Bar Logic
  useEffect(() => {
    let audioContext, analyser, source, animationFrameIdLocal;
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
        animationFrameIdLocal = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } else if (volumeBarRef.current) {
      volumeBarRef.current.style.height = "0%";
    }
    return () => {
      if (animationFrameIdLocal) cancelAnimationFrame(animationFrameIdLocal);
      if (audioContext && audioContext.state !== "closed") audioContext.close();
    };
  }, [localStream, user1Media.mic]);

  // ── Attach remote movie stream to the main video player ──
  useEffect(() => {
    if (remoteMovieStream && videoRef.current && !isStreamer) {
      videoRef.current.removeAttribute('src');
      videoRef.current.srcObject = remoteMovieStream;
      videoRef.current.play().catch(e => console.error("Autoplay blocked:", e));
    }
  }, [remoteMovieStream, isStreamer, videoRef]);

  const toggleFullscreen = () => {
    const isFull = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
    if (!isFull) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else if (containerRef.current?.webkitRequestFullscreen) {
        containerRef.current.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
    };
  }, []);

  return (
    <div className="watch-party-room">
      <RoomHeader
        activeTab="watch-party"
        navigate={navigate}
        peerId={peerId}
        isConnected={isConnected}
        activeRoomId={activeRoomId}
        friendId={friendId}
        setFriendId={setFriendId}
        callFriend={callFriend}
        leaveCall={leaveCall}
        callStatus={callStatus}
        friendIdDisabled={!friendId.trim()}
        customActionWidget={
          <div style={{ display: 'flex', gap: '1rem', margin: 0, height: '52px', alignItems: 'center' }}>
            <label className="btn btn-join" style={{ 
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.5rem", 
              fontSize: '0.85rem', padding: '0.65rem 1.25rem', border: '1px solid #dbeafe', backgroundColor: '#eff6ff', boxShadow: '0 1px 2px rgba(0,0,0,0.06)', margin: 0, height: '100%'
            }}>
              <FolderOpen size={16} />
              UPLOAD VIDEO
              <input type="file" accept="video/mp4,video/webm" onChange={handleFileChange} style={{ display: "none" }} />
            </label>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: '100%', marginLeft: '0.5rem' }}>
              <div style={{ display: "flex", alignItems: "center", fontSize: "0.85rem", color: "#475569", whiteSpace: "nowrap", flex: 1 }}>
                <strong>Your File:</strong> &nbsp;{fileName || "None"}
              </div>
            </div>
          </div>
        }
      />

      <IncomingCallModal
        incomingCall={incomingCall}
        acceptCall={acceptCall}
        rejectCall={rejectCall}
      />

      <div
        ref={containerRef}
        className={isFullscreen ? "video-shell is-fullscreen" : "video-shell"}
      >
        <div className={isFullscreen ? "player-panel is-fullscreen" : "player-panel"}>
          <div
            className="local-video-host"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ width: "100%", height: isFullscreen ? "100%" : "auto", aspectRatio: isFullscreen ? "auto" : "16 / 9", backgroundColor: '#000', position: "relative", cursor: controlsVisible ? "default" : "none" }}
          >
            <video 
              ref={videoRef}
              playsInline
              onClick={togglePlayPause}
              onLoadedMetadata={handleVideoLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPlay={handlePlayPauseEvent}
              onPause={handlePlayPauseEvent}
              onWaiting={handleWaiting}
              style={{ width: "100%", height: "100%", objectFit: "contain", cursor: controlsVisible ? "pointer" : "none", display: videoUrlRef.current || (isConnected && !isStreamer) ? "block" : "none" }}
            />
            {(!videoUrlRef.current && (!isConnected || (isConnected && isStreamer && !videoUrlRef.current))) && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  color: "#9ca3af",
                  flexDirection: "column",
                  gap: "0.5rem",
                  position: "absolute",
                  inset: 0
                }}
              >
                <FolderOpen size={48} />
                <p>Please select a local video file above or connect to a partner.</p>
              </div>
            )}

            <VideoPlayerControls 
              controlsVisible={controlsVisible}
              currentTime={currentTime}
              duration={duration}
              isPaused={isPaused}
              isStreamer={isStreamer}
              setIsScrubbing={setIsScrubbing}
              handleSeek={handleSeek}
              togglePlayPause={togglePlayPause}
              formatTime={formatTime}
              toggleFullscreen={toggleFullscreen}
              isFullscreen={isFullscreen}
            />
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
          volumeBarRef={volumeBarRef}
          user1Media={user1Media}
          user2Media={user2Media}
          toggleLocalMic={toggleLocalMic}
          toggleLocalCam={toggleLocalCam}
          remoteStream={remoteStream}
          isConnected={isConnected}
          useIsConnectedForRemote={true}
          localVideoContent={
            <video
              ref={localVideoCamRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#333', transform: 'scaleX(-1)' }}
            />
          }
          remoteVideoContent={
            <video
              ref={remoteVideoCamRef}
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#222' }}
            />
          }
        />
      </div>
    </div>
  );
}