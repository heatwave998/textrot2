import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { AspectRatio, Orientation, GenModel, ImageResolution } from "../types";

// Initialize default client
const defaultAi = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to get client (either default or custom)
const getClient = (apiKey?: string) => {
    if (apiKey && apiKey.trim().length > 0) {
        return new GoogleGenAI({ apiKey });
    }
    return defaultAi;
};

// Helper: Wrap promise with abort signal support
const withAbort = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
    if (!signal) return promise;
    
    return new Promise((resolve, reject) => {
        const abortHandler = () => {
            reject(new DOMException('Aborted', 'AbortError'));
        };

        if (signal.aborted) {
            abortHandler();
            return;
        }

        signal.addEventListener('abort', abortHandler);

        promise.then(
            (val) => {
                signal.removeEventListener('abort', abortHandler);
                resolve(val);
            },
            (err) => {
                signal.removeEventListener('abort', abortHandler);
                reject(err);
            }
        );
    });
};

// Helper to determine the API-compatible aspect ratio string
const getApiAspectRatio = (aspectRatio: AspectRatio, orientation: Orientation): string => {
    // API supports: "1:1", "3:4", "4:3", "9:16", "16:9"
    if (aspectRatio === '1:1') return '1:1';
    
    if (aspectRatio === '16:9') {
        return orientation === 'portrait' ? '9:16' : '16:9';
    } 
    
    if (aspectRatio === '4:3') {
        return orientation === 'portrait' ? '3:4' : '4:3';
    } 
    
    if (aspectRatio === '3:2') {
        // 3:2 is not natively supported by Gemini 3 Pro Image Preview. 
        // We map it to the closest available ratio (4:3 / 3:4).
        return orientation === 'portrait' ? '3:4' : '4:3';
    }

    // Default fallback
    return orientation === 'portrait' ? '3:4' : '4:3';
};

export interface GeneratedImageResult {
    imageData: string;
    groundingMetadata?: any;
}

/**
 * Generates the visual background using Gemini models.
 * Supports switching between Nano Banana Pro (Gemini 3 Pro) and Nano Banana (Gemini 2.5 Flash).
 */
export const generateBackgroundImage = async (
    prompt: string, 
    aspectRatio: AspectRatio, 
    orientation: 'landscape' | 'portrait' = 'landscape',
    apiKey?: string,
    model: GenModel = 'gemini-3-pro-image-preview',
    resolution: ImageResolution = '1K',
    quality: string = '',
    systemPrompt: string = '',
    signal?: AbortSignal,
    logger?: (msg: string) => void
): Promise<GeneratedImageResult> => {
  try {
    const ai = getClient(apiKey);
    const targetRatio = getApiAspectRatio(aspectRatio, orientation);

    // Config depends on the model
    const config: any = {
        imageConfig: {
            aspectRatio: targetRatio,
        }
    };

    // Only Gemini 3 Pro Image Preview supports 'imageSize' and 'googleSearch'
    if (model === 'gemini-3-pro-image-preview') {
        config.imageConfig.imageSize = resolution;
        config.tools = [{ googleSearch: {} }];
    }

    // Cleanly construct prompt by filtering out empty strings
    const promptParts = [prompt, quality, systemPrompt].filter(p => p && p.trim().length > 0);
    const fullPrompt = promptParts.join('. ');

    // Calculate approximate request size
    const requestPayloadJSON = JSON.stringify({
        model,
        contents: [{ parts: [{ text: fullPrompt }] }],
        config
    });
    const requestSizeKB = (new TextEncoder().encode(requestPayloadJSON).length / 1024).toFixed(2);

    if (logger) {
        logger(`[REQUEST] Initiating Generation...`);
        logger(`  Model: ${model}`);
        logger(`  Resolution: ${resolution}`);
        logger(`  Aspect Ratio: ${targetRatio}`);
        logger(`  Payload Size: ~${requestSizeKB} KB`);
        logger(`  -- Parameters --`);
        logger(`  Base Prompt: "${prompt}"`);
        logger(`  Quality Param: "${quality}"`);
        logger(`  System Param: "${systemPrompt}"`);
        logger(`  [FINAL PROMPT]: "${fullPrompt}"`); // Explicitly log the final prompt
        
        if (model === 'gemini-3-pro-image-preview') {
            logger(`  Grounding: Search Enabled`);
        }
    }

    const startTime = Date.now();

    const request = ai.models.generateContent({
      model: model,
      contents: {
        parts: [
            { text: fullPrompt }
        ]
      },
      config: config,
    });

    if (logger) logger(`[STATUS] Waiting for server response...`);

    const response = await withAbort(request, signal) as GenerateContentResponse;
    
    const latency = Date.now() - startTime;
    if (logger) {
        logger(`[RESPONSE] Received in ${latency}ms`);
        logger(`  Candidate Count: ${response.candidates?.length || 0}`);
    }

    let textResponse = '';
    let finishReason = '';

    // Parse response for image part
    for (const candidate of response.candidates || []) {
        if (candidate.finishReason && candidate.finishReason !== 'STOP') {
            finishReason = candidate.finishReason;
            if (logger) logger(`[WARNING] Finish Reason: ${finishReason}`);
        }

        const groundingMetadata = candidate.groundingMetadata;
        if (groundingMetadata && logger) {
            logger(`[INFO] Grounding Metadata received`);
        }

        for (const part of candidate.content?.parts || []) {
            if (part.inlineData && part.inlineData.data) {
                const sizeBytes = part.inlineData.data.length * 0.75; // Approx decoded size
                const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
                
                if (logger) {
                    logger(`[SUCCESS] Image Data Extracted`);
                    logger(`  Payload Size: ${sizeMB} MB`);
                    logger(`  MimeType: ${part.inlineData.mimeType}`);
                }
                
                return {
                    imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                    groundingMetadata
                };
            }
            if (part.text) {
                textResponse += part.text + ' ';
            }
        }
    }
    
    if (textResponse.trim()) {
        if (logger) logger(`[ERROR] Model returned text: "${textResponse.trim().substring(0, 100)}..."`);
        throw new Error(`Model returned text instead of image: "${textResponse.trim().substring(0, 200)}..."`);
    }

    if (finishReason) {
         throw new Error(`Model finished with reason: ${finishReason} (Likely Safety or Filter Block)`);
    }

    throw new Error("No image data received from model");
  } catch (error) {
    // Re-throw if it's an abort error so the UI handles it as a cancellation
    if (error instanceof DOMException && error.name === 'AbortError') {
        if (logger) logger(`[ABORT] Request cancelled by user.`);
        throw error;
    }
    console.error("Image generation failed:", error);
    if (logger) logger(`[ERROR] ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    throw error;
  }
};

/**
 * Edits the existing image based on a prompt using Gemini models.
 * Maintains resolution and aspect ratio where possible.
 */
export const editImage = async (
    imageBase64: string, 
    prompt: string, 
    aspectRatio: AspectRatio, 
    orientation: Orientation, 
    apiKey?: string,
    model: GenModel = 'gemini-3-pro-image-preview',
    resolution: ImageResolution = '1K',
    quality: string = '',
    systemPrompt: string = '',
    signal?: AbortSignal,
    logger?: (msg: string) => void
): Promise<GeneratedImageResult> => {
  try {
    const ai = getClient(apiKey);
    const targetRatio = getApiAspectRatio(aspectRatio, orientation);
    
    // Extract pure base64 and mime type from Data URL
    const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error("Invalid image format");
    }
    const mimeType = matches[1];
    const data = matches[2];

    const inputSizeMB = (data.length * 0.75) / 1024 / 1024;

    // Config depends on the model
    const config: any = {
        imageConfig: {
            aspectRatio: targetRatio,
        }
    };

    // Only Gemini 3 Pro Image Preview supports 'imageSize' and 'googleSearch'
    if (model === 'gemini-3-pro-image-preview') {
        config.imageConfig.imageSize = resolution;
        config.tools = [{ googleSearch: {} }];
    }

    // Cleanly construct prompt
    const promptParts = [prompt, quality, systemPrompt].filter(p => p && p.trim().length > 0);
    const fullPrompt = promptParts.join('. ');

    if (logger) {
        logger(`[REQUEST] Initiating Edit...`);
        logger(`  Model: ${model}`);
        logger(`  Input Image: ${inputSizeMB.toFixed(2)} MB (${mimeType})`);
        logger(`  Target Resolution: ${resolution}`);
        logger(`  Aspect Ratio: ${targetRatio}`);
        logger(`  -- Parameters --`);
        logger(`  Base Prompt: "${prompt}"`);
        logger(`  Quality Param: "${quality}"`);
        logger(`  System Param: "${systemPrompt}"`);
        logger(`  [FINAL PROMPT]: "${fullPrompt}"`); // Explicitly log
        
        if (model === 'gemini-3-pro-image-preview') {
            logger(`  Grounding: Search Enabled`);
        }
    }

    const startTime = Date.now();

    // Use selected model for editing/inpainting capabilities
    const request = ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              data: data,
              mimeType: mimeType,
            },
          },
          {
            text: fullPrompt,
          },
        ],
      },
      config: config,
    });

    if (logger) logger(`[STATUS] Sending payload to server...`);

    const response = await withAbort(request, signal) as GenerateContentResponse;

    const latency = Date.now() - startTime;
    if (logger) {
        logger(`[RESPONSE] Received in ${latency}ms`);
    }

    let textResponse = '';
    let finishReason = '';

    // Parse response for image part (standard generateContent response structure)
    for (const candidate of response.candidates || []) {
        if (candidate.finishReason && candidate.finishReason !== 'STOP') {
             finishReason = candidate.finishReason;
             if (logger) logger(`[WARNING] Finish Reason: ${finishReason}`);
        }

        const groundingMetadata = candidate.groundingMetadata;

        for (const part of candidate.content?.parts || []) {
            if (part.inlineData && part.inlineData.data) {
                const outputSizeBytes = part.inlineData.data.length * 0.75;
                const sizeMB = (outputSizeBytes / 1024 / 1024).toFixed(2);
                
                if (logger) {
                    logger(`[SUCCESS] Image Data Extracted`);
                    logger(`  Payload Size: ${sizeMB} MB`);
                    logger(`  MimeType: ${part.inlineData.mimeType}`);
                }
                return {
                    imageData: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                    groundingMetadata
                };
            }
            if (part.text) {
                textResponse += part.text + ' ';
            }
        }
    }
    
    if (textResponse.trim()) {
        if (logger) logger(`[ERROR] Model returned text: "${textResponse.trim().substring(0, 100)}..."`);
        throw new Error(`Model returned text instead of image: "${textResponse.trim().substring(0, 200)}..."`);
    }

    if (finishReason) {
         throw new Error(`Model finished with reason: ${finishReason} (Likely Safety or Filter Block)`);
    }
    
    throw new Error("No image generated from edit request");

  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
        if (logger) logger(`[ABORT] Request cancelled by user.`);
        throw error;
    }
    console.error("Image editing failed:", error);
    if (logger) logger(`[ERROR] ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    throw error;
  }
};