package scraper

import (
	"database/sql"
	"fmt"

	"vintrack-worker/internal/model"
)

func monitorConfigFingerprint(mon model.Monitor) string {
	return fmt.Sprintf(
		"query=%s|priceMin=%s|priceMax=%s|size=%s|catalog=%s|brand=%s|color=%s|region=%s|allowed=%s|proxies=%s",
		mon.Query,
		nullableInt(mon.PriceMin),
		nullableInt(mon.PriceMax),
		nullableString(mon.SizeID),
		nullableString(mon.CatalogIDs),
		nullableString(mon.BrandIDs),
		nullableString(mon.ColorIDs),
		mon.Region,
		nullableString(mon.AllowedCountries),
		nullString(mon.Proxies),
	)
}

func nullableInt(v *int) string {
	if v == nil {
		return "<nil>"
	}
	return fmt.Sprintf("%d", *v)
}

func nullableString(v *string) string {
	if v == nil {
		return "<nil>"
	}
	return *v
}

func nullString(v sql.NullString) string {
	if !v.Valid {
		return "<null>"
	}
	return v.String
}
