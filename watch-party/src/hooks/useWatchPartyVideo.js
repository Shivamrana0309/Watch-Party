import { useCallback, useEffect, useRef, useState } from "react";

export default function useWatchPartyVideo({ playerRef, dataConnRef, containerRef }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoId, setVideoId] = useState("LXb3EKWsInQ");
  const [inputUrl, setInputUrl] = useState("");

  const isRemoteActionRef = useRef(false);

  const extractVideoId = (url) => {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;

    const match = url.match(regExp);

    return match && match[2].length === 11 ? match[2] : null;
  };

  const handleReceiveData = useCallback(
    (data) => {
      if (!playerRef.current) return;

      const player = playerRef.current.getInternalPlayer();

      isRemoteActionRef.current = true;

      if (data.type === "LOAD_VIDEO") {
        setVideoId(data.videoId);
      } else if (data.type === "PLAY") {
        player.seekTo(data.time, true);
        player.playVideo();
      } else if (data.type === "PAUSE") {
        player.pauseVideo();
        player.seekTo(data.time, true);
      }

      setTimeout(() => {
        isRemoteActionRef.current = false;
      }, 500);
    },
    [playerRef]
  );

  const handleUrlSubmit = (e) => {
    e.preventDefault();

    const newUrl = inputUrl.trim();

    if (newUrl !== "") {
      const extractedId = extractVideoId(newUrl);

      if (extractedId) {
        setVideoId(extractedId);
        setInputUrl("");

        if (dataConnRef.current) {
          dataConnRef.current.send({ type: "LOAD_VIDEO", videoId: extractedId });
        }
      } else {
        alert("Please enter a valid YouTube URL.");
      }
    }
  };

  const handlePlay = (e) => {
    if (isRemoteActionRef.current) return;

    const currentTime = e.target.getCurrentTime();
    if (dataConnRef.current) {
      dataConnRef.current.send({ type: "PLAY", time: currentTime });
    }
  };

  const handlePause = (e) => {
    if (isRemoteActionRef.current) return;

    const currentTime = e.target.getCurrentTime();
    if (dataConnRef.current) {
      dataConnRef.current.send({ type: "PAUSE", time: currentTime });
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return {
    videoId,
    inputUrl,
    setInputUrl,
    isFullscreen,
    handleReceiveData,
    handleUrlSubmit,
    handlePlay,
    handlePause,
    toggleFullscreen,
  };
}