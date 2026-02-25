
# Ajustes na Navbar e Responsividade da Pagina de Rastreio

## O que sera feito

### 1. Navbar - Logo substituindo o texto

Na navegacao superior (`.main-nav`), a logo atualmente aparece pequena ao lado do texto "Logistica JL Transportes". A mudanca sera:

- Remover o `brand-name` (texto "Logistica JL Transportes") do JSX
- Aumentar o tamanho da logo (de 64px para ~120px de largura)
- Manter apenas o subtitulo "Transportes & Logistica" abaixo da logo
- A logo passa a ser o elemento principal de identidade visual

### 2. Responsividade completa para mobile

Atualmente so existe um media query para 1024px (grid do layout de resultados). Serao adicionados estilos responsivos para:

**Navbar (mobile)**
- Logo menor (~80px)
- Padding lateral reduzido
- Altura da nav reduzida

**Hero Section (mobile)**
- Padding reduzido
- Titulo com fonte menor
- Input de busca em stack vertical (input em cima, botao embaixo ocupando largura total)
- Stats em coluna vertical ou grid 1x3 mais compacto

**Resultados (mobile)**
- Cards com padding reduzido
- Tracking number com fonte menor
- Timeline com padding reduzido

**Footer (mobile)**
- Layout em coluna (stack vertical)
- Links em coluna
- Bottom footer em coluna

---

## Detalhes Tecnicos

### Arquivo: `src/pages/Rastreio.tsx`

**JSX (linhas 139-149)** - Remover `brand-name`, manter so a logo e o subtitulo:

```tsx
<nav className="main-nav">
  <div className="nav-inner">
    <div className="nav-brand">
      <img src={logoUrl} alt={empresaNome} className="nav-logo" />
      <span className="brand-tag">Transportes & Logistica</span>
    </div>
  </div>
</nav>
```

**CSS** - Ajustar `.nav-logo` para tamanho maior e adicionar media queries:

```css
.nav-logo {
  height: auto;
  width: 140px;
}
.brand-tag {
  /* manter estilo atual */
}
```

**Media queries a adicionar** (no final do bloco `styles`):

```css
@media (max-width: 768px) {
  /* Nav */
  .main-nav { height: 70px; }
  .nav-inner { padding: 0 16px; }
  .nav-logo { width: 100px; }
  .brand-tag { font-size: 8px; }

  /* Hero */
  .hero-section { padding: 120px 16px 60px; }
  .main-title { font-size: 28px; }
  .hero-desc { font-size: 14px; }
  .search-input-wrapper { flex-direction: column; }
  .main-input { font-size: 13px; }
  .search-submit { width: 100%; justify-content: center; border-radius: 12px; }
  .quick-stats { flex-direction: column; gap: 16px; }

  /* Results */
  .results-section { padding: 24px 16px; }
  .package-label-card { padding: 20px; border-radius: 16px; }
  .tracking-number { font-size: 20px; }
  .data-main { padding: 20px; border-radius: 16px; }

  /* Footer */
  .site-footer { padding: 40px 16px 24px; }
  .footer-top { flex-direction: column; gap: 32px; }
  .f-links { flex-direction: column; gap: 24px; }
  .footer-bottom { flex-direction: column; gap: 12px; text-align: center; }
}
```

### Resumo

| Arquivo | Mudanca |
|---|---|
| `src/pages/Rastreio.tsx` | JSX: remover brand-name, manter logo + subtitulo |
| `src/pages/Rastreio.tsx` | CSS: aumentar logo, adicionar media queries mobile |
