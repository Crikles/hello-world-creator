

## Redesign da Pagina Empresa + Geracao de DANFE em PDF

### 1. Alteracoes no Banco de Dados

Adicionar colunas na tabela `empresas` para os campos que faltam:
- `nome_fantasia` (text, nullable) - Nome fantasia da empresa
- `numero` (text, nullable) - Numero do endereco
- `bairro` (text, nullable) - Bairro
- `complemento` (text, nullable) - Complemento do endereco

Adicionar colunas na tabela `envios` para os campos do wizard que ainda nao existem no banco:
- `cliente_telefone` (text, nullable)
- `cliente_numero` (text, nullable)
- `cliente_bairro` (text, nullable)
- `cliente_complemento` (text, nullable)
- `quantidade` (integer, default 1)
- `cfop` (text, nullable)
- `ncm_sh` (text, nullable)
- `cst` (text, nullable)
- `unidade` (text, default 'UN')

### 2. Redesign da Pagina Empresa

Reestruturar `src/pages/Empresa.tsx` com 3 secoes em cards separados (conforme a referencia):

**Secao 1 - Logo da Empresa**
- Upload de logo (PNG, JPG ou WEBP, maximo 2MB)
- Preview da logo atual com botao "Alterar Logo" e botao para remover
- Upload para o bucket `logos` do storage

**Secao 2 - Dados da Empresa**
- Icone e subtitulo "Informacoes fiscais para emissao de NFE"
- Campos: Razao Social*, Nome Fantasia (Opcional), CNPJ*, Inscricao Estadual (Opcional), Email de Contato (Opcional)

**Secao 3 - Endereco da Empresa**
- Icone e subtitulo "Endereco completo para a NFE"
- Campos: Endereco (Rua)*, Numero*, Bairro*, Cidade*, Estado* (select com UFs), CEP*, Complemento (Opcional)

**Barra de acoes no rodape**
- Botao "Limpar Dados" (outline)
- Botao "Pre-visualizar NFE" (outline) - abre modal com preview da DANFE
- Botao "Salvar Configuracao" (primario, azul)

Badge "Nacional (BR)" no canto superior direito.

### 3. Geracao da DANFE (PDF Visual)

Criar componente `src/components/danfe/DanfePreview.tsx`:

- Modal com pre-visualizacao da DANFE usando Canvas (renderizado em um elemento canvas HTML)
- Layout fiel ao modelo padrao da DANFE conforme a imagem de referencia, incluindo:
  - Cabecalho com dados da empresa (razao social, endereco, CNPJ, IE, telefone, email)
  - Secao "DANFE - Documento Auxiliar da Nota Fiscal Eletronica"
  - Destinatario/Remetente (dados do cliente - preenchido com dados de exemplo na pre-visualizacao)
  - Calculo do Imposto (campos zerados para MVP)
  - Transportador/Volumes Transportados
  - Dados dos Produtos/Servicos
  - Dados Adicionais
  - Data e hora da impressao
- Botao para baixar como PDF (usando canvas `toDataURL` ou biblioteca jsPDF)

### 4. Detalhes Tecnicos

**Arquivos a criar:**
- `src/components/danfe/DanfePreview.tsx` - Componente do modal com canvas da DANFE

**Arquivos a modificar:**
- `src/pages/Empresa.tsx` - Redesign completo com as 3 secoes, upload de logo, e botao de pre-visualizacao
- `src/components/envios/NovoEnvioWizard.tsx` - Atualizar insert para incluir os novos campos do banco

**Dependencia nova:**
- `jspdf` - Para gerar o PDF da DANFE a partir do canvas

**Fluxo da DANFE:**
1. Usuario preenche dados da empresa e salva
2. Clica em "Pre-visualizar NFE" 
3. Modal abre com a DANFE renderizada usando os dados salvos da empresa + dados de exemplo para cliente/produto
4. Quando um envio real for criado (via wizard ou webhook), a DANFE sera gerada com os dados reais do pedido combinados com os dados da empresa

