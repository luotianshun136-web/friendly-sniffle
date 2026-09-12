INSERT INTO campaigns (id, startsAt, endsAt)
VALUES ('welfare-day-v1', unixepoch('now') * 1000, (unixepoch('now') + 86400) * 1000)
ON CONFLICT(id) DO NOTHING;
