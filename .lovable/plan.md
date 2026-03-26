

## Plan: Fix API Documentation & Add Robustness

### Problem
The PHP and Python code examples in the public documentation have syntax issues that would cause failures when copied by an AI or non-developer. The API also lacks a graceful error for missing/invalid Content-Type.

### Changes

**1. Fix PHP example in `src/pages/DocumentacaoPublica.tsx`**

Replace the invalid PHP object syntax with a proper associative array:
```php
$data = [
    "customer" => ["name" => "João Silva", "email" => "joao@email.com", ...],
    "items" => [["name" => "Produto X", "quantity" => 2, "price" => 49.90]],
    "total" => 99.80
];
```

**2. Fix Python example in both `DocumentacaoPublica.tsx` and `ApiDocs.tsx`**

Use a proper Python dict variable instead of inlining raw JSON:
```python
import requests, json

payload = {
    "customer": {"name": "João Silva", "email": "joao@email.com"},
    ...
}

response = requests.post(url, json=payload)
```

**3. Add Content-Type validation in `supabase/functions/api-external/index.ts`**

Before `req.json()`, check Content-Type header. If missing or not JSON, return a clear 400 error:
```
{ "error": "Content-Type must be application/json" }
```

This prevents a cryptic 500 error when someone forgets the header.

**4. Fix PHP example in `ApiDocs.tsx` (internal docs)**

Apply the same PHP syntax fix to the internal documentation page.

### What stays unchanged
- API logic (validation, pedido/envio creation, tracking code generation)
- cURL and JavaScript examples (already correct)
- Sandbox testing feature
- All edge function config

