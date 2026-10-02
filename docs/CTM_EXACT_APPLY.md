# CTM exact FR24 apply

Endpoint: `POST /api/v2/audit-flight/apply?flight=CTM21&date=2026-10-01`

Rules:
- CTM only.
- Requires exact FR24 occurrence playback to be usable.
- Never maps TAKEOFF to ATD or LANDING to ATA.
- For CTM only, if no real/manual ATA exists and LANDING exists, derives ATA = LANDING + 10 minutes.
- STD/STA are filled only when missing.
- ETD/TAKEOFF/ETA/LANDING, gate/terminal, registration and actual aircraft may be refreshed from exact FR24 public occurrence data.
- Manual values are protected.
- Provider APIs remain disabled.
