# Basemap failure fixture

`osm-blocked.png` is the actual HTTP-200 access-blocked response observed from
OpenStreetMap during local `file://` verification on 2026-10-15. It is an error
message, not a map tile. The regression verifies that this known placeholder
does not count as a successfully loaded basemap.

The production loader also rejects non-success HTTP responses, non-image
responses and image decode failures. The hash check identifies this particular
observed placeholder; it is not general OCR for every possible provider error.
