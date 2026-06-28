// Tradutor centralizado de mensagens de erro do Supabase Auth.
// Sempre retorna uma string clara em português explicando o motivo.
export function translateAuthError(rawMsg: string | undefined | null): string {
  const msg = String(rawMsg ?? "").trim();
  if (!msg) return "Ocorreu um erro inesperado. Tente novamente.";
  const m = msg.toLowerCase();

  // Senha vazada / fraca (HIBP)
  if (
    m.includes("pwned") ||
    m.includes("hibp") ||
    (m.includes("password") && (m.includes("weak") || m.includes("easy to guess") || m.includes("known to be")))
  ) {
    return "Esta senha apareceu em vazamentos públicos e é considerada fraca. Escolha uma senha única, com letras maiúsculas, minúsculas, números e símbolos.";
  }

  // Senha muito curta
  if (m.includes("password") && (m.includes("at least") || m.includes("should be") || m.includes("6"))) {
    return "A senha precisa ter no mínimo 6 caracteres.";
  }

  // Email já cadastrado
  if (m.includes("already registered") || m.includes("user already") || m.includes("already exists")) {
    return "Este e-mail já está cadastrado. Faça login ou use 'Esqueci minha senha'.";
  }

  // Email inválido
  if (m.includes("invalid") && m.includes("email")) {
    return "E-mail inválido. Verifique se digitou corretamente.";
  }

  // Domínio de email não permitido (trigger validate_signup_email_domain)
  if (m.includes("gmail") && m.includes("hotmail")) {
    return "Apenas e-mails Gmail, Hotmail, Outlook ou Proton são permitidos no cadastro.";
  }

  // Credenciais inválidas no login
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "E-mail ou senha inválidos.";
  }

  // Email não confirmado
  if (m.includes("email not confirmed") || m.includes("confirm your email")) {
    return "Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada e spam.";
  }

  // Conta banida/bloqueada
  if (m.includes("banned") || m.includes("blocked")) {
    return "Sua conta foi bloqueada. Entre em contato com o suporte.";
  }

  // Rate limit
  if (m.includes("rate") || m.includes("too many") || m.includes("for security purposes")) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }

  // Token / sessão
  if (m.includes("token") && (m.includes("expired") || m.includes("invalid"))) {
    return "Sessão expirada. Faça login novamente.";
  }
  if (m.includes("refresh token")) {
    return "Sessão expirada. Faça login novamente.";
  }

  // Captcha
  if (m.includes("captcha")) {
    return "Falha na verificação anti-robô. Recarregue a página e tente novamente.";
  }

  // Rede
  if (m.includes("network") || m.includes("failed to fetch")) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }

  // Edge function genérico — tenta devolver a própria mensagem se já estiver em PT
  if (m.includes("non-2xx") || m.includes("functionshttperror")) {
    return "O servidor recusou a requisição. Tente novamente em instantes.";
  }

  // Fallback: devolve a mensagem original (pode já estar em PT vinda das edge functions)
  return msg;
}
