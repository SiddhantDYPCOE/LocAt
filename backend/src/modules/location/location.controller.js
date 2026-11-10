
import {
  startLocationShare,
  getActiveLocationShares,
  updateLocationShare,
  stopLocationShare
} from "./location.service.js";

import {
  startLocationShareSchema,
  locationUpdateSchema,
  locationShareIdSchema
} from "./location.validation.js";

// Start location sharing
export const startShare = async (req, res) => {
  try {
    const validatedData = req.validated.body;

    const share = await startLocationShare(
      req.user.userId,
      validatedData.recipientIds,
      validatedData.expiresInMinutes ?? null
    );

    return res.status(201).json({
      success: true,
      message: "Location sharing started successfully",
      data: share
    });
  } catch (error) {
    console.error("Start location share error:", error);

    return res.status(
      error.name === "ZodError" ? 400 :
      error.message.includes("accepted connections") ||
      error.message.includes("yourself") ? 403 : 500
    ).json({
      success: false,
      message: error.message || "Unable to start location sharing"
    });
  }
};

// Get active location shares visible to current user
export const getActiveShares = async (req, res) => {
  try {
    const shares = await getActiveLocationShares(req.user.userId);

    return res.status(200).json({
      success: true,
      data: shares
    });
  } catch (error) {
    console.error("Get active location shares error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch active location shares"
    });
  }
};

// Update current GPS location
export const updateShareLocation = async (req, res) => {
  try {
    const { shareId } = req.validated.params;
const locationData = req.validated.body;

    const updatedShare = await updateLocationShare(
      req.user.userId,
      shareId,
      locationData
    );

    return res.status(200).json({
      success: true,
      message: "Location updated successfully",
      data: updatedShare
    });
  } catch (error) {
    console.error("Update location error:", error);

    const statusCode =
      error.name === "ZodError" ? 400 :
      error.message.includes("not found") ? 404 :
      error.message.includes("expired") ? 410 : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Unable to update location"
    });
  }
};

// Stop location sharing
export const stopShare = async (req, res) => {
  try {
    const { shareId } = req.validated.params;

    const stoppedShare = await stopLocationShare(
      req.user.userId,
      shareId
    );

    return res.status(200).json({
      success: true,
      message: "Location sharing stopped successfully",
      data: stoppedShare
    });
  } catch (error) {
    console.error("Stop location share error:", error);

    const statusCode = error.message.includes("not found") ? 404 : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Unable to stop location sharing"
    });
  }
};
