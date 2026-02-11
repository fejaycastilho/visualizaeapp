import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";

admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

// API key loaded from functions/.env (not exposed to frontend)
const getApiKey = () => process.env.GEMINI_API_KEY || "";

// Credit costs
const IMAGE_COST = 1;
const VIDEO_COST = 10;

// Special account with initial credits
const SPECIAL_EMAIL = "castilho.arq.br@gmail.com";
const SPECIAL_CREDITS = 5000;

/**
 * Ensures a user document exists in Firestore.
 * Creates one with default credits on first login.
 */
async function ensureUserDoc(uid: string, email: string | undefined): Promise<number> {
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        const initialCredits = email === SPECIAL_EMAIL ? SPECIAL_CREDITS : 0;
        await userRef.set({
            email: email || "",
            credits: initialCredits,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return initialCredits;
    }

    return userDoc.data()?.credits ?? 0;
}

/**
 * Verifies user has enough credits and decrements them.
 * Uses a transaction to prevent race conditions.
 */
async function deductCredits(uid: string, cost: number): Promise<number> {
    const userRef = db.collection("users").doc(uid);

    return db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
            throw new HttpsError("not-found", "Usuário não encontrado.");
        }

        const currentCredits = userDoc.data()?.credits ?? 0;
        if (currentCredits < cost) {
            throw new HttpsError(
                "resource-exhausted",
                `Créditos insuficientes. Você tem ${currentCredits}, mas precisa de ${cost}.`
            );
        }

        const newCredits = currentCredits - cost;
        transaction.update(userRef, { credits: newCredits });
        return newCredits;
    });
}

/**
 * Cloud Function: generateImage
 * Proxies image generation requests to Gemini API.
 */
export const generateImage = onCall(
    {
        timeoutSeconds: 120,
        memory: "512MiB",
        maxInstances: 10,
    },
    async (request) => {
        // Auth check
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Você precisa estar logado.");
        }

        const uid = request.auth.uid;
        const email = request.auth.token.email;

        // Ensure user doc exists
        await ensureUserDoc(uid, email);

        // Deduct credits BEFORE calling API
        const remainingCredits = await deductCredits(uid, IMAGE_COST);

        const { model, prompt, aspectRatio, widthLabel, referenceImages, forceRatio } = request.data;

        try {
            const ai = new GoogleGenAI({ apiKey: getApiKey() });

            // Build config
            const config: any = { imageConfig: {} };
            const hasInputImages = referenceImages && referenceImages.length > 0;

            if (!hasInputImages || forceRatio) {
                config.imageConfig.aspectRatio = aspectRatio || "1:1";
            }

            if (model === "gemini-3-pro-image-preview" && (!hasInputImages || forceRatio)) {
                config.imageConfig.imageSize = widthLabel || "1K";
            }

            // Build parts
            const parts: any[] = [];
            if (hasInputImages) {
                for (const imgBase64 of referenceImages) {
                    const base64Data = imgBase64.includes(",") ? imgBase64.split(",")[1] : imgBase64;
                    parts.push({
                        inlineData: { mimeType: "image/png", data: base64Data },
                    });
                }
            }
            parts.push({ text: prompt });

            const response = await ai.models.generateContent({
                model: model,
                contents: { parts },
                config,
            });

            // Parse response
            if (response.candidates && response.candidates.length > 0) {
                const content = response.candidates[0].content;
                if (content && content.parts) {
                    for (const part of content.parts) {
                        if (part.inlineData && part.inlineData.data) {
                            return {
                                imageBase64: `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`,
                                remainingCredits,
                            };
                        }
                    }
                }
            }

            // If we got here, API returned no image — refund the credit
            await db.collection("users").doc(uid).update({
                credits: admin.firestore.FieldValue.increment(IMAGE_COST),
            });

            throw new HttpsError("internal", "A API não retornou nenhuma imagem. Tente novamente.");
        } catch (error: any) {
            // If it's already an HttpsError, rethrow
            if (error instanceof HttpsError) throw error;

            // Refund credit on API error
            await db.collection("users").doc(uid).update({
                credits: admin.firestore.FieldValue.increment(IMAGE_COST),
            });

            console.error("Gemini API Error:", error);
            throw new HttpsError("internal", error.message || "Erro ao gerar imagem.");
        }
    }
);

/**
 * Cloud Function: generateVideo
 * Proxies video generation requests to Kling 3.0 via Fal.ai API.
 */
export const generateVideo = onCall(
    {
        timeoutSeconds: 540, // 9 minutes — video generation can be slow
        memory: "1GiB",
        maxInstances: 5,
    },
    async (request) => {
        // Auth check
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Você precisa estar logado.");
        }

        const uid = request.auth.uid;
        const email = request.auth.token.email;

        // Ensure user doc exists
        await ensureUserDoc(uid, email);

        // Deduct credits BEFORE calling API
        const remainingCredits = await deductCredits(uid, VIDEO_COST);

        const { prompt, imageBase64, lastFrameBase64, aspectRatio, duration, generateAudio } = request.data;

        const FAL_API_KEY = process.env.FAL_API_KEY;
        if (!FAL_API_KEY) {
            await db.collection("users").doc(uid).update({
                credits: admin.firestore.FieldValue.increment(VIDEO_COST),
            });
            throw new HttpsError("internal", "FAL_API_KEY não configurada no servidor.");
        }

        try {
            // Build request body for Fal.ai Kling V3 Pro Image-to-Video
            const falBody: any = {
                prompt: prompt || "Smooth cinematic camera movement",
                image_url: imageBase64, // Fal.ai accepts data URLs directly
                aspect_ratio: aspectRatio || "16:9",
                duration: duration || "5",
                generate_audio: generateAudio !== false, // default true
            };

            // End frame for interpolation
            if (lastFrameBase64) {
                falBody.tail_image_url = lastFrameBase64;
            }

            console.log(`📤 Kling request: aspect_ratio=${falBody.aspect_ratio}, duration=${falBody.duration}, audio=${falBody.generate_audio}, prompt="${falBody.prompt?.slice(0, 50)}..."`);

            // Submit to Fal.ai queue
            const submitResponse = await fetch(
                "https://queue.fal.run/fal-ai/kling-video/v3/pro/image-to-video",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Key ${FAL_API_KEY}`,
                    },
                    body: JSON.stringify(falBody),
                }
            );

            if (!submitResponse.ok) {
                const errText = await submitResponse.text();
                console.error("Fal.ai submit error:", submitResponse.status, errText);
                await db.collection("users").doc(uid).update({
                    credits: admin.firestore.FieldValue.increment(VIDEO_COST),
                });
                throw new HttpsError("internal", `Erro ao submeter para Kling: ${submitResponse.status}`);
            }

            const submitData = await submitResponse.json();
            const requestId = submitData.request_id;
            const statusUrl = submitData.status_url || `https://queue.fal.run/fal-ai/kling-video/v3/pro/image-to-video/requests/${requestId}/status`;
            const resultUrl = submitData.response_url || `https://queue.fal.run/fal-ai/kling-video/v3/pro/image-to-video/requests/${requestId}`;

            console.log(`Kling job submitted: ${requestId}`);

            // Polling loop — wait up to 8 minutes
            const maxPolls = 96; // 96 * 5s = 480s = 8min
            for (let i = 0; i < maxPolls; i++) {
                await new Promise((resolve) => setTimeout(resolve, 5000));

                const statusResponse = await fetch(statusUrl, {
                    headers: { "Authorization": `Key ${FAL_API_KEY}` },
                });

                if (!statusResponse.ok) continue;

                const statusData = await statusResponse.json();
                console.log(`Kling poll ${i + 1}: ${statusData.status}`);

                if (statusData.status === "COMPLETED") {
                    break;
                }

                if (statusData.status === "FAILED") {
                    await db.collection("users").doc(uid).update({
                        credits: admin.firestore.FieldValue.increment(VIDEO_COST),
                    });
                    throw new HttpsError("internal", "Kling: geração falhou. Tente com outro prompt.");
                }
            }

            // Fetch the result
            const resultResponse = await fetch(resultUrl, {
                headers: { "Authorization": `Key ${FAL_API_KEY}` },
            });

            if (!resultResponse.ok) {
                await db.collection("users").doc(uid).update({
                    credits: admin.firestore.FieldValue.increment(VIDEO_COST),
                });
                throw new HttpsError("internal", "Erro ao buscar resultado do Kling.");
            }

            const resultData = await resultResponse.json();
            const videoUrl = resultData?.video?.url;

            if (!videoUrl) {
                await db.collection("users").doc(uid).update({
                    credits: admin.firestore.FieldValue.increment(VIDEO_COST),
                });
                throw new HttpsError("internal", "Nenhum vídeo retornado pelo Kling. Tente novamente.");
            }

            // Upload video to Firebase Storage instead of returning base64
            const videoResponse = await fetch(videoUrl);
            if (!videoResponse.ok) {
                await db.collection("users").doc(uid).update({
                    credits: admin.firestore.FieldValue.increment(VIDEO_COST),
                });
                throw new HttpsError("internal", `Erro ao baixar vídeo: ${videoResponse.status}`);
            }

            const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
            const videoFileName = `videos/${uid}/${Date.now()}_${requestId}.mp4`;
            const file = bucket.file(videoFileName);

            await file.save(videoBuffer, {
                metadata: { contentType: 'video/mp4' },
            });

            // Make the file publicly readable and get download URL
            await file.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${videoFileName}`;

            console.log(`✅ Video uploaded to Storage: ${videoFileName}`);

            return {
                videoUrl: publicUrl,
                remainingCredits,
            };
        } catch (error: any) {
            if (error instanceof HttpsError) throw error;

            // Refund credit on API error
            await db.collection("users").doc(uid).update({
                credits: admin.firestore.FieldValue.increment(VIDEO_COST),
            });

            console.error("Kling API Error:", error);
            throw new HttpsError("internal", error.message || "Erro ao gerar vídeo.");
        }
    }
);

/**
 * Cloud Function: generateVideoMultiShot
 * Generates a multi-shot video using Kling 3.0's native multi_prompt via Fal.ai.
 * All scenes are generated in a single API call for better consistency.
 */
export const generateVideoMultiShot = onCall(
    {
        timeoutSeconds: 540, // 9 minutes
        memory: "1GiB",
        maxInstances: 5,
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Você precisa estar logado.");
        }

        const uid = request.auth.uid;
        const email = request.auth.token.email;
        await ensureUserDoc(uid, email);

        const remainingCredits = await deductCredits(uid, VIDEO_COST);

        const { scenes, imageBase64, aspectRatio, generateAudio } = request.data;

        // scenes: Array<{ prompt: string, duration: string }>
        if (!scenes || !Array.isArray(scenes) || scenes.length < 2) {
            await db.collection("users").doc(uid).update({
                credits: admin.firestore.FieldValue.increment(VIDEO_COST),
            });
            throw new HttpsError("invalid-argument", "Multi-shot requer pelo menos 2 cenas.");
        }

        if (scenes.length > 6) {
            await db.collection("users").doc(uid).update({
                credits: admin.firestore.FieldValue.increment(VIDEO_COST),
            });
            throw new HttpsError("invalid-argument", "Multi-shot suporta no máximo 6 cenas.");
        }

        const FAL_API_KEY = process.env.FAL_API_KEY;
        if (!FAL_API_KEY) {
            await db.collection("users").doc(uid).update({
                credits: admin.firestore.FieldValue.increment(VIDEO_COST),
            });
            throw new HttpsError("internal", "FAL_API_KEY não configurada no servidor.");
        }

        try {
            // Calculate total duration
            const totalDuration = scenes.reduce((sum: number, s: any) => sum + parseInt(s.duration || "5"), 0);
            if (totalDuration > 15) {
                throw new HttpsError("invalid-argument", `Duração total ${totalDuration}s excede o máximo de 15s para multi-shot.`);
            }
            if (totalDuration < 3) {
                throw new HttpsError("invalid-argument", `Duração total ${totalDuration}s abaixo do mínimo de 3s.`);
            }

            // Build multi_prompt array
            const multiPrompt = scenes.map((s: any) => ({
                prompt: s.prompt || "Smooth cinematic camera movement",
                duration: s.duration || "5",
            }));

            const falBody: any = {
                multi_prompt: multiPrompt,
                shot_type: "customize",
                aspect_ratio: aspectRatio || "16:9",
                duration: String(totalDuration),
                generate_audio: generateAudio !== false,
            };

            // Start image (first scene's frame)
            if (imageBase64) {
                falBody.start_image_url = imageBase64;
            }

            console.log(`📤 Kling MULTI-SHOT: ${scenes.length} shots, total=${totalDuration}s, aspect=${falBody.aspect_ratio}`);
            console.log(`   Shots: ${multiPrompt.map((p: any) => `"${p.prompt.slice(0, 30)}..." (${p.duration}s)`).join(" → ")}`);

            // Submit to Fal.ai queue
            const submitResponse = await fetch(
                "https://queue.fal.run/fal-ai/kling-video/v3/pro/image-to-video",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Key ${FAL_API_KEY}`,
                    },
                    body: JSON.stringify(falBody),
                }
            );

            if (!submitResponse.ok) {
                const errText = await submitResponse.text();
                console.error("Fal.ai multi-shot submit error:", submitResponse.status, errText);
                await db.collection("users").doc(uid).update({
                    credits: admin.firestore.FieldValue.increment(VIDEO_COST),
                });
                throw new HttpsError("internal", `Erro ao submeter multi-shot: ${submitResponse.status}`);
            }

            const submitData = await submitResponse.json();
            const requestId = submitData.request_id;
            const statusUrl = submitData.status_url || `https://queue.fal.run/fal-ai/kling-video/v3/pro/image-to-video/requests/${requestId}/status`;
            const resultUrl = submitData.response_url || `https://queue.fal.run/fal-ai/kling-video/v3/pro/image-to-video/requests/${requestId}`;

            console.log(`Kling multi-shot job submitted: ${requestId}`);

            // Polling — up to 8 min
            const maxPolls = 96;
            for (let i = 0; i < maxPolls; i++) {
                await new Promise((resolve) => setTimeout(resolve, 5000));
                const statusResponse = await fetch(statusUrl, {
                    headers: { "Authorization": `Key ${FAL_API_KEY}` },
                });
                if (!statusResponse.ok) continue;
                const statusData = await statusResponse.json();
                console.log(`Kling multi-shot poll ${i + 1}: ${statusData.status}`);

                if (statusData.status === "COMPLETED") break;
                if (statusData.status === "FAILED") {
                    await db.collection("users").doc(uid).update({
                        credits: admin.firestore.FieldValue.increment(VIDEO_COST),
                    });
                    throw new HttpsError("internal", "Kling multi-shot falhou. Tente com outros prompts.");
                }
            }

            // Fetch result
            const resultResponse = await fetch(resultUrl, {
                headers: { "Authorization": `Key ${FAL_API_KEY}` },
            });

            if (!resultResponse.ok) {
                await db.collection("users").doc(uid).update({
                    credits: admin.firestore.FieldValue.increment(VIDEO_COST),
                });
                throw new HttpsError("internal", "Erro ao buscar resultado multi-shot.");
            }

            const resultData = await resultResponse.json();
            const videoUrl = resultData?.video?.url;

            if (!videoUrl) {
                await db.collection("users").doc(uid).update({
                    credits: admin.firestore.FieldValue.increment(VIDEO_COST),
                });
                throw new HttpsError("internal", "Nenhum vídeo multi-shot retornado.");
            }

            // Upload video to Firebase Storage
            const videoResponse = await fetch(videoUrl);
            if (!videoResponse.ok) {
                await db.collection("users").doc(uid).update({
                    credits: admin.firestore.FieldValue.increment(VIDEO_COST),
                });
                throw new HttpsError("internal", `Erro ao baixar vídeo: ${videoResponse.status}`);
            }

            const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
            const videoFileName = `videos/${uid}/${Date.now()}_${requestId}_multishot.mp4`;
            const file = bucket.file(videoFileName);

            await file.save(videoBuffer, {
                metadata: { contentType: 'video/mp4' },
            });

            await file.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${videoFileName}`;

            console.log(`✅ Multi-shot video uploaded to Storage: ${videoFileName}`);

            return {
                videoUrl: publicUrl,
                remainingCredits,
            };
        } catch (error: any) {
            if (error instanceof HttpsError) throw error;
            await db.collection("users").doc(uid).update({
                credits: admin.firestore.FieldValue.increment(VIDEO_COST),
            });
            console.error("Kling Multi-Shot Error:", error);
            throw new HttpsError("internal", error.message || "Erro ao gerar multi-shot.");
        }
    }
);

/**
 * Cloud Function: getUserCredits
 * Returns the current user's credit balance.
 * Also creates the user doc if it doesn't exist (first login).
 */
export const getUserCredits = onCall(
    { maxInstances: 20 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Você precisa estar logado.");
        }

        const uid = request.auth.uid;
        const email = request.auth.token.email;
        const credits = await ensureUserDoc(uid, email);

        return { credits };
    }
);
