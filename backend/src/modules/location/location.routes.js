import { Router } from "express";

import protect from "../../middlewares/auth.middleware.js";
import validate from "../../middlewares/validate.middleware.js";

import {
  startLocationShareSchema,
  locationUpdateSchema,
  locationShareIdSchema
} from "./location.validation.js";

import {
  startShare,
  getActiveShares,
  updateShareLocation,
  stopShare
} from "./location.controller.js";

const router = Router();

router.use(protect);

router.post(
  "/share",
  validate(startLocationShareSchema),
  startShare
);

router.get("/active", getActiveShares);

router.patch(
  "/:shareId/stop",
  validate(locationShareIdSchema, "params"),
  stopShare
);

router.patch(
  "/:shareId",
  validate(locationShareIdSchema, "params"),
  validate(locationUpdateSchema),
  updateShareLocation
);

export default router;