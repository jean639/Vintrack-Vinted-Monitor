package scraper

import (
	"context"
	"net"
	"testing"
	"time"
)

func TestValidateFreeProxyHonorsContextDeadline(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()

	done := make(chan struct{})
	defer close(done)
	go func() {
		for {
			conn, acceptErr := listener.Accept()
			if acceptErr != nil {
				return
			}
			go func() {
				defer conn.Close()
				<-done
			}()
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	defer cancel()
	startedAt := time.Now()
	_, err = ValidateFreeProxy(ctx, "http://"+listener.Addr().String(), "de", 2500)
	elapsed := time.Since(startedAt)

	if err == nil {
		t.Fatal("expected validation to fail when the context deadline expires")
	}
	if elapsed > time.Second {
		t.Fatalf("validation returned after %s, expected context cancellation within 1s", elapsed)
	}
}
