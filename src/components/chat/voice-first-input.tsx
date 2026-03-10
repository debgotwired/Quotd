"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type AttachedFile = {
  name: string;
  type: string;
  size: number;
  url: string;
  path: string;
};

export type AudioData = {
  audioUrl: string | null;
  audioPath: string | null;
};

interface VoiceFirstInputProps {
  onSend: (message: string, files?: AttachedFile[], audio?: AudioData) => void;
  disabled?: boolean;
}

type InputMode = "voice" | "text";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export function VoiceFirstInput({ onSend, disabled }: VoiceFirstInputProps) {
  const params = useParams();
  const token = params.token as string;

  const [mode, setMode] = useState<InputMode>("voice");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textMessage, setTextMessage] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const hasText = textMessage.trim().length > 0;
  const hasFiles = attachedFiles.length > 0;

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      setRecordingDuration(0);
    }
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Audio level visualization
  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current && isRecording) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(average / 255);
      animationRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      updateAudioLevel();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, updateAudioLevel]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          setError(`${file.name} is too large. Max 50 MB.`);
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("token", token);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || `Failed to upload ${file.name}`);
          continue;
        }

        const data = await response.json();
        setAttachedFiles((prev) => [...prev, data.file]);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [token]);

  const removeFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/wav";

      // Use 24kbps for speech - optimal for voice without quality loss
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 24000,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
      setError("Microphone access denied");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const mediaRecorder = mediaRecorderRef.current;
    const stream = streamRef.current;

    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      return;
    }

    setIsRecording(false);
    setAudioLevel(0);
    setIsProcessing(true);

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const audioBlob = await new Promise<Blob>((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        resolve(blob);
      };
      mediaRecorder.stop();
    });

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    if (audioBlob.size === 0) {
      setError("No audio recorded");
      setIsProcessing(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("token", token);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Transcription failed");
      }

      const data = await response.json();

      if (data.transcript && data.transcript.trim()) {
        const audioData: AudioData | undefined =
          data.audioUrl || data.audioPath
            ? { audioUrl: data.audioUrl, audioPath: data.audioPath }
            : undefined;
        onSend(data.transcript.trim(), hasFiles ? attachedFiles : undefined, audioData);
        setAttachedFiles([]);
      } else {
        setError("No speech detected");
      }
    } catch (err) {
      console.error("Transcription error:", err);
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setIsProcessing(false);
    }
  }, [onSend, hasFiles, attachedFiles, token]);

  const handleTextSend = useCallback(() => {
    if ((!hasText && !hasFiles) || disabled) return;
    onSend(textMessage.trim(), hasFiles ? attachedFiles : undefined, undefined);
    setTextMessage("");
    setAttachedFiles([]);
  }, [textMessage, hasText, hasFiles, onSend, disabled, attachedFiles]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleTextSend();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Common elements
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
      onChange={handleFileSelect}
      className="hidden"
    />
  );

  const filePreview = hasFiles && (
    <div className="px-3 sm:px-4 py-2 border-b flex gap-2 overflow-x-auto">
      {attachedFiles.map((file, index) => (
        <div
          key={index}
          className="relative group flex-shrink-0 flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2"
        >
          {file.type.startsWith("image/") ? (
            <img src={file.url} alt={file.name} className="w-10 h-10 object-cover rounded" />
          ) : (
            <FileIcon className="w-5 h-5 text-gray-500" />
          )}
          <div className="max-w-[100px] sm:max-w-[120px]">
            <p className="truncate text-xs font-medium">{file.name}</p>
            <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => removeFile(index)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center"
          >
            <XIcon className="w-3 h-3" />
          </button>
        </div>
      ))}
      {isUploading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 px-2">
          <LoadingSpinner className="w-4 h-4" />
          <span className="text-xs">Uploading...</span>
        </div>
      )}
    </div>
  );

  const errorMessage = error && (
    <div className="px-4 py-2 text-sm text-red-600 bg-red-50 border-b text-center">
      {error}
    </div>
  );

  // VOICE MODE (Primary)
  if (mode === "voice") {
    return (
      <div className="border-t bg-white">
        {fileInput}
        {errorMessage}
        {filePreview}

        {/* Recording state */}
        {isRecording && (
          <div className="px-4 py-3 bg-gray-900 flex items-center justify-center gap-4">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-mono text-white">{formatDuration(recordingDuration)}</span>
            <div className="flex items-center gap-0.5 h-4">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="w-0.5 bg-white/60 rounded-full transition-all duration-100"
                  style={{
                    height: `${4 + Math.sin(Date.now() / 100 + i) * audioLevel * 12 + audioLevel * 8}px`,
                    opacity: 0.4 + audioLevel * 0.6
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Processing state */}
        {isProcessing && (
          <div className="px-4 py-3 bg-gray-100 flex items-center justify-center gap-3">
            <LoadingSpinner className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-600">Transcribing...</span>
          </div>
        )}

        {/* Voice-first input bar */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-center gap-4 sm:max-w-md sm:mx-auto">
            {/* Attach button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isRecording || isProcessing || isUploading}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                "bg-gray-100 text-gray-600 hover:bg-gray-200",
                "focus:outline-none focus:ring-2 focus:ring-gray-300",
                "transition-colors",
                (disabled || isUploading) && "opacity-50 cursor-not-allowed"
              )}
            >
              <PaperclipIcon className="w-5 h-5" />
            </button>

            {/* Main mic button - LARGE */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={disabled || isProcessing || isUploading}
              className={cn(
                "relative w-16 h-16 rounded-full flex items-center justify-center",
                "transition-all shadow-lg",
                isRecording
                  ? "bg-red-500 hover:bg-red-600 scale-110"
                  : "bg-gray-900 hover:bg-gray-800",
                "focus:outline-none focus:ring-4",
                isRecording ? "focus:ring-red-200" : "focus:ring-gray-300",
                (disabled || isProcessing) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isProcessing ? (
                <LoadingSpinner className="w-7 h-7 text-white" />
              ) : isRecording ? (
                <StopIcon className="w-7 h-7 text-white" />
              ) : (
                <MicIcon className="w-7 h-7 text-white" />
              )}
            </button>

            {/* Type button */}
            <button
              type="button"
              onClick={() => setMode("text")}
              disabled={disabled || isRecording || isProcessing}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                "bg-gray-100 text-gray-600 hover:bg-gray-200",
                "focus:outline-none focus:ring-2 focus:ring-gray-300",
                "transition-colors",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <KeyboardIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Status text */}
          <p className="text-center text-sm text-gray-500 mt-3">
            {isProcessing
              ? "Converting speech to text..."
              : isRecording
              ? "Tap to stop"
              : hasFiles
              ? `${attachedFiles.length} file${attachedFiles.length > 1 ? "s" : ""} attached`
              : "Tap to speak"
            }
          </p>
        </div>
      </div>
    );
  }

  // TEXT MODE (Secondary)
  return (
    <div className="border-t bg-white">
      {fileInput}
      {errorMessage}
      {filePreview}

      <div className="px-3 sm:px-4 py-3">
        <div className="flex items-center gap-2 sm:max-w-3xl sm:mx-auto">
          {/* Attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className={cn(
              "flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center",
              "bg-gray-100 text-gray-600 hover:bg-gray-200",
              "focus:outline-none focus:ring-2 focus:ring-gray-300",
              "transition-colors",
              (disabled || isUploading) && "opacity-50 cursor-not-allowed"
            )}
          >
            <PaperclipIcon className="w-5 h-5" />
          </button>

          {/* Text input */}
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={textMessage}
              onChange={(e) => {
                setTextMessage(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={disabled}
              rows={1}
              className={cn(
                "w-full resize-none rounded-3xl border border-gray-200 bg-white",
                "px-4 h-11 py-2.5 text-[15px] leading-6",
                "focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent",
                "disabled:opacity-50 disabled:bg-gray-50",
                "max-h-[120px] overflow-y-auto",
                "placeholder:text-gray-400"
              )}
            />
          </div>

          {/* Mic / Send button */}
          {hasText || hasFiles ? (
            <button
              type="button"
              onClick={handleTextSend}
              disabled={disabled}
              className={cn(
                "flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center",
                "bg-gray-900 text-white hover:bg-gray-800",
                "focus:outline-none focus:ring-2 focus:ring-gray-300",
                "transition-colors",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <SendIcon className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode("voice")}
              disabled={disabled}
              className={cn(
                "flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center",
                "bg-gray-900 text-white hover:bg-gray-800",
                "focus:outline-none focus:ring-2 focus:ring-gray-300",
                "transition-colors",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <MicIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function KeyboardIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="6" y1="8" x2="6" y2="8" />
      <line x1="10" y1="8" x2="10" y2="8" />
      <line x1="14" y1="8" x2="14" y2="8" />
      <line x1="18" y1="8" x2="18" y2="8" />
      <line x1="6" y1="12" x2="6" y2="12" />
      <line x1="10" y1="12" x2="10" y2="12" />
      <line x1="14" y1="12" x2="14" y2="12" />
      <line x1="18" y1="12" x2="18" y2="12" />
      <line x1="7" y1="16" x2="17" y2="16" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn("animate-spin", className)}>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1" />
    </svg>
  );
}
