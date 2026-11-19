package omnichannel

import (
	"testing"
)

func TestMaskPhone(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"91981234567", "+55 (91) 9****-4567"},
		{"5591981234567", "+55 (91) 9****-4567"},
		{"9132456789", "+55 (91) ****-6789"},
	}

	for _, c := range cases {
		got := MaskPhone(c.input)
		if got != c.expected {
			t.Errorf("MaskPhone(%q) = %q, esperado %q", c.input, got, c.expected)
		}
	}
}

func TestMaskName(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"VALDENEZ RIBEIRO ROCHA", "VALDENEZ R. ROCHA"},
		{"ANTONIA CLARICE FERREIRA DE AMORIM", "ANTONIA C. F. de AMORIM"},
		{"RAQUEL SILVA SANTOS", "RAQUEL S. SANTOS"},
		{"TALLES", "TALLES"},
		{"CARLOS SILVA JUNIOR", "CARLOS SILVA JUNIOR"},
		{"CARLOS EDUARDO SILVA JUNIOR", "CARLOS E. SILVA JUNIOR"},
	}

	for _, c := range cases {
		got := MaskName(c.input)
		if got != c.expected {
			t.Errorf("MaskName(%q) = %q, esperado %q", c.input, got, c.expected)
		}
	}
}

func TestNormalizePhoneAndName(t *testing.T) {
	phone, cand9 := NormalizePhone("+55 (91) 98123-4567")
	if phone != "91981234567" {
		t.Errorf("NormalizePhone incorreto: %s", phone)
	}
	if cand9 != "9181234567" {
		t.Errorf("Candidato 9º dígito incorreto: %s", cand9)
	}

	name := NormalizeName("João da Conceição & Filhos")
	if name != "JOAO DA CONCEICAO FILHOS" {
		t.Errorf("NormalizeName incorreto: %s", name)
	}

	hmac1 := GeneratePhoneHmac(phone, "secret1")
	hmac2 := GeneratePhoneHmac(phone, "secret1")
	if hmac1 == "" || hmac1 != hmac2 {
		t.Errorf("HMAC inconsistente")
	}
}
