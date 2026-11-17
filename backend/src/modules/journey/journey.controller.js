
import {
  createJourney,
  getMyJourneys,
  getJourneyDetails,
  respondToJourneyInvitation,
  updateJourneyOrigin,
  startJourney,
  updateJourneyMemberLocation,
  markJourneyMemberArrived,
  leaveJourney,
  completeJourney,
  cancelJourney
} from "./journey.service.js";

// ========================================
// CREATE JOURNEY
// ========================================

export const create = async (req, res) => {
  try {
    const journey = await createJourney(
      req.user.userId,
      req.validated.body
    );

    return res.status(201).json({
      success: true,
      message: "Journey created successfully",
      data: journey
    });
  } catch (error) {
    console.error("Create journey error:", error);

    const statusCode =
      error.message.includes("accepted connections") ||
      error.message.includes("yourself")
        ? 403
        : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Unable to create journey"
    });
  }
};

// ========================================
// GET MY JOURNEYS
// ========================================

export const getMy = async (req, res) => {
  try {
    const journeys = await getMyJourneys(req.user.userId);

    return res.status(200).json({
      success: true,
      data: journeys
    });
  } catch (error) {
    console.error("Get my journeys error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch journeys"
    });
  }
};

// ========================================
// GET JOURNEY DETAILS
// ========================================

export const getDetails = async (req, res) => {
  try {
    const { journeyId } = req.validated.params;

    const journey = await getJourneyDetails(
      req.user.userId,
      journeyId
    );

    return res.status(200).json({
      success: true,
      data: journey
    });
  } catch (error) {
    console.error("Get journey details error:", error);

    const statusCode = error.message.includes("not found") ? 404 : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Unable to fetch journey"
    });
  }
};

// ========================================
// RESPOND TO INVITATION
// ========================================

export const respondToInvitation = async (req, res) => {
  try {
    const { journeyId } = req.validated.params;
    const { status } = req.validated.body;

    const journey = await respondToJourneyInvitation(
      req.user.userId,
      journeyId,
      status
    );

    return res.status(200).json({
      success: true,
      message: `Journey invitation ${status.toLowerCase()} successfully`,
      data: journey
    });
  } catch (error) {
    console.error("Respond to journey invitation error:", error);

    const statusCode =
      error.message.includes("not found") ? 404 :
      error.message.includes("invitation") ||
      error.message.includes("no longer") ? 400 : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Unable to respond to invitation"
    });
  }
};

// ========================================
// UPDATE STARTING LOCATION
// ========================================

export const updateOrigin = async (req, res) => {
  try {
    const { journeyId } = req.validated.params;

    const journey = await updateJourneyOrigin(
      req.user.userId,
      journeyId,
      req.validated.body
    );

    return res.status(200).json({
      success: true,
      message: "Starting location updated successfully",
      data: journey
    });
  } catch (error) {
    console.error("Update journey origin error:", error);

    const statusCode =
      error.message.includes("not found") ? 404 :
      error.message.includes("must accept") ||
      error.message.includes("only be changed") ? 400 : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Unable to update starting location"
    });
  }
};

// ========================================
// START JOURNEY
// ========================================

export const start = async (req, res) => {
  try {
    const { journeyId } = req.validated.params;

    const journey = await startJourney(
      req.user.userId,
      journeyId
    );

    return res.status(200).json({
      success: true,
      message: "Journey started successfully",
      data: journey
    });
  } catch (error) {
    console.error("Start journey error:", error);

    const statusCode =
      error.message.includes("not found") ? 404 :
      error.message.includes("Only the journey creator") ? 403 : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Unable to start journey"
    });
  }
};

// ========================================
// UPDATE MEMBER LIVE LOCATION
// ========================================

export const updateMemberLocation = async (req, res) => {
  try {
    const { journeyId } = req.validated.params;

    const updatedMember = await updateJourneyMemberLocation(
      req.user.userId,
      journeyId,
      req.validated.body
    );

    return res.status(200).json({
      success: true,
      message: "Journey location updated successfully",
      data: updatedMember
    });
  } catch (error) {
    console.error("Update journey location error:", error);

    const statusCode =
      error.message.includes("not found") ? 404 :
      error.message.includes("not an active member") ? 403 : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Unable to update journey location"
    });
  }
};

// ========================================
// MARK MEMBER AS ARRIVED
// ========================================

export const markArrived = async (req, res) => {
  try {
    const { journeyId } = req.validated.params;

    const journey = await markJourneyMemberArrived(
      req.user.userId,
      journeyId
    );

    return res.status(200).json({
      success: true,
      message: "You have arrived successfully",
      data: journey
    });
  } catch (error) {
    console.error("Mark journey arrival error:", error);

    const statusCode =
      error.message.includes("not found") ? 404 :
      error.message.includes("not an active member") ? 403 : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Unable to mark arrival"
    });
  }
};

// ========================================
// LEAVE JOURNEY
// ========================================

export const leave = async (req, res) => {
  try {
    const { journeyId } = req.validated.params;

    const journey = await leaveJourney(
      req.user.userId,
      journeyId
    );

    return res.status(200).json({
      success: true,
      message: "You left the journey successfully",
      data: journey
    });
  } catch (error) {
    console.error("Leave journey error:", error);

    const statusCode =
      error.message.includes("not found") ? 404 :
      error.message.includes("not an active member") ? 403 : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Unable to leave journey"
    });
  }
};

// ========================================
// COMPLETE JOURNEY
// ========================================

export const complete = async (req, res) => {
  try {
    const { journeyId } = req.validated.params;

    const journey = await completeJourney(
      req.user.userId,
      journeyId
    );

    return res.status(200).json({
      success: true,
      message: "Journey completed successfully",
      data: journey
    });
  } catch (error) {
    console.error("Complete journey error:", error);

    const statusCode =
      error.message.includes("not found") ? 404 :
      error.message.includes("Only the journey creator") ? 403 : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Unable to complete journey"
    });
  }
};

// ========================================
// CANCEL JOURNEY
// ========================================

export const cancel = async (req, res) => {
  try {
    const { journeyId } = req.validated.params;

    const journey = await cancelJourney(
      req.user.userId,
      journeyId
    );

    return res.status(200).json({
      success: true,
      message: "Journey cancelled successfully",
      data: journey
    });
  } catch (error) {
    console.error("Cancel journey error:", error);

    const statusCode =
      error.message.includes("not found") ? 404 :
      error.message.includes("Only the journey creator") ? 403 : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Unable to cancel journey"
    });
  }
};
