
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";
import { ModelType } from "../types";

/**
 * Generates an image via Cloud Function (API key is protected on the server).
 * Maintains the same signature as the previous direct API call.
 */
export const generateImageContent = async (
  model: ModelType,
  prompt: string,
  aspectRatio: string = "1:1",
  widthLabel: string = "1K",
  referenceImages: string[] = [],
  forceRatio: boolean = false
): Promise<string | null> => {
  try {
    const callable = httpsCallable(functions, "generateImage", { timeout: 120000 });
    const result = await callable({
      model,
      prompt,
      aspectRatio,
      widthLabel,
      referenceImages,
      forceRatio,
    });

    const data = result.data as any;
    return data.imageBase64 || null;
  } catch (error: any) {
    console.error("Cloud Function generateImage Error:", error);
    // Re-throw with the server error message if available
    if (error.code === "functions/resource-exhausted") {
      throw new Error(error.message || "Créditos insuficientes.");
    }
    throw error;
  }
};

/**
 * Generates a video via Cloud Function (Kling 3.0 via Fal.ai).
 * Returns a permanent Firebase Storage URL for the video.
 */
export const generateVideo = async (
  prompt: string,
  imageBase64: string,
  lastFrameBase64?: string,
  aspectRatio: string = '16:9',
  duration: string = '5',
  generateAudio: boolean = true
): Promise<string | null> => {
  try {
    const callable = httpsCallable(functions, "generateVideo", { timeout: 600000 });
    const result = await callable({
      prompt,
      imageBase64,
      lastFrameBase64,
      aspectRatio,
      duration,
      generateAudio,
    });

    const data = result.data as any;
    return data.videoUrl || null;
  } catch (error: any) {
    console.error("Cloud Function generateVideo Error:", error);
    if (error.code === "functions/resource-exhausted") {
      throw new Error(error.message || "Créditos insuficientes.");
    }
    if (error.message?.includes("SAFETY_FILTER")) {
      throw new Error(error.message);
    }
    throw error;
  }
};

/**
 * Generates a multi-shot video via Cloud Function (Kling 3.0 multi_prompt).
 * scenes: Array<{ prompt: string, duration: string }>
 * Returns a permanent Firebase Storage URL for the complete multi-shot video.
 */
export const generateVideoMultiShot = async (
  scenes: Array<{ prompt: string; duration: string }>,
  imageBase64: string,
  aspectRatio: string = '16:9',
  generateAudio: boolean = true
): Promise<string | null> => {
  try {
    const callable = httpsCallable(functions, "generateVideoMultiShot", { timeout: 600000 });
    const result = await callable({
      scenes,
      imageBase64,
      aspectRatio,
      generateAudio,
    });

    const data = result.data as any;
    return data.videoUrl || null;
  } catch (error: any) {
    console.error("Cloud Function generateVideoMultiShot Error:", error);
    if (error.code === "functions/resource-exhausted") {
      throw new Error(error.message || "Créditos insuficientes.");
    }
    throw error;
  }
};

/**
 * Helper to convert a numeric ratio to the closest Gemini API allowed enum string
 * Gemini allowed: "1:1", "3:4", "4:3", "9:16", "16:9"
 */
export const getClosestAspectRatio = (ratio: number): string => {
  const ratios = [
    { key: "1:1", val: 1.0 },
    { key: "3:4", val: 0.75 },
    { key: "4:3", val: 1.33 },
    { key: "9:16", val: 0.5625 },
    { key: "16:9", val: 1.77 },
  ];

  const closest = ratios.reduce((prev, curr) => {
    return (Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev);
  });

  return closest.key;
};
