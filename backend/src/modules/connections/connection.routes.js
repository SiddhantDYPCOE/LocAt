
import { Router } from "express";

import {
  sendRequest,
  acceptRequest,
  rejectRequest,
  deleteConnection,
  getIncoming,
  getOutgoing,
  getConnections,
  searchUsersController
} from "./connection.controller.js";

import {
  sendRequestSchema,
  connectionActionSchema
} from "./connection.validation.js";

import validate from "../../middlewares/validate.middleware.js";
import protect from "../../middlewares/auth.middleware.js";

const router = Router();

// All connection routes require authentication
router.use(protect);


// Search LocAt users
router.get("/search", searchUsersController);

// Send a connection request
router.post(
  "/request",
  validate(sendRequestSchema),
  sendRequest
);

// Accept a connection request
router.patch(
    "/:connectionId/accept",
    validate(connectionActionSchema.pick({ connectionId: true }), "params"),
    acceptRequest
);

router.patch(
    "/:connectionId/reject",
    validate(connectionActionSchema.pick({ connectionId: true }), "params"),
    rejectRequest
);

// Remove an accepted connection
router.delete(
  "/:connectionId",
  validate(connectionActionSchema.pick({ connectionId: true }),"params"),
  deleteConnection
);

// Get accepted connections
router.get("/", getConnections);

// Get incoming requests
router.get("/incoming", getIncoming);

// Get outgoing requests
router.get("/outgoing", getOutgoing);

export default router;
