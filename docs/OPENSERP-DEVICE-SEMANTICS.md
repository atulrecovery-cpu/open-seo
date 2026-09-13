# OpenSERP device semantics decision

## Evidence examined

OpenSERP's public `Query` contract and Google search endpoint accept text, language, region, pagination and feature parameters; they do not accept a device selector. The response does not echo an effective device, profile, viewport, or user-agent.

The browser implementation contains generic profile application and passes a profile's `Mobile` flag into Chrome user-agent and device-metrics emulation. This is internal plumbing, not a request contract. More importantly, the embedded `core/browser/profiles.json` at validated commit `29c7b0fbe09640160efcfc1f1e04e60e0fbe60e9` marks every shipped profile `"mobile": false`.

## Decision

**V3 — no confirmed mobile profile capability in the validated default runtime.** Desktop/mobile cannot be represented as a canonical per-request OpenSEO request. The adapter continues to advertise both capabilities as `UNSUPPORTED`, rejects `device: "desktop"` and `device: "mobile"`, and emits `deviceKnown: false` for device-unspecified observations. No device label is inferred from browser internals.
