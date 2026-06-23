import type { ReferenceImage } from "@/types/image";
import type { ReferenceVideo } from "@/types/media";

export async function extractVideoPromptFrames(videos: ReferenceVideo[], maxFramesPerVideo = 3): Promise<ReferenceImage[]> {
    const groups = await Promise.all(videos.map((video) => extractFrames(video, maxFramesPerVideo).catch(() => [])));
    return groups.flat();
}

async function extractFrames(video: ReferenceVideo, maxFrames: number): Promise<ReferenceImage[]> {
    if (!video.url) return [];
    const element = document.createElement("video");
    element.crossOrigin = "anonymous";
    element.muted = true;
    element.playsInline = true;
    element.preload = "auto";
    element.src = video.url;
    if (element.readyState < 1) await waitForVideoEvent(element, "loadedmetadata");

    const duration = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : 1;
    const times = frameTimes(duration, maxFrames);
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth || video.width || 1280;
    canvas.height = element.videoHeight || video.height || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];

    const frames: ReferenceImage[] = [];
    for (const [index, time] of times.entries()) {
        if (Math.abs(element.currentTime - time) > 0.01) {
            element.currentTime = time;
            await waitForVideoEvent(element, "seeked");
        }
        ctx.drawImage(element, 0, 0, canvas.width, canvas.height);
        frames.push({
            id: `${video.id}-frame-${index}`,
            name: `${video.name || video.id}-frame-${index + 1}.jpg`,
            type: "image/jpeg",
            dataUrl: canvas.toDataURL("image/jpeg", 0.9),
        });
    }
    element.removeAttribute("src");
    element.load();
    return frames;
}

function frameTimes(duration: number, maxFrames: number) {
    if (maxFrames <= 1 || duration < 1) return [0];
    const start = Math.min(0.2, duration * 0.1);
    const end = Math.max(start, duration - Math.min(0.2, duration * 0.1));
    if (maxFrames === 2) return [start, end];
    return [start, duration / 2, end];
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: "loadedmetadata" | "seeked") {
    return new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => {
            cleanup();
            reject(new Error("读取视频帧超时"));
        }, 8000);
        const cleanup = () => {
            window.clearTimeout(timer);
            video.removeEventListener(eventName, onDone);
            video.removeEventListener("error", onError);
        };
        const onDone = () => {
            cleanup();
            resolve();
        };
        const onError = () => {
            cleanup();
            reject(new Error("无法读取视频帧"));
        };
        video.addEventListener(eventName, onDone, { once: true });
        video.addEventListener("error", onError, { once: true });
    });
}
