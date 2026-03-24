/**
 * Realistic NCM/SH and CST codes for DANFE fallback generation.
 * These are common codes used in Brazilian e-commerce / retail.
 */

// Common NCM/SH codes for typical e-commerce products
const NCM_CODES = [
  "61091000", // Camisetas de malha de algodão
  "62046200", // Calças de algodão
  "64041900", // Calçados com sola de borracha
  "85171200", // Telefones celulares
  "84713012", // Notebooks / laptops
  "33049910", // Cosméticos / cremes
  "42021200", // Bolsas e malas
  "42029200", // Estojos e mochilas
  "71171900", // Bijuterias
  "96032100", // Escovas de dentes
  "39241000", // Utensílios de mesa plásticos
  "85167100", // Cafeteiras elétricas
  "94036000", // Móveis de madeira
  "49019900", // Livros e impressos
  "85234990", // Mídias gravadas
  "62034200", // Calças de algodão masculinas
  "61102000", // Suéteres de algodão
  "85044090", // Conversores elétricos
  "90049090", // Óculos de sol
  "95030090", // Brinquedos diversos
];

// Common CST codes for ICMS (Simples Nacional and Regime Normal)
const CST_CODES = [
  "102", // Tributada pelo Simples Nacional sem permissão de crédito
  "101", // Tributada pelo Simples Nacional com permissão de crédito
  "103", // Isenção do ICMS no Simples Nacional
  "202", // Tributada pelo SN sem crédito e com cobrança do ICMS por ST
  "300", // Imune
  "400", // Não tributada
  "500", // ICMS cobrado anteriormente por ST
  "900", // Outros (Simples Nacional)
  "000", // Tributada integralmente (Regime Normal)
  "010", // Tributada e com cobrança do ICMS por ST
  "020", // Com redução de base de cálculo
  "041", // Não tributada (Regime Normal)
  "060", // ICMS cobrado anteriormente por ST (Regime Normal)
];

/**
 * Returns a deterministic but realistic NCM/SH code based on a seed string.
 * If no seed is provided, returns a random code.
 */
export function getRandomNcm(seed?: string): string {
  const idx = seed
    ? Math.abs(hashCode(seed)) % NCM_CODES.length
    : Math.floor(Math.random() * NCM_CODES.length);
  return NCM_CODES[idx];
}

/**
 * Returns a deterministic but realistic CST code based on a seed string.
 * If no seed is provided, returns a random code.
 */
export function getRandomCst(seed?: string): string {
  const idx = seed
    ? Math.abs(hashCode(seed + "_cst")) % CST_CODES.length
    : Math.floor(Math.random() * CST_CODES.length);
  return CST_CODES[idx];
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}
