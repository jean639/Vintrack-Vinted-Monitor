package scraper

import (
	"strconv"
	"testing"
)

func TestShouldReplaceClientForStatus(t *testing.T) {
	tests := []struct {
		status int
		want   bool
	}{
		{status: 200, want: false},
		{status: 401, want: true},
		{status: 403, want: true},
		{status: 407, want: true},
		{status: 429, want: true},
		{status: 500, want: false},
	}

	for _, tt := range tests {
		t.Run(strconv.Itoa(tt.status), func(t *testing.T) {
			if got := shouldReplaceClientForStatus(tt.status); got != tt.want {
				t.Fatalf("shouldReplaceClientForStatus(%d) = %v, want %v", tt.status, got, tt.want)
			}
		})
	}
}
