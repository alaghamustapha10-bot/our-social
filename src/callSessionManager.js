import { RoomEvent } from "livekit-client";

const initialState = {
  active: false,
  callId: null,
  callType: null,
  title: "مكالمة",
  status: "idle",
  participantCount: 0,
  microphoneEnabled: true,
  cameraEnabled: false,
  cameraAvailable: false,
  startedAt: null,
  backgroundEnabled: false,
};

class CallSessionManager {
  constructor() {
    this.room = null;
    this.listeners = new Set();
    this.roomEventHandlers = [];
    this.state = { ...initialState };
  }

  getSnapshot = () => {
    return this.state;
  };

  getRoom = () => {
    return this.room;
  };

  subscribe = (listener) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("Call session listener error:", error);
      }
    });
  }

  updateState(updates) {
    this.state = {
      ...this.state,
      ...updates,
    };

    this.notify();
  }

  isSameCall(callId) {
    return Boolean(
      this.room &&
      this.state.active &&
      this.state.callId === callId
    );
  }

  attachRoomEvents(room) {
    if (!room) return;

    const refresh = () => {
      this.refreshRoomState();
    };

    const disconnected = () => {
      if (this.room !== room) return;

      this.detachRoomEvents();
      this.room = null;

      this.state = {
        ...initialState,
        backgroundEnabled: this.state.backgroundEnabled,
      };

      this.notify();
    };

    const events = [
      RoomEvent.Connected,
      RoomEvent.Reconnecting,
      RoomEvent.Reconnected,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
    ];

    events.forEach((eventName) => {
      room.on(eventName, refresh);

      this.roomEventHandlers.push({
        room,
        eventName,
        handler: refresh,
      });
    });

    room.on(RoomEvent.Disconnected, disconnected);

    this.roomEventHandlers.push({
      room,
      eventName: RoomEvent.Disconnected,
      handler: disconnected,
    });
  }

  detachRoomEvents() {
    this.roomEventHandlers.forEach(
      ({ room, eventName, handler }) => {
        try {
          room.off(eventName, handler);
        } catch (error) {
          console.warn("Could not remove LiveKit listener:", error);
        }
      }
    );

    this.roomEventHandlers = [];
  }

  refreshRoomState() {
    if (!this.room) return;

    const room = this.room;
    const localParticipant = room.localParticipant;

    this.updateState({
      status: String(room.state || "connected").toLowerCase(),

      participantCount:
        (room.remoteParticipants?.size || 0) +
        (localParticipant ? 1 : 0),

      microphoneEnabled:
        localParticipant?.isMicrophoneEnabled ?? false,

      cameraEnabled:
        localParticipant?.isCameraEnabled ?? false,

      cameraAvailable: Boolean(localParticipant),
    });
  }

  adoptRoom(room, metadata = {}) {
    if (!room) {
      throw new Error("A LiveKit room is required.");
    }

    if (this.room && this.room !== room) {
      throw new Error(
        "Another call session is already active. End it before starting a new one."
      );
    }

    if (this.room === room) {
      this.updateState({
        ...metadata,
        active: true,
      });

      this.refreshRoomState();
      return room;
    }

    this.room = room;

    this.updateState({
      ...initialState,
      ...metadata,
      active: true,
      status: String(room.state || "connecting").toLowerCase(),
      startedAt: metadata.startedAt || Date.now(),
    });

    this.attachRoomEvents(room);
    this.refreshRoomState();

    return room;
  }

  updateMetadata(metadata = {}) {
    this.updateState(metadata);
  }

  setBackgroundEnabled(enabled) {
    this.updateState({
      backgroundEnabled: Boolean(enabled),
    });
  }

  async toggleMicrophone() {
    if (!this.room) return;

    const participant = this.room.localParticipant;

    if (!participant) return;

    const nextValue = !participant.isMicrophoneEnabled;

    await participant.setMicrophoneEnabled(nextValue);

    this.refreshRoomState();
  }

  async toggleCamera() {
    if (!this.room) return;

    const participant = this.room.localParticipant;

    if (!participant) return;

    const nextValue = !participant.isCameraEnabled;

    await participant.setCameraEnabled(nextValue);

    this.refreshRoomState();
  }

  async leaveCall() {
    const room = this.room;

    this.detachRoomEvents();
    this.room = null;

    this.state = {
      ...initialState,
      backgroundEnabled: this.state.backgroundEnabled,
    };

    this.notify();

    if (room) {
      try {
        await room.disconnect();
      } catch (error) {
        console.error("Error disconnecting from LiveKit:", error);
      }
    }
  }

  async endSession() {
    await this.leaveCall();
  }
}

export const callSessionManager = new CallSessionManager();

export default callSessionManager;