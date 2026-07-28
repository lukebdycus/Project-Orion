import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react';

export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const seekProgress = duration > 0 ? (currentTime / duration) * 100 : 0;

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    const nextAudioUrl = URL.createObjectURL(selectedFile);

    audioRef.current?.pause();
    setAudioUrl(nextAudioUrl);
    setFileName(selectedFile.name);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError(null);

    // Allows the same file to be selected again later.
    event.target.value = '';
  }

  async function togglePlayback() {
    const audio = audioRef.current;

    if (!audio || !audioUrl) return;

    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      setError('Playback failed.');
    }
  }

  function handleSeek(event: ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    const nextTime = Number(event.target.value);

    if (!audio || !Number.isFinite(nextTime)) return;

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function updateDuration() {
    const nextDuration = audioRef.current?.duration ?? 0;

    setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
  }

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return (
    <div className="audio-dock">
      <div className="audio-surface audio-player">
        <button
          className="play-button"
          type="button"
          onClick={togglePlayback}
          disabled={!audioUrl}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          <span
            className="material-symbols-outlined play-button-icon"
            aria-hidden="true"
          >
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>

        <span className="time-label">{formatTime(currentTime)}</span>

        <input
          className="seek-slider"
          type="range"
          min="0"
          max={duration || 1}
          step="0.01"
          value={Math.min(currentTime, duration || 0)}
          onChange={handleSeek}
          disabled={!audioUrl || duration <= 0}
          aria-label="Song position"
          style={
            {
              '--seek-progress': `${seekProgress}%`,
            } as CSSProperties
          }
        />

        <span className="time-label">{formatTime(duration)}</span>
      </div>

      <button
        className="audio-surface select-audio-button"
        type="button"
        onClick={openFilePicker}
        title={fileName || 'Select an audio file'}
      >
        {fileName ? 'Change audio' : 'Select audio'}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.m4a,.aac,.webm,audio/*"
        onChange={handleFileSelect}
        hidden
      />

      <audio
        ref={audioRef}
        className="audio-engine"
        src={audioUrl ?? undefined}
        preload="metadata"
        onLoadedMetadata={updateDuration}
        onDurationChange={updateDuration}
        onTimeUpdate={(event) => {
          setCurrentTime(event.currentTarget.currentTime);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => setError('Unable to play this audio file.')}
      />

      {error && (
        <p className="audio-error" role="status">
          {error}
        </p>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return [
      hours,
      minutes.toString().padStart(2, '0'),
      remainingSeconds.toString().padStart(2, '0'),
    ].join(':');
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

