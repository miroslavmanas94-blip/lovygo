"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Maximize, Mic, MicOff, Phone, PhoneOff, Video } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { createPeerConnection, type CallSignal } from "@/lib/webrtc";
import { useAppSession } from "@/components/AppShell";

export default function VideoCall() {
  const { couple, notify } = useAppSession();
  const [active, setActive] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [signalReady, setSignalReady] = useState(false);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getSupabaseBrowserClient>>["channel"]> | null>(null);
  const queuedCandidates = useRef<RTCIceCandidateInit[]>([]);
  const coupleId = couple?.id;
  const latestHandlers = useRef({ endCall, setupPeer, notify });
  latestHandlers.current = { endCall, setupPeer, notify };

  async function publish(signal: CallSignal) {
    await channelRef.current?.send({ type: "broadcast", event: "signal", payload: signal });
  }

  async function setupPeer() {
    const connection = createPeerConnection();
    peerRef.current = connection;
    streamRef.current?.getTracks().forEach((track) => connection.addTrack(track, streamRef.current as MediaStream));
    connection.ontrack = (event) => {
      if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0];
    };
    connection.onicecandidate = (event) => {
      if (event.candidate) void publish({ type: "ice", candidate: event.candidate.toJSON() });
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "connected") setConnecting(false);
      if (connection.connectionState === "failed") notify("Spojení se přerušilo. Zkuste hovor zahájit znovu.");
    };
    return connection;
  }

  async function endCall(sendSignal: boolean) {
    if (sendSignal) await publish({ type: "end-call" });
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    setActive(false);
    setConnecting(false);
  }

  useEffect(() => {
    if (!coupleId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase.channel(`call:${coupleId}`, { config: { broadcast: { self: false }, private: true } });
    channel.on("broadcast", { event: "signal" }, async ({ payload }) => {
      const signal = payload as CallSignal;
      if (signal.type === "end-call") { await latestHandlers.current.endCall(false); return; }
      if (signal.type === "offer") {
        if (!streamRef.current) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            streamRef.current = stream;
            if (localVideo.current) localVideo.current.srcObject = stream;
            setActive(true);
          } catch {
            latestHandlers.current.notify("Pro přijetí hovoru povolte přístup ke kameře a mikrofonu.");
            return;
          }
        }
        const connection = peerRef.current ?? await latestHandlers.current.setupPeer();
        await connection.setRemoteDescription(signal.description);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        await publish({ type: "answer", description: answer });
        for (const candidate of queuedCandidates.current) await connection.addIceCandidate(candidate);
        queuedCandidates.current = [];
      } else if (signal.type === "answer" && peerRef.current) {
        await peerRef.current.setRemoteDescription(signal.description);
        for (const candidate of queuedCandidates.current) await peerRef.current.addIceCandidate(candidate);
        queuedCandidates.current = [];
      } else if (signal.type === "ice") {
        if (peerRef.current?.remoteDescription) await peerRef.current.addIceCandidate(signal.candidate);
        else queuedCandidates.current.push(signal.candidate);
      }
    }).subscribe((status) => setSignalReady(status === "SUBSCRIBED"));
    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
      peerRef.current?.close();
    };
  }, [coupleId]);

  async function startCall() {
    if (!couple || !channelRef.current) return;
    setConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
      streamRef.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;
      setActive(true);
      const connection = await setupPeer();
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      await publish({ type: "offer", description: offer });
    } catch {
      notify("Kamera nebo mikrofon nejsou dostupné. Povolte přístup v nastavení prohlížeče.");
      setConnecting(false);
    }
  }

  function toggleTrack(kind: "audio" | "video") {
    const track = streamRef.current?.getTracks().find((current) => current.kind === kind);
    if (!track) return;
    track.enabled = !track.enabled;
    if (kind === "video") setCameraOn(track.enabled);
    else setMicOn(track.enabled);
  }

  return <section className="glass rounded-[22px] p-5 sm:p-6"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">Společný čas</p><h2 className="mt-1 text-lg font-medium">Videohovor</h2></div><Video size={18} className="text-[#ff7aaa]" /></div>
    {active ? <div className="relative aspect-video overflow-hidden rounded-2xl bg-black/50"><video ref={remoteVideo} autoPlay playsInline className="size-full object-cover" aria-label="Video partnera" /><video ref={localVideo} autoPlay muted playsInline className="absolute bottom-3 right-3 aspect-video w-[28%] rounded-xl border border-white/20 bg-black/40 object-cover" aria-label="Váš náhled" /><div className="absolute left-3 top-3 flex gap-2"><button className="grid size-10 place-items-center rounded-full border border-white/15 bg-black/50" onClick={() => toggleTrack("video")} title={cameraOn ? "Vypnout kameru" : "Zapnout kameru"} aria-label={cameraOn ? "Vypnout kameru" : "Zapnout kameru"}>{cameraOn ? <Camera size={17} /> : <CameraOff size={17} />}</button><button className="grid size-10 place-items-center rounded-full border border-white/15 bg-black/50" onClick={() => toggleTrack("audio")} title={micOn ? "Vypnout mikrofon" : "Zapnout mikrofon"} aria-label={micOn ? "Vypnout mikrofon" : "Zapnout mikrofon"}>{micOn ? <Mic size={17} /> : <MicOff size={17} />}</button><button className="grid size-10 place-items-center rounded-full border border-white/15 bg-black/50" onClick={() => void document.querySelector("video")?.requestFullscreen()} aria-label="Celá obrazovka"><Maximize size={16} /></button></div><button className="absolute bottom-3 left-1/2 grid size-11 -translate-x-1/2 place-items-center rounded-full bg-rose-500 text-white" onClick={() => void endCall(true)} aria-label="Ukončit hovor"><PhoneOff size={18} /></button></div> : <div className="flex min-h-[154px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[.1] bg-black/10 text-center"><span className="mb-3 grid size-11 place-items-center rounded-full bg-pink-400/10 text-[#ff7aaa]"><Phone size={18} /></span><p className="text-sm text-white/65">{connecting ? "Připojuji kameru…" : "Zavolejte si tváří v tvář"}</p><button className="button-primary mt-4" onClick={() => void startCall()} disabled={connecting || !couple || !signalReady}>{connecting ? "Připravuji…" : signalReady ? "Zahájit videohovor" : "Připojuji signalizaci…"}<Video size={16} /></button></div>}
  </section>;
}