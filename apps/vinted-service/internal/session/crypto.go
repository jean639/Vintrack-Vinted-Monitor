package session

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"strings"
)

type tokenCipher struct {
	aead cipher.AEAD
}

func newTokenCipher(rawKey string) (*tokenCipher, error) {
	key := strings.TrimSpace(rawKey)
	if key == "" {
		return nil, fmt.Errorf("VINTED_SESSION_ENCRYPTION_KEY is required when DATABASE_URL is set")
	}

	keyBytes := []byte(key)
	if decoded, err := base64.StdEncoding.DecodeString(key); err == nil && len(decoded) == 32 {
		keyBytes = decoded
	} else if decoded, err := base64.RawStdEncoding.DecodeString(key); err == nil && len(decoded) == 32 {
		keyBytes = decoded
	} else if decoded, err := hex.DecodeString(key); err == nil && len(decoded) == 32 {
		keyBytes = decoded
	} else if len(keyBytes) != 32 {
		sum := sha256.Sum256(keyBytes)
		keyBytes = sum[:]
	}

	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return nil, fmt.Errorf("create token cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create token aead: %w", err)
	}

	return &tokenCipher{aead: aead}, nil
}

func (c *tokenCipher) Encrypt(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", nil
	}

	nonce := make([]byte, c.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}

	sealed := c.aead.Seal(nonce, nonce, []byte(trimmed), nil)
	return base64.RawStdEncoding.EncodeToString(sealed), nil
}

func (c *tokenCipher) Decrypt(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", nil
	}

	raw, err := base64.RawStdEncoding.DecodeString(trimmed)
	if err != nil {
		return "", fmt.Errorf("decode encrypted value: %w", err)
	}
	nonceSize := c.aead.NonceSize()
	if len(raw) <= nonceSize {
		return "", fmt.Errorf("encrypted value too short")
	}

	plain, err := c.aead.Open(nil, raw[:nonceSize], raw[nonceSize:], nil)
	if err != nil {
		return "", fmt.Errorf("decrypt value: %w", err)
	}
	return string(plain), nil
}
