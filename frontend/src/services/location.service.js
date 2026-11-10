
import api from "./api.js";

const locationService = {
  // Start a new location-sharing session
  startShare: async (recipientIds, expiresInMinutes = 60) => {
    const response = await api.post("/location/share", {
      recipientIds,
      expiresInMinutes
    });

    return response.data;
  },

stopShare: async (shareId) => {
  const response = await api.patch(
    `/location/${shareId}/stop`
  );

  return response.data;
},

  // Get all active location shares visible to current user
  getActiveShares: async () => {
    const response = await api.get("/location/active");

    return response.data;
  }
  
};

export default locationService;
