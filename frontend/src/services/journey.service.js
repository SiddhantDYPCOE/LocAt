
import api from "./api.js";

const journeyService = {
  // Create a journey and invite accepted connections.
  createJourney: async (journeyData) => {
    const response = await api.post("/journeys", journeyData);
    return response.data;
  },

  // Fetch journeys belonging to the current user.
  getMyJourneys: async () => {
    const response = await api.get("/journeys");
    return response.data;
  },

  // Fetch complete journey details.
  getJourneyDetails: async (journeyId) => {
    const response = await api.get(`/journeys/${journeyId}`);
    return response.data;
  },

  // Accept or decline a journey invitation.
  respondToInvitation: async (journeyId, status) => {
    const response = await api.patch(
      `/journeys/${journeyId}/invitation`,
      { status }
    );

    return response.data;
  },

  // Update the member's starting location.
  updateOrigin: async (journeyId, originData) => {
    const response = await api.patch(
      `/journeys/${journeyId}/origin`,
      originData
    );

    return response.data;
  },

  // Start the journey (creator only).
  startJourney: async (journeyId) => {
    const response = await api.patch(
      `/journeys/${journeyId}/start`
    );

    return response.data;
  },

  // Mark the current member as arrived.
  markArrived: async (journeyId) => {
    const response = await api.patch(
      `/journeys/${journeyId}/arrived`
    );

    return response.data;
  },

  // Leave a journey.
  leaveJourney: async (journeyId) => {
    const response = await api.patch(
      `/journeys/${journeyId}/leave`
    );

    return response.data;
  },

  // Complete the journey (creator only).
  completeJourney: async (journeyId) => {
    const response = await api.patch(
      `/journeys/${journeyId}/complete`
    );

    return response.data;
  },

  // Cancel the journey (creator only).
  cancelJourney: async (journeyId) => {
    const response = await api.patch(
      `/journeys/${journeyId}/cancel`
    );

    return response.data;
  }
};

export default journeyService;
