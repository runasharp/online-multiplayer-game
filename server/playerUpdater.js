// server/playerUpdater.js
function setupPlayerUpdates(UserModel, players, broadcast) {
  const changeStream = UserModel.watch();

  changeStream.on("change", (change) => {
    if (change.operationType !== "update") return;

    const updatedUserId = change.documentKey._id.toString();
    const updatedFields = change.updateDescription.updatedFields;

    if (!players[updatedUserId]) return; // player not connected, nothing to update

    // Update local player object
    for (const key in updatedFields) {
      players[updatedUserId][key] = updatedFields[key];
    }

    // Broadcast the changes to all clients
    const updateMsg = {
      type: "update",
      players: {
        [updatedUserId]: {
          x: players[updatedUserId]?.x || 0,
          y: players[updatedUserId]?.y || 0,
          username: players[updatedUserId]?.username || "Unknown",
          coins: players[updatedUserId]?.coins || 0,
          color: players[updatedUserId]?.color || "green",
          ...updatedFields, // include the updated fields explicitly
        },
      },
    };

    broadcast(JSON.stringify(updateMsg));
  });

  return changeStream;
}

module.exports = { setupPlayerUpdates };
