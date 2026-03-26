import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

/**
 * Records the Electron window using the renderer's own MediaStream.
 * Uses getDisplayMedia with self-capture — no desktopCapturer IPC needed
 * in Electron 32+ (getDisplayMedia is available in renderer).
 *
 * Output: WebM file saved via download or Electron save dialog.
 */
export function useWindowRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const toggle = useCallback(async () => {
    if (isRecording) {
      // Stop
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    // Start — request the current tab/window
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
        // @ts-expect-error preferCurrentTab is a Chrome/Electron extension
        preferCurrentTab: true,
      });

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 8_000_000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Release tracks
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);

        if (chunksRef.current.length === 0) return;

        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        a.download = `scope4mac-ui-${ts}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("UI recording saved");
      };

      // Handle user cancelling the screen picker
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        if (mediaRecorderRef.current?.state !== "inactive") {
          mediaRecorderRef.current?.stop();
        }
      });

      recorder.start(1000); // 1s chunks
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e) {
      // User cancelled the screen picker or API not available
      if ((e as Error).name !== "NotAllowedError") {
        toast.error(`Window recording failed: ${e}`);
      }
    }
  }, [isRecording]);

  return { isRecording, toggle };
}
