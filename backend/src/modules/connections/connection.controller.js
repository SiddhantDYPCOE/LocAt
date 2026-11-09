
import {
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  removeConnection,
  getOutgoingRequests,
  getIncomingRequests,
  getMyConnections,
  searchUsers
} from "./connection.service.js";

// Centralized error response
const handleConnectionError = (error, res, next) => {
  const notFoundErrors = [
    "User not found",
    "Connection request not found",
    "Connection not found"
  ];

  const forbiddenErrors = [
    "You cannot accept your own request",
    "You cannot reject your own request",
    "You are not authorized to accept this request",
    "You are not authorized to reject this request",
    "You are not authorized to remove this connection"
  ];

  const conflictErrors = [
    "You cannot send a request to yourself",
    "You are already connected",
    "Connection request already sent",
    "Connection request is not allowed",
    "This request is no longer pending",
    "Only accepted connections can be removed"
  ];

  if (notFoundErrors.includes(error.message)) {
    return res.status(404).json({
      success: false,
      message: error.message
    });
  }

  if (forbiddenErrors.includes(error.message)) {
    return res.status(403).json({
      success: false,
      message: error.message
    });
  }

  if (conflictErrors.includes(error.message)) {
    return res.status(409).json({
      success: false,
      message: error.message
    });
  }

  next(error);
};


// Send connection request
export const sendRequest = async (req, res, next) => {
  try {
    const connection = await sendConnectionRequest(
      req.user.userId,
      req.body.username
    );

    return res.status(201).json({
      success: true,
      message:
        connection.status === "ACCEPTED"
          ? "Connection accepted automatically"
          : "Connection request sent successfully",
      connection
    });
  } catch (error) {
    handleConnectionError(error, res, next);
  }
};


// Accept connection request
export const acceptRequest = async (req, res, next) => {
  try {
    const connection = await acceptConnectionRequest(
      req.user.userId,
      req.params.connectionId
    );

    return res.status(200).json({
      success: true,
      message: "Connection request accepted",
      connection
    });
  } catch (error) {
    handleConnectionError(error, res, next);
  }
};


// Reject connection request
export const rejectRequest = async (req, res, next) => {
  try {
    const connection = await rejectConnectionRequest(
      req.user.userId,
      req.params.connectionId
    );

    return res.status(200).json({
      success: true,
      message: "Connection request rejected",
      connection
    });
  } catch (error) {
    handleConnectionError(error, res, next);
  }
};


// Remove accepted connection
export const deleteConnection = async (req, res, next) => {
  try {
    await removeConnection(
      req.user.userId,
      req.params.connectionId
    );

    return res.status(200).json({
      success: true,
      message: "Connection removed successfully"
    });
  } catch (error) {
    handleConnectionError(error, res, next);
  }
};



// Get accepted connections
export const getConnections = async (req, res, next) => {
  try {
    const connections = await getMyConnections(req.user.userId);

    return res.status(200).json({
      success: true,
      count: connections.length,
      connections
    });
  } catch (error) {
    next(error);
  }
};


// Get incoming requests
export const getIncoming = async (req, res, next) => {
  try {
    const requests = await getIncomingRequests(req.user.userId);

    return res.status(200).json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (error) {
    next(error);
  }
};


// Get outgoing requests
export const getOutgoing = async (req, res, next) => {
  try {
    const requests = await getOutgoingRequests(req.user.userId);

    return res.status(200).json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (error) {
    next(error);
  }
};


export const searchUsersController = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== "string" || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must contain at least 2 characters"
      });
    }

    const users = await searchUsers(req.user.userId, q);

    return res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    next(error);
  }
};
