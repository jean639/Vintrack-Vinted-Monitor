package scraper

func shouldReplaceClientForStatus(status int) bool {
	switch status {
	case 401, 403, 407, 429:
		return true
	default:
		return false
	}
}
