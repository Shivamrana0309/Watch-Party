import { useState, useEffect, useCallback, useRef } from "react";

export default function useLocalVideoParty({ videoRef, dataConnRef, containerRef }) {
  const [videoSrc, setVideoSrc] = useState(null);
  const [fileName, setFileName] = useState("");
  const [peerFileName, setPeerFileName] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Shared State for Custom Controls
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Deferred play: when remote play() is blocked by autoplay policy,
  // we store the timestamp so the next user tap resumes from the right spot
  const pendingPlayTimeRef = useRef(null);

  // Guard flag to prevent remote actions from re-broadcasting back
  const isRemoteActionRef = useRef(false);
  const guardTimerRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      const localUrl = URL.createObjectURL(file);
      setVideoSrc(localUrl);
      setFileName(file.name);
      setIsPlaying(false);
      setCurrentTime(0);

      if (dataConnRef.current && dataConnRef.current.open) {
        dataConnRef.current.send({ type: "FILE_LOADED", fileName: file.name });
      }
    }
  };

  // Receive Commands from Peer
  const handleReceiveData = useCallback((data) => {
    if (!videoRef.current) return;
    const player = videoRef.current;

    if (data.type === "FILE_LOADED") {
      // File notifications don't need the guard — no playback side-effects
      setPeerFileName(data.fileName);
      return;
    }

    if (data.type === "PLAY") {
      // Set guard ONLY for playback commands to block re-broadcasts
      isRemoteActionRef.current = true;
      player.currentTime = data.time;
      player.play().catch(() => {
        // Autoplay blocked on mobile — store the time so next user tap picks it up
        console.warn("Remote play blocked by autoplay policy — waiting for user tap");
        pendingPlayTimeRef.current = data.time;
      });
    } else if (data.type === "PAUSE") {
      isRemoteActionRef.current = true;
      player.currentTime = data.time;
      if (!player.paused) {
        player.pause();
      }
      pendingPlayTimeRef.current = null; // Clear any pending play
    } else if (data.type === "SEEK") {
      isRemoteActionRef.current = true;
      player.currentTime = data.time;
    } else {
      // Unknown message type — don't set guard, nothing to do
      return;
    }

    // Clear any previous guard timer so rapid commands don't release early
    if (guardTimerRef.current) clearTimeout(guardTimerRef.current);
    guardTimerRef.current = setTimeout(() => {
      isRemoteActionRef.current = false;
      guardTimerRef.current = null;
    }, 500);
  }, [videoRef]);

  // Master Shared Controls
  const togglePlayPause = () => {
    if (!videoRef.current || !videoSrc) return;
    if (isRemoteActionRef.current) return; // Don't re-broadcast remote actions
    const player = videoRef.current;

    const willPlay = player.paused;

    if (willPlay) {
      // If there's a pending remote play, use that timestamp
      if (pendingPlayTimeRef.current !== null) {
        player.currentTime = pendingPlayTimeRef.current;
        pendingPlayTimeRef.current = null;
      }

      player.play()
        .then(() => {
          // Only broadcast AFTER play actually succeeds
          if (dataConnRef.current && dataConnRef.current.open) {
            dataConnRef.current.send({
              type: "PLAY",
              time: player.currentTime,
            });
          }
        })
        .catch(() => {
          console.warn("Play failed — user gesture may be required");
        });
    } else {
      player.pause();
      pendingPlayTimeRef.current = null;
      // Pause is synchronous — safe to broadcast immediately
      if (dataConnRef.current && dataConnRef.current.open) {
        dataConnRef.current.send({
          type: "PAUSE",
          time: player.currentTime,
        });
      }
    }
  };

  const handleSeek = (time) => {
    if (!videoRef.current) return;
    if (isRemoteActionRef.current) return; // Don't re-broadcast remote actions
    videoRef.current.currentTime = time;
    
    // Broadcast to peer
    if (dataConnRef.current && dataConnRef.current.open) {
      dataConnRef.current.send({ type: "SEEK", time });
    }
  };

  // STRICT UI SYNC: Listen to the native DOM events to update our React icons
  useEffect(() => {
    const player = videoRef.current;
    if (!player) return;

    const updateTime = () => setCurrentTime(player.currentTime);
    const updateDuration = () => setDuration(player.duration);
    
    // These ensure the UI always matches the exact state of the video file
    const syncPlayState = () => setIsPlaying(true);
    const syncPauseState = () => setIsPlaying(false);

    player.addEventListener("timeupdate", updateTime);
    player.addEventListener("loadedmetadata", updateDuration);
    player.addEventListener("play", syncPlayState);
    player.addEventListener("pause", syncPauseState);
    player.addEventListener("ended", syncPauseState);

    return () => {
      player.removeEventListener("timeupdate", updateTime);
      player.removeEventListener("loadedmetadata", updateDuration);
      player.removeEventListener("play", syncPlayState);
      player.removeEventListener("pause", syncPauseState);
      player.removeEventListener("ended", syncPauseState);
    };
  }, [videoRef, videoSrc]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return {
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
  };
}