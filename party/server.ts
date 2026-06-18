import type * as Party from "partykit/server";
import type { Room } from "../src/types";

export default class RoomServer implements Party.Server {
  room: Room | null = null;

  constructor(readonly party: Party.Room) {}

  async onConnect(conn: Party.Connection) {
    // Send current room state to the newly connected client
    if (this.room) {
      conn.send(JSON.stringify({ type: "room_state", room: this.room }));
    }
  }

  async onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message) as { type: string; room?: Room };

    if (msg.type === "update" && msg.room) {
      this.room = msg.room;
      // Broadcast updated state to all other connections
      this.party.broadcast(
        JSON.stringify({ type: "room_state", room: this.room }),
        [sender.id]
      );
    }
  }
}

RoomServer satisfies Party.Worker;
