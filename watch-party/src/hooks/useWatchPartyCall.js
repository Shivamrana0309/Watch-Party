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

  // New States for Call Handshake
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState("");

  const peerInstance = useRef(null);
  const videoIdRef = useRef(videoId);

  useEffect(() => {
    videoIdRef.current = videoId;
  }, [videoId]);

  // Generate a random 6-character uppercase alphanumeric ID
  const generateShortId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

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

        // 1. Fetch secure TURN credentials from your backend
        const res = await fetch("https://watch-party-74e5.onrender.com/api/turn-credentials");
        const turnData = await res.json();

        // 2. Generate short room ID
        const shortId = generateShortId();

        // 3. Initialize Peer with fetched credentials and short ID
        peer = new Peer(shortId, {
          host: "watch-party-74e5.onrender.com",
          port: 443,
          path: "/myapp",
          secure: true,
          config: {
            iceServers: turnData.iceServers,
          },
        });

        peerInstance.current = peer;

        peer.on("open", (id) => {
          if (!isMounted) return;
          setPeerId(id);
        });

        // 4. Handle incoming Data Connections (The Handshake)
        peer.on("connection", (conn) => {
          conn.on("data", (data) => {
            if (data.type === "CALL_REQUEST") {
              setIncomingCall({ callerId: data.callerId, conn });
            } else {
              onReceiveData(data);
            }
          });
        });

        // 5. Auto-answer media call once handshake is accepted
        peer.on("call", (call) => {
          if (!myStream) return;
          call.answer(myStream);

          call.on("stream", (userVideoStream) => {
            if (!isMounted) return;
            setRemoteStream(userVideoStream);
          });
        });
      } catch (err) {
        console.error("Initialization error:", err);
      }
    };

    initMediaAndPeer();

    return () => {
      isMounted = false;
      if (myStream) myStream.getTracks().forEach((track) => track.stop());
      if (peer) peer.destroy();
    };
  }, [onReceiveData, localVideoRef]);

  // Handle remote stream and audio (Unchanged)
  useEffect(() => {
    if (!remoteStream) return;
    const video = remoteVideoRef.current;
    if (!video) return;

    const videoTracks = remoteStream.getVideoTracks();
    video.srcObject = remoteStream;

    videoTracks.forEach((track) => {
      track.onunmute = () => video.play().catch(() => {});
      track.onmute = () => {};
      track.onended = () => {};
    });

    video.onloadedmetadata = () => video.play().catch(() => {});

    return () => {
      video.onloadedmetadata = null;
      videoTracks.forEach((track) => {
        track.onunmute = null;
        track.onmute = null;
        track.onended = null;
      });
    };
  }, [remoteStream, remoteVideoRef]);

  // Volume Meter Logic (Unchanged)
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
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        const volumePercentage = Math.min(average * 1.5, 100);

        if (volumeBarRef.current) volumeBarRef.current.style.height = `${volumePercentage}%`;
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
  }, [localStream, user1Media.mic, volumeBarRef]);

  const toggleLocalMic = () => {
    setUser1Media((prev) => {
      const newState = !prev.mic;
      if (localStream) {
        localStream.getAudioTracks().forEach((track) => (track.enabled = newState));
      }
      return { ...prev, mic: newState };
    });
  };

  const toggleLocalCam = () => {
    setUser1Media((prev) => {
      const newState = !prev.cam;
      if (localStream) {
        localStream.getVideoTracks().forEach((track) => (track.enabled = newState));
      }
      return { ...prev, cam: newState };
    });
  };

  // Initiates request to friend
  const callFriend = () => {
    const friendIdClean = friendId.trim().toUpperCase();
    if (friendIdClean === "") return alert("Please enter a Friend's ID first!");
    if (!peerInstance.current || !localStream) return alert("System not ready yet.");

    setCallStatus("Ringing...");
    const dataConn = peerInstance.current.connect(friendIdClean);
    dataConnRef.current = dataConn;

    dataConn.on("open", () => {
      dataConn.send({ type: "CALL_REQUEST", callerId: peerId });

      dataConn.on("data", (data) => {
        if (data.type === "CALL_ACCEPTED") {
          setCallStatus("Accepted! Connecting...");
          
          const call = peerInstance.current.call(friendIdClean, localStream);
          call.on("stream", (userVideoStream) => setRemoteStream(userVideoStream));
          
          dataConn.send({ type: "LOAD_VIDEO", videoId: videoIdRef.current });
          setTimeout(() => setCallStatus(""), 3000);
        } else if (data.type === "CALL_REJECTED") {
          setCallStatus("Call rejected by friend.");
          dataConnRef.current = null;
          setTimeout(() => setCallStatus(""), 4000);
        } else {
          onReceiveData(data);
        }
      });
    });
  };

  // Receiver accepts the call
  const acceptCall = () => {
    if (incomingCall) {
      dataConnRef.current = incomingCall.conn;
      incomingCall.conn.send({ type: "CALL_ACCEPTED" });
      setIncomingCall(null);
    }
  };

  // Receiver rejects the call
  const rejectCall = () => {
    if (incomingCall) {
      incomingCall.conn.send({ type: "CALL_REJECTED" });
      setIncomingCall(null);
    }
  };

  return {
    localStream, remoteStream, peerId, friendId, setFriendId,
    user1Media, setUser1Media, user2Media, setUser2Media,
    toggleLocalMic, toggleLocalCam, callFriend,
    incomingCall, acceptCall, rejectCall, callStatus
  };
}