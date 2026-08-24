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

  // Tracks our drag debouncer for smooth seeking
  const seekTimeoutRef = useRef(null);

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

  // Receive Commands from Peer (No more brittle lock ref!)
  const handleReceiveData = useCallback((data) => {
    if (!videoRef.current) return;
    const player = videoRef.current;

    if (data.type === "FILE_LOADED") {
      setPeerFileName(data.fileName);
      return;
    }

    if (data.type === "PLAY") {
      const needsSeek = Math.abs(player.currentTime - data.time) > 0.5;

      const attemptPlay = () => {
        player.play().catch((err) => {
          console.warn("Autoplay blocked on peer.", err);
        });
      };

      if (needsSeek) {
        // Safety Fallback: If the browser fails to seek, we force it to play anyway 
        // after 1 second so the video doesn't freeze permanently.
        let fallbackTimer;
        const onSeeked = () => {
          clearTimeout(fallbackTimer);
          attemptPlay();
          player.removeEventListener("seeked", onSeeked);
        };

        player.addEventListener("seeked", onSeeked, { once: true });
        fallbackTimer = setTimeout(() => {
          player.removeEventListener("seeked", onSeeked);
          attemptPlay();
        }, 1000);

        try {
          player.currentTime = data.time;
        } catch (e) {
          console.warn("Browser rejected remote seek", e);
          attemptPlay();
        }
      } else {
        attemptPlay();
      }

    } else if (data.type === "PAUSE") {
      try {
        if (Math.abs(player.currentTime - data.time) > 0.5) player.currentTime = data.time;
      } catch (e) { }
      if (!player.paused) player.pause();

    } else if (data.type === "SEEK") {
      try {
        player.currentTime = data.time;
      } catch (e) { }
    }
  }, [videoRef]);

  // Master Shared Controls
  const togglePlayPause = () => {
    if (!videoRef.current || !videoSrc) return;

    // A physical user click ALWAYS overrides the system. No lock checks here!
    const player = videoRef.current;
    const willPlay = player.paused;

    if (willPlay) {
      player.play()
        .then(() => {
          if (dataConnRef.current && dataConnRef.current.open) {
            dataConnRef.current.send({ type: "PLAY", time: player.currentTime });
          }
        })
        .catch(() => {
          alert("Please click anywhere on the page once to unlock the video player.");
        });
    } else {
      player.pause();
      if (dataConnRef.current && dataConnRef.current.open) {
        dataConnRef.current.send({ type: "PAUSE", time: player.currentTime });
      }
    }
  };

  // The Debounced Seek Handler
  const handleSeek = (time) => {
    if (!videoRef.current) return;

    try {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    } catch (e) {
      console.warn("Local seek rejected", e);
    }

    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);

    seekTimeoutRef.current = setTimeout(() => {
      if (dataConnRef.current && dataConnRef.current.open) {
        dataConnRef.current.send({ type: "SEEK", time });
      }
    }, 150);
  };

  // STRICT UI SYNC: Listen to the native DOM events to update our React icons
  useEffect(() => {
    const player = videoRef.current;
    if (!player) return;

    const updateTime = () => setCurrentTime(player.currentTime);
    const updateDuration = () => setDuration(player.duration);
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
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen().catch(() => { });
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