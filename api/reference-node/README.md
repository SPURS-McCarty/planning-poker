Planning Poker Reference API (Node + Express)

Purpose
- Reference implementation of the Deere API contract for planning poker.
- Uses in-memory storage for fast prototyping and integration testing.

Endpoints
- POST /v1/planning-poker/rooms
- GET /v1/planning-poker/rooms/:roomId
- PATCH /v1/planning-poker/rooms/:roomId
- POST /v1/planning-poker/rooms/:roomId/participants
- POST /v1/planning-poker/rooms/:roomId/votes
- POST /v1/planning-poker/rooms/:roomId/reveal
- POST /v1/planning-poker/rooms/:roomId/reset
- GET /v1/planning-poker/rooms/:roomId/events?sinceVersion=1

Run locally
1. From this folder, run npm install
2. Run npm start
3. API starts on http://localhost:8080 by default

Environment variables
- PORT: optional, defaults to 8080

Security note
- This reference only validates the presence of Authorization: Bearer ...
- Replace with Deere SSO token validation middleware in production.
