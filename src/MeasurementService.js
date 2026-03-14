/**
 * MeasurementService.js
 * Logic for converting AI pixel coordinates to real-world centimeters.
 */

import { Image } from 'react-native';

const CARD_WIDTH_CM = 8.56; // Standard ID/Credit Card width

export const MeasurementService = {
  
  /**
   * 1. Calculate the Pixel-to-CM Ratio
   * @param {number} cardPixelWidth - The width of the card in the photo (in pixels)
   */
  getCalibrationRatio: (cardPixelWidth) => {
    if (cardPixelWidth === 0) return 0;
    return CARD_WIDTH_CM / cardPixelWidth; // cm per pixel
  },

  /**
   * 2. Calculate Real Distance between two AI Keypoints
   * @param {object} p1 - {x, y} coordinates of first point (e.g., Left Shoulder)
   * @param {object} p2 - {x, y} coordinates of second point (e.g., Right Shoulder)
   * @param {number} ratio - The result from getCalibrationRatio
   */
  calculateRealDistance: (p1, p2, ratio) => {
    // Euclidean Distance formula
    const pixelDist = Math.sqrt(
      Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
    );
    
    const realDistanceCm = pixelDist * ratio;
    return realDistanceCm.toFixed(2); // Return rounded to 2 decimal places
  },

  /**
   * 3. Estimate shoulder distance from an image URI (placeholder implementation)
   * @param {string} imageUri
   */
  estimateShoulderFromImage: async (imageUri) => {
    if (!imageUri) {
      throw new Error('No image URI provided to measurement estimator');
    }

    // Use the image pixel width to build a rough card calibration ratio.
    // This is still an approximation because real keypoint extraction requires ML.
    const imageSize = await new Promise((resolve, reject) => {
      Image.getSize(
        imageUri,
        (width, height) => resolve({ width, height }),
        (error) => reject(error)
      );
    });

    const cardPixelWidth = Math.max(64, Math.round(imageSize.width * 0.4));
    const ratio = MeasurementService.getCalibrationRatio(cardPixelWidth);

    // Simulated shoulder points based on wide image assumption
    const leftShoulder = { x: imageSize.width * 0.2, y: imageSize.height * 0.4 };
    const rightShoulder = { x: imageSize.width * 0.8, y: imageSize.height * 0.42 };

    return MeasurementService.calculateRealDistance(leftShoulder, rightShoulder, ratio);
  },
};