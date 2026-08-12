import { useEffect, useRef, useState } from "react";
import Peer from "peerjs";

export default function useWatchPartyCall({
  dataConnRef,
  onReceiveData,
  videoId,
  localVideoRef,
  remoteVideoRef,
  volumeBarRef,
}) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerId, setPeerId] = useState("");
  const [friendId, setFriendId] = useState("");
  const [user1Media, setUser1Media] = useState({ mic: true, cam: true });
  const [user2Media, setUser2Media] = useState({ mic: true, cam: true });

  const peerInstance = useRef(null);

  useEffect(() => {
    let myStream;
    let peer;
    let isMounted = true;

    const initMediaAndPeer = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        myStream = stream;
        setLocalStream(myStream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = myStream;
        }

        // peer = new Peer({
        //   config: {
        //     iceServers: [
        //       { urls: "stun:stun.l.google.com:19302" },
        //       { urls: "stun:stun1.l.google.com:19302" },
        //       { urls: "stun:stun.relay.metered.ca:80" },
        //       {
        //         urls: "turn:global.relay.metered.ca:80",
        //         username: "3867887f9b0e7dcad23a1153",
        //         credential: "skyCdtxsV5voRyrp",
        //       },
        //       {
        //         urls: "turn:global.relay.metered.ca:80?transport=tcp",
        //         username: "3867887f9b0e7dcad23a1153",
        //         credential: "skyCdtxsV5voRyrp",
        //       },
        //       {
        //         urls: "turn:global.relay.metered.ca:443",
        //         username: "3867887f9b0e7dcad23a1153",
        //         credential: "skyCdtxsV5voRyrp",
        //       },
        //       {
        //         urls: "turns:global.relay.metered.ca:443?transport=tcp",
        //         username: "3867887f9b0e7dcad23a1153",
        //         credential: "skyCdtxsV5voRyrp",
        //       },
        //     ],
        //   },
        // });

        peer = new Peer({
          host: "watch-party-74e5.onrender.com", // Replace with your exact Render URL (no https://)
          port: 443, // 443 is the standard port for secure HTTPS connections
          path: "/myapp",
          secure: true, // Required for Render's HTTPS
          config: {
            iceServers: [
              {
                urls: "stun:stun.l.google.com:19302",
              },
              // Add your TURN servers here
              {
                urls: "stun:stun.relay.metered.ca:80",
              },
              {
                urls: "turn:global.relay.metered.ca:80",
                username: "c873961bf6b7217c8b0ffc38",
                credential: "5vB+6jcC2jr8Ox6k",
              },
              {
                urls: "turn:global.relay.metered.ca:80?transport=tcp",
                username: "c873961bf6b7217c8b0ffc38",
                credential: "5vB+6jcC2jr8Ox6k",
              },
              {
                urls: "turn:global.relay.metered.ca:443",
                username: "c873961bf6b7217c8b0ffc38",
                credential: "5vB+6jcC2jr8Ox6k",
              },
              {
                urls: "turns:global.relay.metered.ca:443?transport=tcp",
                username: "c873961bf6b7217c8b0ffc38",
                credential: "5vB+6jcC2jr8Ox6k",
              },
            ],
          },
        });

        peerInstance.current = peer;

        peer.on("open", (id) => {
          if (!isMounted) return;
          setPeerId(id);
        });

        peer.on("connection", (conn) => {
          dataConnRef.current = conn;

          conn.on("data", (data) => {
            onReceiveData(data);
          });
        });

        peer.on("call", (call) => {
          if (!myStream) return;

          call.answer(myStream);

          call.on("stream", (userVideoStream) => {
            if (!isMounted) return;
            setRemoteStream(userVideoStream);
          });
        });
      } catch {
        return;
      }
    };

    initMediaAndPeer();

    return () => {
      isMounted = false;

      if (myStream) {
        myStream.getTracks().forEach((track) => track.stop());
      }

      if (peer) {
        peer.destroy();
      }
    };
  }, [dataConnRef, onReceiveData, localVideoRef]);

  useEffect(() => {
    if (!remoteStream) return;

    const video = remoteVideoRef.current;
    if (!video) return;

    const videoTracks = remoteStream.getVideoTracks();
    video.srcObject = remoteStream;

    videoTracks.forEach((track) => {
      track.onunmute = () => {
        video.play().catch(() => {});
      };

      track.onmute = () => {};
      track.onended = () => {};
    });

    video.onloadedmetadata = () => {
      video.play().catch(() => {});
    };

    const timer = setTimeout(() => {}, 3000);
    const timer2 = setTimeout(() => {}, 8000);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);

      video.onloadedmetadata = null;
      video.oncanplay = null;
      video.onplaying = null;
      video.onwaiting = null;
      video.onstalled = null;
      video.onerror = null;

      videoTracks.forEach((track) => {
        track.onunmute = null;
        track.onmute = null;
        track.onended = null;
      });
    };
  }, [remoteStream, remoteVideoRef]);

  useEffect(() => {
    let audioContext;
    let analyser;
    let source;
    let animationFrameId;

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
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }

        const average = sum / dataArray.length;
        const volumePercentage = Math.min(average * 1.5, 100);

        if (volumeBarRef.current) {
          volumeBarRef.current.style.height = `${volumePercentage}%`;
        }

        animationFrameId = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } else if (volumeBarRef.current) {
      volumeBarRef.current.style.height = "0%";
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      if (audioContext && audioContext.state !== "closed") {
        audioContext.close();
      }
    };
  }, [localStream, user1Media.mic, volumeBarRef]);

  const toggleLocalMic = () => {
    setUser1Media((prev) => {
      const newState = !prev.mic;

      if (localStream) {
        localStream.getAudioTracks().forEach((track) => {
          track.enabled = newState;
        });
      }

      return {
        ...prev,
        mic: newState,
      };
    });
  };

  const toggleLocalCam = () => {
    setUser1Media((prev) => {
      const newState = !prev.cam;

      if (localStream) {
        localStream.getVideoTracks().forEach((track) => {
          track.enabled = newState;
        });
      }

      return {
        ...prev,
        cam: newState,
      };
    });
  };

  const callFriend = () => {
    if (friendId.trim() === "") {
      alert("Please enter a Friend's ID first!");
      return;
    }

    if (!peerInstance.current) {
      alert("Peer connection is not ready yet. Please wait a few seconds.");
      return;
    }

    if (!localStream) {
      alert("Camera/microphone is not ready yet.");
      return;
    }

    const call = peerInstance.current.call(friendId.trim(), localStream);

    const dataConn = peerInstance.current.connect(friendId.trim());
    dataConnRef.current = dataConn;

    dataConn.on("open", () => {
      dataConn.on("data", (data) => {
        onReceiveData(data);
      });

      dataConn.send({ type: "LOAD_VIDEO", videoId });
    });

    if (!call) {
      return;
    }

    const monitorPeerConnection = () => {
      if (!call.peerConnection) {
        return;
      }

      const pc = call.peerConnection;
      pc.onconnectionstatechange = () => {};
      pc.oniceconnectionstatechange = () => {};
      pc.onicegatheringstatechange = () => {};
    };

    setTimeout(monitorPeerConnection, 1000);

    call.on("stream", (userVideoStream) => {
      const videoTracks = userVideoStream.getVideoTracks();

      if (videoTracks.length === 0) {
        return;
      }

      setRemoteStream(userVideoStream);
    });

    call.on("close", () => {});
    call.on("error", () => {});
  };

  return {
    localStream,
    remoteStream,
    peerId,
    friendId,
    setFriendId,
    user1Media,
    setUser1Media,
    user2Media,
    setUser2Media,
    toggleLocalMic,
    toggleLocalCam,
    callFriend,
  };
}