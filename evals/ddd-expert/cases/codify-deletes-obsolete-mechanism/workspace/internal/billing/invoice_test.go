package billing

import (
	"go/ast"
	"go/parser"
	"go/token"
	"testing"
)

func TestInvoiceSettlementAndResponsibilitySurface(t *testing.T) {
	invoice := NewInvoice("invoice-1")
	if accepted := invoice.Settle(100); !accepted {
		t.Fatal("positive payment should settle an unsettled invoice")
	}
	if !invoice.Settled() {
		t.Fatal("accepted settlement should update the invoice")
	}
	if invoice.id != "invoice-1" {
		t.Fatalf("settlement changed invoice identity to %q", invoice.id)
	}
}

func TestInvoiceSourceContainsOnlyAcceptedBusinessSurface(t *testing.T) {
	file, err := parser.ParseFile(token.NewFileSet(), "invoice.go", nil, 0)
	if err != nil {
		t.Fatalf("parse invoice.go: %v", err)
	}

	wantedFunctions := map[string]bool{
		"NewInvoice": true,
		"Settle":     true,
		"Settled":    true,
	}
	foundInvoice := false
	for _, declaration := range file.Decls {
		switch declaration := declaration.(type) {
		case *ast.GenDecl:
			if declaration.Tok != token.TYPE || len(declaration.Specs) != 1 {
				t.Fatalf("unexpected package-level declaration in invoice.go: %s", declaration.Tok)
			}
			typeSpec, ok := declaration.Specs[0].(*ast.TypeSpec)
			if !ok || typeSpec.Name.Name != "Invoice" {
				t.Fatal("invoice.go may declare only the Invoice type")
			}
			invoiceStruct, ok := typeSpec.Type.(*ast.StructType)
			if !ok {
				t.Fatal("Invoice must remain a struct")
			}
			assertInvoiceFields(t, invoiceStruct)
			foundInvoice = true
		case *ast.FuncDecl:
			if !wantedFunctions[declaration.Name.Name] {
				t.Fatalf("unexpected function or method %s in invoice.go", declaration.Name.Name)
			}
			delete(wantedFunctions, declaration.Name.Name)
		default:
			t.Fatalf("unexpected declaration %T in invoice.go", declaration)
		}
	}
	if !foundInvoice {
		t.Fatal("invoice.go does not declare Invoice")
	}
	if len(wantedFunctions) != 0 {
		t.Fatalf("invoice.go is missing accepted functions or methods: %v", wantedFunctions)
	}
}

func assertInvoiceFields(t *testing.T, invoiceStruct *ast.StructType) {
	t.Helper()
	wanted := []struct {
		name     string
		typeName string
	}{
		{name: "id", typeName: "string"},
		{name: "settled", typeName: "bool"},
	}
	if len(invoiceStruct.Fields.List) != len(wanted) {
		t.Fatalf("Invoice fields = %d, want identity and settlement state only", len(invoiceStruct.Fields.List))
	}
	for index, field := range invoiceStruct.Fields.List {
		fieldType, typeOK := field.Type.(*ast.Ident)
		if len(field.Names) != 1 || !typeOK ||
			field.Names[0].Name != wanted[index].name || fieldType.Name != wanted[index].typeName {
			t.Fatalf("Invoice field %d must remain %s %s", index, wanted[index].name, wanted[index].typeName)
		}
	}
}
