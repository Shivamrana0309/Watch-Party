import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import Peer from "peerjs";
import { useLocation, useNavigate } from "react-router-dom";

const CallContext = createContext(null);

const createDummyStream = () => {
  const canvas = Object.assign(document.createElement("canvas"), { width: 640, height: 480 });
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, 640, 480);
  const videoStream = canvas.captureStream(1);
  const videoTrack = videoStream.getVideoTracks()[0];

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const dest = audioCtx.createMediaStreamDestination();
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 0;
  gainNode.connect(dest);
  
  const osc = audioCtx.createOscillator();
  osc.connect(gainNode);
  osc.start();
  
  const audioTrack = dest.stream.getAudioTracks()[0];

  return new MediaStream([videoTrack, audioTrack]);
};

export const useCallContext = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isPeerNavigating = useRef(false);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  
  const [peerId, setPeerId] = useState("");
  const [friendId, setFriendId] = useState("");
  const [user1Media, setUser1Media] = useState(() => {
    const saved = sessionStorage.getItem('userMediaPref');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { mic: false, cam: false };
  });
  const [user2Media, setUser2Media] = useState({ mic: true, cam: true });

  const [isConnected, setIsConnected] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState("");

  const peerInstance = useRef(null);
  const currentCallRef = useRef(null);
  const screenCallRef = useRef(null);
  const dataConnRef = useRef(null);
  const user1MediaRef = useRef(user1Media);
  const dataListeners = useRef(new Set());

  // Persistent Video DOM elements
  const localVideoDOM = useRef(document.createElement("video"));
  const remoteVideoDOM = useRef(document.createElement("video"));

  useEffect(() => {
    localVideoDOM.current.autoPlay = true;
    localVideoDOM.current.playsInline = true;
    localVideoDOM.current.muted = true;

    remoteVideoDOM.current.autoPlay = true;
    remoteVideoDOM.current.playsInline = true;
  }, []);

  useEffect(() => {
    if (localStream) {
      localVideoDOM.current.srcObject = localStream;
      localVideoDOM.current.play().catch(() => {});
      localVideoDOM.current.onloadedmetadata = () => {
        localVideoDOM.current.play().catch(() => {});
      };
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream) {
      remoteVideoDOM.current.srcObject = remoteStream;
      const videoTracks = remoteStream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.onunmute = () => remoteVideoDOM.current.play().catch(() => {});
      });
      remoteVideoDOM.current.onloadedmetadata = () => remoteVideoDOM.current.play().catch(() => {});
    }
  }, [remoteStream]);

  useEffect(() => {
    sessionStorage.setItem('userMediaPref', JSON.stringify(user1Media));
    user1MediaRef.current = user1Media;
  }, [user1Media]);

  const generatePeerId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const broadcastMediaState = (mediaState) => {
    if (dataConnRef.current && dataConnRef.current.open) {
      dataConnRef.current.send({ type: "MEDIA_STATE", mic: mediaState.mic, cam: mediaState.cam });
    }
  };

  useEffect(() => {
    let myStream;
    let peer;
    let isMounted = true;

    const initMediaAndPeer = async () => {
      try {
        const stream = createDummyStream();

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        // If the user previously saved state as ON, we could request it here.
        // However, we want to fully defer until click as per requirements.
        // So we strictly start with the dummy stream, and let them click to turn it on.

        myStream = stream;
        setLocalStream(myStream);

        const res = await fetch("https://watch-party-74e5.onrender.com/api/turn-credentials");
        const turnData = await res.json();
        const freshId = generatePeerId();

        peer = new Peer(freshId, {
          host: "watch-party-74e5.onrender.com",
          port: 443,
          path: "/myapp",
          secure: true,
          config: { iceServers: turnData.iceServers },
        });

        peerInstance.current = peer;

        peer.on("open", (id) => {
          if (!isMounted) return;
          setPeerId(id);
        });

        peer.on("connection", (conn) => {
          dataConnRef.current = conn;
          conn.on("data", (data) => {
            if (data.type === "CALL_REQUEST") {
              setIncomingCall({ callerId: data.callerId, conn });
            } else {
              handleIncomingData(data);
            }
          });
        });

        peer.on("call", (call) => {
          if (call.metadata && call.metadata.type === "SCREEN_SHARE") {
            call.answer(); 
            call.on("stream", (screenStream) => {
              if (isMounted) setRemoteScreenStream(screenStream);
            });
          } else {
            if (!myStream) return;
            currentCallRef.current = call;
            call.answer(myStream);
            call.on("stream", (userVideoStream) => {
              if (isMounted) setRemoteStream(userVideoStream);
            });
          }
        });

        peer.on("error", (err) => {
          if (err.type === "peer-unavailable") {
            setCallStatus("Friend is offline.");
            setTimeout(() => setCallStatus(""), 4000);
          }
        });
      } catch (err) {
        console.error("Initialization error:", err);
      }
    };

    const handleIncomingData = (data) => {
      if (data.type === "MEDIA_STATE") {
        setUser2Media({ mic: data.mic, cam: data.cam });
      } else if (data.type === "SCREEN_SHARE_STOPPED") {
        setRemoteScreenStream(null);
      } else if (data.type === "CALL_REJECTED") {
        leaveCall();
        setCallStatus("Call was rejected.");
        setTimeout(() => setCallStatus(""), 4000);
      } else if (data.type === "CALL_LEAVE") {
        leaveCall();
        setCallStatus("Friend left the call.");
        setTimeout(() => setCallStatus(""), 4000);
      } else {
        // Forward non-core events to subscribers (e.g. video sync events)
        dataListeners.current.forEach(cb => cb(data));
      }
    };

    initMediaAndPeer();

    return () => {
      isMounted = false;
      if (myStream) myStream.getTracks().forEach((track) => track.stop());
      if (peer) peer.destroy();
    };
  }, []);

  const toggleScreenShare = async () => {
    if (localScreenStream) {
      localScreenStream.getTracks().forEach(t => t.stop());
      setLocalScreenStream(null);
      if (screenCallRef.current) screenCallRef.current.close();
      if (dataConnRef.current) dataConnRef.current.send({ type: "SCREEN_SHARE_STOPPED" });
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
            video: { 
                cursor: "always",
                frameRate: { ideal: 15, max: 24 },
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 }
            }, 
            audio: true 
        });

        setLocalScreenStream(stream);

        if (isConnected && activeRoomId) {
          const call = peerInstance.current.call(activeRoomId, stream, { metadata: { type: "SCREEN_SHARE" } });
          screenCallRef.current = call;
        }

        stream.getVideoTracks()[0].onended = () => {
          setLocalScreenStream(null);
          if (screenCallRef.current) screenCallRef.current.close();
          if (dataConnRef.current) dataConnRef.current.send({ type: "SCREEN_SHARE_STOPPED" });
        };
      } catch (err) {
        console.error("Screen sharing failed", err);
      }
    }
  };

  const toggleLocalMic = async () => {
    const currentState = user1MediaRef.current.mic;
    const newState = !currentState;

    if (newState) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const newAudioTrack = stream.getAudioTracks()[0];
        
        if (localStream) {
          const oldTrack = localStream.getAudioTracks()[0];
          if (oldTrack) {
            localStream.removeTrack(oldTrack);
            oldTrack.stop();
          }
          localStream.addTrack(newAudioTrack);
        }

        if (currentCallRef.current && currentCallRef.current.peerConnection) {
          const sender = currentCallRef.current.peerConnection.getSenders().find(s => s.track && s.track.kind === 'audio');
          if (sender) sender.replaceTrack(newAudioTrack).catch(e => console.error(e));
        }

        setUser1Media(prev => {
          const updated = { ...prev, mic: true };
          broadcastMediaState(updated);
          return updated;
        });
      } catch (e) {
        console.error("Mic permission denied", e);
      }
    } else {
      if (localStream) {
        const oldTrack = localStream.getAudioTracks()[0];
        if (oldTrack) {
          localStream.removeTrack(oldTrack);
          oldTrack.stop();
        }
        const dummyStream = createDummyStream();
        const dummyAudioTrack = dummyStream.getAudioTracks()[0];
        localStream.addTrack(dummyAudioTrack);

        if (currentCallRef.current && currentCallRef.current.peerConnection) {
          const sender = currentCallRef.current.peerConnection.getSenders().find(s => s.track && s.track.kind === 'audio');
          if (sender) sender.replaceTrack(dummyAudioTrack).catch(e => console.error(e));
        }
      }
      setUser1Media(prev => {
        const updated = { ...prev, mic: false };
        broadcastMediaState(updated);
        return updated;
      });
    }
  };

  const toggleLocalCam = async () => {
    const currentState = user1MediaRef.current.cam;
    const newState = !currentState;

    if (newState) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 20 } } });
        const newVideoTrack = stream.getVideoTracks()[0];
        
        if (localStream) {
          const oldTrack = localStream.getVideoTracks()[0];
          if (oldTrack) {
            localStream.removeTrack(oldTrack);
            oldTrack.stop();
          }
          localStream.addTrack(newVideoTrack);
        }

        if (currentCallRef.current && currentCallRef.current.peerConnection) {
          const sender = currentCallRef.current.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(newVideoTrack).catch(e => console.error(e));
        }

        setUser1Media(prev => {
          const updated = { ...prev, cam: true };
          broadcastMediaState(updated);
          return updated;
        });
      } catch (e) {
        console.error("Camera permission denied", e);
      }
    } else {
      if (localStream) {
        const oldTrack = localStream.getVideoTracks()[0];
        if (oldTrack) {
          localStream.removeTrack(oldTrack);
          oldTrack.stop();
        }
        const dummyStream = createDummyStream();
        const dummyVideoTrack = dummyStream.getVideoTracks()[0];
        localStream.addTrack(dummyVideoTrack);

        if (currentCallRef.current && currentCallRef.current.peerConnection) {
          const sender = currentCallRef.current.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(dummyVideoTrack).catch(e => console.error(e));
        }
      }
      setUser1Media(prev => {
        const updated = { ...prev, cam: false };
        broadcastMediaState(updated);
        return updated;
      });
    }
  };

  const callFriend = () => {
    const friendIdClean = friendId.trim().toUpperCase();
    if (!friendIdClean || !peerInstance.current || !localStream) return;

    setCallStatus("Ringing...");
    const dataConn = peerInstance.current.connect(friendIdClean);
    dataConnRef.current = dataConn;

    dataConn.on("open", () => {
      dataConn.send({ type: "CALL_REQUEST", callerId: peerId });
      dataConn.on("data", (data) => {
        if (data.type === "CALL_ACCEPTED") {
          setIsConnected(true);
          setActiveRoomId(friendIdClean);
          setCallStatus("Connected!");

          const call = peerInstance.current.call(friendIdClean, localStream);
          currentCallRef.current = call;
          call.on("stream", (userVideoStream) => setRemoteStream(userVideoStream));
          
          dataConn.send({ type: "MEDIA_STATE", ...user1MediaRef.current });

          if (localScreenStream) {
            screenCallRef.current = peerInstance.current.call(friendIdClean, localScreenStream, { metadata: { type: "SCREEN_SHARE" } });
          }

          setTimeout(() => setCallStatus(""), 3000);
        } else if (data.type === "CALL_REJECTED") {
          leaveCall();
          setCallStatus("Call rejected.");
        } else if (data.type === "MEDIA_STATE") {
          setUser2Media({ mic: data.mic, cam: data.cam });
        } else if (data.type === "SCREEN_SHARE_STOPPED") {
          setRemoteScreenStream(null);
        } else if (data.type === "CALL_LEAVE") {
          leaveCall();
        } else {
          dataListeners.current.forEach(cb => cb(data));
        }
      });
    });
  };

  const acceptCall = () => {
    if (incomingCall) {
      dataConnRef.current = incomingCall.conn;
      setIsConnected(true);
      setActiveRoomId(incomingCall.callerId);

      incomingCall.conn.send({ type: "CALL_ACCEPTED" });
      incomingCall.conn.send({ type: "MEDIA_STATE", ...user1MediaRef.current });

      if (localScreenStream) {
          screenCallRef.current = peerInstance.current.call(incomingCall.callerId, localScreenStream, { metadata: { type: "SCREEN_SHARE" } });
      }

      incomingCall.conn.on("data", (data) => {
        if (data.type === "MEDIA_STATE") setUser2Media({ mic: data.mic, cam: data.cam });
        else if (data.type === "SCREEN_SHARE_STOPPED") setRemoteScreenStream(null);
        else if (data.type === "CALL_LEAVE") leaveCall();
        else dataListeners.current.forEach(cb => cb(data));
      });
      setIncomingCall(null);
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      incomingCall.conn.send({ type: "CALL_REJECTED" });
      setIncomingCall(null);
    }
  };

  const leaveCall = () => {
    if (dataConnRef.current && dataConnRef.current.open) {
      try { dataConnRef.current.send({ type: "CALL_LEAVE" }); } catch {}
      dataConnRef.current.close();
      dataConnRef.current = null;
    }
    if (currentCallRef.current) currentCallRef.current.close();
    if (screenCallRef.current) screenCallRef.current.close();

    setRemoteStream(null);
    setRemoteScreenStream(null);
    if (localScreenStream) {
      localScreenStream.getTracks().forEach(t => t.stop());
      setLocalScreenStream(null);
    }

    setIsConnected(false);
    setActiveRoomId("");
    setFriendId("");
    setUser2Media({ mic: true, cam: true });
    setCallStatus("You left the call.");
    setTimeout(() => setCallStatus(""), 3000);
  };

  // --- Route Synchronization Logic ---
  useEffect(() => {
    // Broadcast route changes to the peer, unless we are currently navigating due to a peer's instruction
    if (isConnected && dataConnRef.current && dataConnRef.current.open && !isPeerNavigating.current) {
      dataConnRef.current.send({ type: "ROUTE_CHANGE", path: location.pathname });
    }
    isPeerNavigating.current = false;
  }, [location.pathname, isConnected]);

  useEffect(() => {
    const handleRouteData = (data) => {
      if (data.type === "ROUTE_CHANGE" && data.path && data.path !== location.pathname) {
        isPeerNavigating.current = true;
        navigate(data.path);
      }
    };
    
    dataListeners.current.add(handleRouteData);
    return () => dataListeners.current.delete(handleRouteData);
  }, [location.pathname, navigate]);
  // --- End Route Synchronization Logic ---

  const sendData = (data) => {
    if (dataConnRef.current && dataConnRef.current.open) {
      dataConnRef.current.send(data);
    }
  };

  const subscribeToData = (cb) => {
    dataListeners.current.add(cb);
    return () => dataListeners.current.delete(cb);
  };

  const value = {
    localStream,
    remoteStream,
    localScreenStream,
    remoteScreenStream,
    peerId,
    friendId,
    setFriendId,
    user1Media,
    user2Media,
    toggleLocalMic,
    toggleLocalCam,
    toggleScreenShare,
    callFriend,
    acceptCall,
    rejectCall,
    leaveCall,
    incomingCall,
    callStatus,
    isConnected,
    activeRoomId,
    sendData,
    subscribeToData,
    dataConnRef,
    localVideoDOM: localVideoDOM.current,
    remoteVideoDOM: remoteVideoDOM.current
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};
