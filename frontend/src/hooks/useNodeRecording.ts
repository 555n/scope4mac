import { useState, useCallback } from "react";
import { startNodeRecording, stopNodeRecording } from "../lib/api";
import { toast } from "sonner";

declare global {
  interface Window {
    scope?: {
      browseDirectory?: (title?: string) => Promise<string | null>;
      openPath?: (path: string) => Promise<string>;
      [key: string]: unknown;
    };
  }
}

export function useNodeRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDir, setRecordingDir] = useState<string | null>(null);
  const [recordedFiles, setRecordedFiles] = useState<string[]>([]);

  const toggle = useCallback(async () => {
    if (isRecording) {
      try {
        const result = await stopNodeRecording();
        setIsRecording(false);
        setRecordedFiles(result.files);
        if (result.files.length > 0) {
          toast.success(`Recorded ${result.files.length} pipeline stage(s)`);
        }
      } catch (e) {
        toast.error(`Stop recording failed: ${e}`);
      }
    } else {
      try {
        const dir = recordingDir || undefined;
        const result = await startNodeRecording(dir);
        setIsRecording(result.recording);
        if (result.recording) {
          toast.success(`Recording ${result.num_recorders} pipeline stage(s)`);
        }
      } catch (e) {
        toast.error(`Start recording failed: ${e}`);
      }
    }
  }, [isRecording, recordingDir]);

  const chooseDir = useCallback(async () => {
    const dir = await window.scope?.browseDirectory?.("Choose recording folder");
    if (dir) setRecordingDir(dir);
  }, []);

  const openDir = useCallback(async () => {
    const dir = recordingDir || recordedFiles[0]?.replace(/\/[^/]+$/, "");
    if (dir) {
      await window.scope?.openPath?.(dir);
    }
  }, [recordingDir, recordedFiles]);

  return { isRecording, recordingDir, recordedFiles, toggle, chooseDir, openDir };
}
