import { useEffect, useRef, useState } from "react";
import { getSocket } from "../socket/socket";

/**
 * STUN-only config for development.
 * Add TURN servers here for production reliability.
 */
const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/**
 * useWebRTC — manages a single RTCPeerConnection for a 1-on-1 interview.
 *
 * Architecture:
 *  - Effect 1: Creates the RTCPeerConnection and wires socket signaling
 *    (offer/answer/ICE relay) as soon as the socket room is joined.
 *    Does NOT require localStream — a participant whose camera was denied
 *    can still receive the other person's video.
 *  - Effect 2: Adds local media tracks to the existing PC when localStream
 *    becomes available (decoupled from PC lifecycle).
 *  - Effect 3: The interviewer creates an offer when a candidate appears in
 *    roomState.participants. Uses React state (not socket events) to avoid
 *    timing issues with Strict Mode double-mounting.
 *  - Effect 4: Clears remoteStream when the other participant leaves.
 */
export const useWebRTC = ({ interviewId, user, localStream, connectionState, roomState }) => {
  const peerConnectionRef = useRef(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [webrtcStatus, setWebrtcStatus] = useState("new");
  const pendingCandidates = useRef([]);
  const hasCreatedOffer = useRef(false);
  const [pcReady, setPcReady] = useState(false);

  // ─── Effect 1: Create PeerConnection + wire socket signaling ─────────
  useEffect(() => {
    if (!interviewId || !user || connectionState !== "joined") return;

    const socket = getSocket();
    if (!socket) return;

    // Create peer connection
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = pc;
    hasCreatedOffer.current = false;
    pendingCandidates.current = [];

    console.log("[WebRTC] PeerConnection created");

    // --- Connection state updates ---
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log("[WebRTC] ICE connection state:", state);
      setWebrtcStatus(state);
    };

    // --- Remote tracks ---
    pc.ontrack = (event) => {
      console.log("[WebRTC] Remote track received");
      setRemoteStream(event.streams[0]);
    };

    // --- ICE candidates → relay via socket ---
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc-ice-candidate", { interviewId, candidate: event.candidate });
      }
    };

    // --- Socket signaling handlers ---
    const handleOffer = async ({ offer }) => {
      try {
        console.log("[WebRTC] Received offer");
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc-answer", { interviewId, answer });
        console.log("[WebRTC] Answer sent");

        // Flush queued ICE candidates
        for (const c of pendingCandidates.current) {
          await pc.addIceCandidate(c);
        }
        pendingCandidates.current = [];
      } catch (err) {
        console.error("[WebRTC] Error handling offer:", err);
      }
    };

    const handleAnswer = async ({ answer }) => {
      try {
        console.log("[WebRTC] Received answer");
        await pc.setRemoteDescription(new RTCSessionDescription(answer));

        for (const c of pendingCandidates.current) {
          await pc.addIceCandidate(c);
        }
        pendingCandidates.current = [];
      } catch (err) {
        console.error("[WebRTC] Error handling answer:", err);
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      try {
        const ice = new RTCIceCandidate(candidate);
        if (pc.remoteDescription) {
          await pc.addIceCandidate(ice);
        } else {
          pendingCandidates.current.push(ice);
        }
      } catch (err) {
        console.error("[WebRTC] Error adding ICE candidate:", err);
      }
    };

    socket.on("webrtc-offer", handleOffer);
    socket.on("webrtc-answer", handleAnswer);
    socket.on("webrtc-ice-candidate", handleIceCandidate);

    setPcReady(true);

    // Cleanup
    return () => {
      console.log("[WebRTC] Cleaning up PeerConnection");
      socket.off("webrtc-offer", handleOffer);
      socket.off("webrtc-answer", handleAnswer);
      socket.off("webrtc-ice-candidate", handleIceCandidate);
      pc.close();
      peerConnectionRef.current = null;
      setPcReady(false);
      setRemoteStream(null);
      setWebrtcStatus("new");
      pendingCandidates.current = [];
      hasCreatedOffer.current = false;
    };
  }, [interviewId, user?.id, user?.role, connectionState]);

  // ─── Effect 2: Add local tracks to the existing PC ───────────────────
  useEffect(() => {
    const pc = peerConnectionRef.current;
    if (!pc || !localStream) return;

    const existingSenders = pc.getSenders();
    localStream.getTracks().forEach((track) => {
      const alreadyAdded = existingSenders.some((s) => s.track === track);
      if (!alreadyAdded) {
        pc.addTrack(track, localStream);
        console.log("[WebRTC] Added local track:", track.kind);
      }
    });
  }, [localStream, pcReady]);

  // ─── Effect 3: Interviewer creates offer when candidate is present ───
  // Uses roomState.participants (React state) instead of socket events
  // to avoid timing issues with React Strict Mode double-mounting.
  useEffect(() => {
    const pc = peerConnectionRef.current;
    if (!pcReady || !pc) return;
    if (user?.role !== "interviewer") return;
    if (hasCreatedOffer.current) return;

    const hasCandidate = roomState.participants.some(
      (p) => p.role === "candidate" && p.userId !== user?.id
    );
    if (!hasCandidate) return;

    hasCreatedOffer.current = true;

    const createOffer = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const socket = getSocket();
        socket.emit("webrtc-offer", { interviewId, offer });
        console.log("[WebRTC] Offer sent");
      } catch (err) {
        console.error("[WebRTC] Error creating offer:", err);
        hasCreatedOffer.current = false; // allow retry
      }
    };

    createOffer();
  }, [pcReady, roomState.participants, user?.id, user?.role, interviewId]);

  // ─── Effect 4: Clear remote stream when the other person leaves ──────
  useEffect(() => {
    const otherCount = roomState.participants.filter(
      (p) => p.userId !== user?.id
    ).length;

    if (otherCount === 0 && remoteStream) {
      setRemoteStream(null);
    }
  }, [roomState.participants, user?.id, remoteStream]);

  return { remoteStream, webrtcStatus };
};
