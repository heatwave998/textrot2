/**
 * Parses an error object and returns a user-friendly title and message.
 */
export const getFriendlyError = (error: any): { title: string; message: string } => {
    let title = 'An Unexpected Error Occurred';
    let message = 'Something went wrong. Please try again later.';
    const errorMsg = error?.message || JSON.stringify(error) || '';

    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        title = 'Quota Limit Reached';
        message = 'You have exceeded the request limit for the API. Please wait a moment before trying again, or add your own API Key in Settings for higher limits.';
    } else if (errorMsg.includes('API_KEY') || errorMsg.includes('403') || errorMsg.includes('PERMISSION_DENIED')) {
        title = 'Authorization Error';
        message = 'The API Key provided is invalid or missing permissions. Please check your API Key in Settings.';
    } else if (errorMsg.includes('503') || errorMsg.includes('Overloaded')) {
        title = 'Service Overloaded';
        message = 'The AI models are currently experiencing high traffic. Please try again in a few seconds.';
    } else if (errorMsg.includes('500') || errorMsg.includes('Internal') || errorMsg.includes('Server Error')) {
        title = 'Server Error (500)';
        message = 'The Gemini service encountered an internal error. This is usually temporary. Please try again.';
    } else if (errorMsg.includes('IMAGE_RECITATION')) {
        title = 'Recitation Check Failed';
        message = 'The AI generated content that too closely resembles existing copyrighted works or the source image. Please try modifying your prompt or using a different input image.';
    } else if (errorMsg.includes('Safety') || errorMsg.includes('blocked') || errorMsg.includes('finish reason')) {
        title = 'Content Blocked';
        message = 'The request was blocked by safety filters. Please modify your prompt and try again. ' + (errorMsg ? `\nDetails: ${errorMsg}` : '');
    } else if (errorMsg.includes('Network') || errorMsg.includes('fetch')) {
        title = 'Network Error';
        message = 'Could not connect to the AI service. Please check your internet connection.';
    } else if (errorMsg.includes('Model returned text')) {
        title = 'Generation Failed';
        message = errorMsg;
    }

    return { title, message };
};
