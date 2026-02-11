import { useState, useCallback } from 'react';
import { Scene } from '../../types';

interface UseStudioExportParams {
    scenes: Scene[];
}

export function useStudioExport({ scenes }: UseStudioExportParams) {
    const [isExporting, setIsExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState('');

    const handleExportFullMovie = useCallback(async () => {
        const validScenes = scenes.filter(s => s.videos.length > 0 && s.selectedVideoIndex !== -1);

        if (validScenes.length === 0) {
            alert("Nenhuma cena gerada para exportar.");
            return;
        }

        setIsExporting(true);
        setExportStatus("Detectando dimensões do vídeo...");

        try {
            // Step 1: Detect actual video dimensions from first clip
            const firstVideoUrl = validScenes[0].videos[validScenes[0].selectedVideoIndex];
            const probeVideo = document.createElement('video');
            probeVideo.crossOrigin = 'anonymous';
            probeVideo.muted = true;
            probeVideo.src = firstVideoUrl;

            const { videoWidth, videoHeight } = await new Promise<{ videoWidth: number, videoHeight: number }>((resolve) => {
                probeVideo.onloadedmetadata = () => {
                    resolve({ videoWidth: probeVideo.videoWidth, videoHeight: probeVideo.videoHeight });
                };
                probeVideo.load();
            });

            const width = videoWidth || 1920;
            const height = videoHeight || 1080;
            console.log(`🎬 Export: detected video dimensions ${width}x${height}`);

            setExportStatus("Preparando estúdio...");

            // Setup Audio Context for sound capturing
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const dest = audioCtx.createMediaStreamDestination();

            // Setup Canvas with ACTUAL video dimensions
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Could not create canvas context");

            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            // Capture Streams
            const canvasStream = canvas.captureStream(30);

            // Combine Video track from canvas and Audio track from AudioContext
            const combinedTracks = [
                ...canvasStream.getVideoTracks(),
                ...dest.stream.getAudioTracks()
            ];
            const combinedStream = new MediaStream(combinedTracks);

            const chunks: Blob[] = [];

            // Try MP4 (H.264) first, then WebM VP9, then fallback
            let recorder: MediaRecorder;
            let usedMimeType = 'video/webm';
            const mimeOptions = [
                'video/mp4;codecs=avc1',
                'video/mp4',
                'video/webm;codecs=vp9',
                'video/webm',
            ];

            for (const mime of mimeOptions) {
                if (MediaRecorder.isTypeSupported(mime)) {
                    try {
                        recorder = new MediaRecorder(combinedStream, { mimeType: mime, videoBitsPerSecond: 8000000 });
                        usedMimeType = mime;
                        console.log(`🎬 Export: using codec ${mime}`);
                        break;
                    } catch { /* try next */ }
                }
            }
            if (!recorder!) {
                recorder = new MediaRecorder(combinedStream);
                console.log('🎬 Export: using default codec');
            }

            const isMP4 = usedMimeType.startsWith('video/mp4');
            const fileExt = isMP4 ? 'mp4' : 'webm';

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: usedMimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Visualizae_FullMovie_${Date.now()}.${fileExt}`;
                a.click();
                URL.revokeObjectURL(url);
                setIsExporting(false);
                setExportStatus('');
                audioCtx.close();
            };

            recorder.start();

            // Helper Video Element
            const videoEl = document.createElement('video');
            videoEl.crossOrigin = 'anonymous';
            videoEl.muted = false;
            videoEl.volume = 1.0;

            // Connect Video Element to Audio Context
            const source = audioCtx.createMediaElementSource(videoEl);
            source.connect(dest);
            source.connect(audioCtx.destination);

            let currentSceneIndex = 0;
            let animationFrameId: number;

            const drawFrame = () => {
                if (!videoEl.paused && !videoEl.ended) {
                    const vw = videoEl.videoWidth;
                    const vh = videoEl.videoHeight;
                    if (vw > 0 && vh > 0) {
                        const scale = Math.max(width / vw, height / vh);
                        const sw = vw * scale;
                        const sh = vh * scale;
                        const sx = (width - sw) / 2;
                        const sy = (height - sh) / 2;
                        ctx.drawImage(videoEl, sx, sy, sw, sh);
                    } else {
                        ctx.drawImage(videoEl, 0, 0, width, height);
                    }
                }
                animationFrameId = requestAnimationFrame(drawFrame);
            };

            const playNext = async () => {
                if (currentSceneIndex >= validScenes.length) {
                    cancelAnimationFrame(animationFrameId);
                    setTimeout(() => recorder.stop(), 500);
                    return;
                }

                const scene = validScenes[currentSceneIndex];
                setExportStatus(`Gravando cena ${currentSceneIndex + 1}/${validScenes.length}...`);

                const selectedVideoUrl = scene.videos[scene.selectedVideoIndex];
                videoEl.src = selectedVideoUrl;

                await new Promise((resolve) => {
                    videoEl.oncanplaythrough = resolve;
                    videoEl.load();
                });

                try {
                    await videoEl.play();
                } catch (e) {
                    console.error("Auto-play error", e);
                }

                if (currentSceneIndex === 0) drawFrame();

                videoEl.onended = () => {
                    currentSceneIndex++;
                    playNext();
                };
            };

            playNext();

        } catch (error) {
            console.error(error);
            alert("Erro na exportação.");
            setIsExporting(false);
        }
    }, [scenes]);

    return {
        isExporting,
        exportStatus,
        handleExportFullMovie,
    };
}
