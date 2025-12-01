
import { GoogleGenAI, Modality } from "@google/genai";
import { AspectRatio } from "../types";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates the visual background using Gemini 3 Pro Image Preview.
 * Configured for 2K resolution (2048px).
 * Reverted to this model due to permission issues with Imagen 4.0.
 */
export const generateBackgroundImage = async (prompt: string, aspectRatio: AspectRatio, orientation: 'landscape' | 'portrait' = 'landscape'): Promise<string> => {
  try {
    // Determine the API-compatible aspect ratio string
    // API supports: "1:1", "3:4", "4:3", "9:16", "16:9"
    // We map our app's "Ratio + Orientation" state to these explicit API values.
    let targetRatio = '1:1';
    
    if (aspectRatio === '1:1') {
        targetRatio = '1:1';
    } else if (aspectRatio === '16:9') {
        // 16:9 Landscape or 9:16 Portrait
        targetRatio = orientation === 'portrait' ? '9:16' : '16:9';
    } else if (aspectRatio === '4:3') {
        // 4:3 Landscape or 3:4 Portrait
        targetRatio = orientation === 'portrait' ? '3:4' : '4:3';
    } else if (aspectRatio === '3:2') {
        // 3:2 is not natively supported by Gemini 3 Pro Image Preview. 
        // We map it to the closest available ratio (4:3 / 3:4).
        targetRatio = orientation === 'portrait' ? '3:4' : '4:3';
    } else {
        // Default fallback
        targetRatio = orientation === 'portrait' ? '3:4' : '4:3'; 
    }

    // Using gemini-3-pro-image-preview allows for '2K' resolution request via imageConfig
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
            { text: `${prompt}. High quality, cinematic lighting, negative space for text overlay, polished design aesthetic.` }
        ]
      },
      config: {
        imageConfig: {
            aspectRatio: targetRatio,
            imageSize: '2K'
        }
      },
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
 * Edits the existing image based on a prompt using Gemini 2.5 Flash Image.
 */
export const editImage = async (imageBase64: string, prompt: string): Promise<string> => {
  try {
    // Extract pure base64 and mime type from Data URL
    const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error("Invalid image format");
    }
    const mimeType = matches[1];
    const data = matches[2];

    // Use Gemini 2.5 Flash Image for editing/inpainting capabilities
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: data,
              mimeType: mimeType,
            },
          },
          {
            text: `${prompt}. Maintain high quality and photorealism. Output in high resolution.`,
          },
        ],
      },
      config: {
          responseModalities: [Modality.IMAGE],
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData?.data) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
    
    throw new Error("No image generated from edit request");

  } catch (error) {
    console.error("Image editing failed:", error);
    throw error;
  }
};
