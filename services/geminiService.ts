

import { GoogleGenAI, Modality } from "@google/genai";
import { AspectRatio, Orientation, GenModel } from "../types";

// Initialize default client
const defaultAi = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to get client (either default or custom)
const getClient = (apiKey?: string) => {
    if (apiKey && apiKey.trim().length > 0) {
        return new GoogleGenAI({ apiKey });
    }
    return defaultAi;
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

/**
 * Generates the visual background using Gemini models.
 * Supports switching between Nano Banana Pro (Gemini 3 Pro) and Nano Banana (Gemini 2.5 Flash).
 */
export const generateBackgroundImage = async (
    prompt: string, 
    aspectRatio: AspectRatio, 
    orientation: 'landscape' | 'portrait' = 'landscape',
    apiKey?: string,
    model: GenModel = 'gemini-3-pro-image-preview'
): Promise<string> => {
  try {
    const ai = getClient(apiKey);
    const targetRatio = getApiAspectRatio(aspectRatio, orientation);

    // Config depends on the model
    const config: any = {
        imageConfig: {
            aspectRatio: targetRatio,
        }
    };

    // Only Gemini 3 Pro Image Preview supports 'imageSize'
    if (model === 'gemini-3-pro-image-preview') {
        config.imageConfig.imageSize = '4K';
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
            { text: `${prompt}. High quality, cinematic lighting, negative space for text overlay, polished design aesthetic.` }
        ]
      },
      config: config,
    });

    // Parse response for image part
    for (const candidate of response.candidates || []) {
        for (const part of candidate.content?.parts || []) {
            if (part.inlineData && part.inlineData.data) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    
    throw new Error("No image data received from model");
  } catch (error) {
    console.error("Image generation failed:", error);
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
    model: GenModel = 'gemini-3-pro-image-preview'
): Promise<string> => {
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

    // Config depends on the model
    const config: any = {
        imageConfig: {
            aspectRatio: targetRatio,
        }
    };

    // Only Gemini 3 Pro Image Preview supports 'imageSize'
    if (model === 'gemini-3-pro-image-preview') {
        config.imageConfig.imageSize = '4K';
    }

    // Use selected model for editing/inpainting capabilities
    const response = await ai.models.generateContent({
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
            text: `${prompt}. Maintain high quality and photorealism. Output in high resolution 4K.`,
          },
        ],
      },
      config: config,
    });

    // Parse response for image part (standard generateContent response structure)
    for (const candidate of response.candidates || []) {
        for (const part of candidate.content?.parts || []) {
            if (part.inlineData && part.inlineData.data) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    }
    
    throw new Error("No image generated from edit request");

  } catch (error) {
    console.error("Image editing failed:", error);
    throw error;
  }
};