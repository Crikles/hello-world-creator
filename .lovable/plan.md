
# Navbar - Layout com Logo, Links Centrais e Tag Lateral

## O que sera feito

Reorganizar a navbar da pagina de rastreio em 3 secoes:

- **Esquerda**: Logo (um pouco maior, ~180px)
- **Centro**: Links de navegacao "Inicio", "Rastrear", "Contato"
- **Direita**: Tag "Transportes & Logistica"

Para mobile, os links centrais serao ocultados ou reorganizados com um menu hamburger simplificado.

---

## Detalhes Tecnicos

### Arquivo: `src/pages/Rastreio.tsx`

**JSX (linhas 139-146)** - Reestruturar a nav em 3 blocos:

```tsx
<nav className="main-nav">
  <div className="nav-inner">
    <div className="nav-brand">
      <img src={logoUrl} alt={empresaNome} className="nav-logo" />
    </div>
    <div className="nav-links">
      <a href="#" className="nav-link">Início</a>
      <a href="#rastrear" className="nav-link">Rastrear</a>
      <a href="#contato" className="nav-link">Contato</a>
    </div>
    <div className="nav-tag-wrapper">
      <span className="brand-tag">Transportes & Logística</span>
    </div>
  </div>
</nav>
```

**CSS** - Ajustar `.nav-inner` para `justify-content: space-between` e adicionar estilos dos links:

```css
.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* ... existente */
}
.nav-brand {
  display: flex;
  align-items: center;
}
.nav-logo {
  height: auto;
  width: 180px;
}
.nav-links {
  display: flex;
  gap: 32px;
  align-items: center;
}
.nav-link {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  text-decoration: none;
  letter-spacing: -0.3px;
  transition: color 0.2s;
}
.nav-link:hover {
  color: var(--primary);
}
.nav-tag-wrapper {
  display: flex;
  align-items: center;
}
```

**Mobile (media query 768px)** - Esconder links centrais e tag, manter so a logo:

```css
@media (max-width: 768px) {
  .nav-logo { width: 120px; }
  .nav-links { display: none; }
  .nav-tag-wrapper { display: none; }
}
```

---

## Resumo

| Arquivo | Mudanca |
|---|---|
| `src/pages/Rastreio.tsx` | JSX: reestruturar nav em 3 blocos (logo / links / tag) |
| `src/pages/Rastreio.tsx` | CSS: layout flexbox space-between, estilos dos links, logo maior (180px), mobile esconde links e tag |
