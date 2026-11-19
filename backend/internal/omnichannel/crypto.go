package omnichannel

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"strings"
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

var defaultSecret = "evad_omnichannel_secret_2026_salt"

// GeneratePhoneHmac gera hash HMAC-SHA256 irreversível para indexação sem salvar número puro
func GeneratePhoneHmac(normalizedPhone string, secret string) string {
	if normalizedPhone == "" {
		return ""
	}
	if secret == "" {
		secret = defaultSecret
	}
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(strings.TrimSpace(normalizedPhone)))
	return hex.EncodeToString(h.Sum(nil))
}

// GenerateNameHmac gera hash HMAC-SHA256 irreversível para nomes de clientes
func GenerateNameHmac(normalizedName string, secret string) string {
	if normalizedName == "" {
		return ""
	}
	if secret == "" {
		secret = defaultSecret
	}
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(strings.ToUpper(strings.TrimSpace(normalizedName))))
	return hex.EncodeToString(h.Sum(nil))
}

// MaskPhone mascara telefone para exibição segura: +55 (91) 9****-1081
func MaskPhone(phone string) string {
	if phone == "" {
		return "Telefone não informado"
	}
	reg := regexp.MustCompile(`\D`)
	clean := reg.ReplaceAllString(phone, "")

	if len(clean) >= 10 {
		ddi := ""
		withoutDdi := clean
		if strings.HasPrefix(clean, "55") && len(clean) >= 12 {
			ddi = "55"
			withoutDdi = clean[2:]
		}

		if len(withoutDdi) >= 10 {
			ddd := withoutDdi[:2]
			rest := withoutDdi[2:]
			firstDigit := ""
			if len(rest) == 9 {
				firstDigit = string(rest[0])
			}
			lastFour := rest
			if len(rest) >= 4 {
				lastFour = rest[len(rest)-4:]
			}
			starPart := "****"
			if firstDigit != "" {
				starPart = firstDigit + "****"
			}
			ddiStr := "+55"
			if ddi != "" {
				ddiStr = "+" + ddi
			}
			return ddiStr + " (" + ddd + ") " + starPart + "-" + lastFour
		}
	}

	if len(phone) >= 4 {
		return phone[:2] + "****" + phone[len(phone)-2:]
	}
	return "****"
}

// MaskName preserva o primeiro nome e o último sobrenome, abreviando os intermediários
func MaskName(name string) string {
	clean := strings.Join(strings.Fields(strings.TrimSpace(name)), " ")
	if clean == "" {
		return "Nome não informado"
	}
	parts := strings.Split(clean, " ")
	if len(parts) <= 2 {
		return clean
	}

	firstName := parts[0]
	lastPart := parts[len(parts)-1]
	suffixes := map[string]bool{
		"JUNIOR": true, "JR": true, "JR.": true, "FILHO": true, "NETO": true, "SOBRINHO": true,
	}

	lastName := lastPart
	middleEndIndex := len(parts) - 1
	if len(parts) > 2 && suffixes[strings.ToUpper(lastPart)] {
		lastName = parts[len(parts)-2] + " " + lastPart
		middleEndIndex = len(parts) - 2
	}

	middleParts := parts[1:middleEndIndex]
	if len(middleParts) == 0 {
		return firstName + " " + lastName
	}

	connectors := map[string]bool{"de": true, "da": true, "do": true, "das": true, "dos": true, "e": true}
	var middleMasked []string
	for _, p := range middleParts {
		lower := strings.ToLower(p)
		if connectors[lower] {
			middleMasked = append(middleMasked, lower)
		} else {
			runes := []rune(p)
			if len(runes) > 0 {
				middleMasked = append(middleMasked, strings.ToUpper(string(runes[0]))+".")
			}
		}
	}

	return firstName + " " + strings.Join(middleMasked, " ") + " " + lastName
}

// NormalizePhone normaliza telefone brasileiro para formato canônico de 11 ou 10 dígitos com DDD
func NormalizePhone(raw string) (normalized, candidate9th string) {
	reg := regexp.MustCompile(`\D`)
	digits := reg.ReplaceAllString(raw, "")

	if strings.HasPrefix(digits, "55") && len(digits) >= 12 {
		digits = digits[2:]
	}

	if len(digits) == 11 {
		normalized = digits
		// Candidato de 10 dígitos (sem o 9) se o 3º dígito for 9
		if digits[2] == '9' {
			candidate9th = digits[:2] + digits[3:]
		}
	} else if len(digits) == 10 {
		normalized = digits
		// Candidato celular de 11 dígitos adicionando 9
		candidate9th = digits[:2] + "9" + digits[2:]
	} else {
		normalized = digits
	}

	return
}

// NormalizeName remove acentos, símbolos e converte para maiúsculo
func NormalizeName(raw string) string {
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	result, _, _ := transform.String(t, raw)
	reg := regexp.MustCompile(`[^a-zA-Z0-9\s]`)
	clean := reg.ReplaceAllString(result, " ")
	return strings.ToUpper(strings.Join(strings.Fields(clean), " "))
}
