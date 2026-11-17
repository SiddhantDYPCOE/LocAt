
import { Router } from "express";

import protect from "../../middlewares/auth.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import {
  createJourneySchema,
  journeyIdSchema,
  respondJourneyInvitationSchema,
  journeyLocationUpdateSchema,
  journeyOriginSchema
} from "./journey.validation.js";

import {
  create,
  getMy,
  getDetails,
  respondToInvitation,
  updateOrigin,
  start,
  updateMemberLocation,
  markArrived,
  leave,
  complete,
  cancel
} from "./journey.controller.js";

const router = Router();

// All journey routes require authentication.
router.use(protect);

// ========================================
// CREATE JOURNEY
// ========================================

router.post(
  "/",
  validate(createJourneySchema),
  create
);

// ========================================
// GET MY JOURNEYS
// ========================================

router.get(
  "/",
  getMy
);

// ========================================
// GET JOURNEY DETAILS
// ========================================

router.get(
  "/:journeyId",
  validate(journeyIdSchema, "params"),
  getDetails
);

// ========================================
// RESPOND TO INVITATION
// ========================================

router.patch(
  "/:journeyId/invitation",
  validate(journeyIdSchema, "params"),
  validate(respondJourneyInvitationSchema),
  respondToInvitation
);

// ========================================
// UPDATE STARTING LOCATION
// ========================================

router.patch(
  "/:journeyId/origin",
  validate(journeyIdSchema, "params"),
  validate(journeyOriginSchema),
  updateOrigin
);

// ========================================
// START JOURNEY
// ========================================

router.patch(
  "/:journeyId/start",
  validate(journeyIdSchema, "params"),
  start
);

// ========================================
// UPDATE LIVE LOCATION
// ========================================

router.patch(
  "/:journeyId/location",
  validate(journeyIdSchema, "params"),
  validate(journeyLocationUpdateSchema),
  updateMemberLocation
);

// ========================================
// MARK ARRIVAL
// ========================================

router.patch(
  "/:journeyId/arrived",
  validate(journeyIdSchema, "params"),
  markArrived
);

// ========================================
// LEAVE JOURNEY
// ========================================

router.patch(
  "/:journeyId/leave",
  validate(journeyIdSchema, "params"),
  leave
);

// ========================================
// COMPLETE JOURNEY
// ========================================

router.patch(
  "/:journeyId/complete",
  validate(journeyIdSchema, "params"),
  complete
);

// ========================================
// CANCEL JOURNEY
// ========================================

router.patch(
  "/:journeyId/cancel",
  validate(journeyIdSchema, "params"),
  cancel
);

export default router;
