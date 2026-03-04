'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { cn } from "@/lib/utils";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Shield,
  AlertTriangle,
  KeyRound,
  Phone,
  Loader2,
  CheckCircle,
} from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'reset';

interface AuthFormProps {
  onLogin?: (email: string, password: string) => Promise<void>;
  onSignup?: (email: string, password: string, name: string, phone: string) => Promise<void>;
  onReset?: (email: string) => Promise<void>;
  initialMode?: AuthMode;
  loading?: boolean;
  className?: string;
  logo?: string;
  logoAlt?: string;
  title?: string;
  subtitle?: string;
  signupSuccess?: boolean;
  signupEmail?: string;
  onResendEmail?: () => Promise<void>;
  resending?: boolean;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  agreeToTerms: boolean;
  rememberMe: boolean;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  phone?: string;
  agreeToTerms?: string;
  general?: string;
}

interface PasswordStrength {
  score: number;
  feedback: string[];
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

const calculatePasswordStrength = (password: string): PasswordStrength => {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };
  const score = Object.values(requirements).filter(Boolean).length;
  const feedback: string[] = [];
  if (!requirements.length) feedback.push('Pelo menos 8 caracteres');
  if (!requirements.uppercase) feedback.push('Uma letra maiúscula');
  if (!requirements.lowercase) feedback.push('Uma letra minúscula');
  if (!requirements.number) feedback.push('Um número');
  if (!requirements.special) feedback.push('Um caractere especial');
  return { score, feedback, requirements };
};

const PasswordStrengthIndicator: React.FC<{ password: string }> = ({ password }) => {
  const strength = calculatePasswordStrength(password);

  const getStrengthColor = (score: number) => {
    if (score <= 1) return 'text-destructive';
    if (score <= 2) return 'text-orange-500';
    if (score <= 3) return 'text-yellow-500';
    if (score <= 4) return 'text-blue-500';
    return 'text-primary';
  };

  const getBarColor = (score: number) => {
    if (score <= 1) return 'bg-destructive';
    if (score <= 2) return 'bg-orange-500';
    if (score <= 3) return 'bg-yellow-500';
    if (score <= 4) return 'bg-blue-500';
    return 'bg-primary';
  };

  const getStrengthText = (score: number) => {
    if (score <= 1) return 'Muito fraca';
    if (score <= 2) return 'Fraca';
    if (score <= 3) return 'Razoável';
    if (score <= 4) return 'Boa';
    return 'Forte';
  };

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-300", getBarColor(strength.score))}
            style={{ width: `${(strength.score / 5) * 100}%` }}
          />
        </div>
        <span className={cn("text-xs font-medium", getStrengthColor(strength.score))}>
          {getStrengthText(strength.score)}
        </span>
      </div>
      {strength.feedback.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {strength.feedback.map((item, index) => (
            <span key={index} className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              <Shield className="inline h-2.5 w-2.5 mr-0.5" />
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export function AuthForm({
  onLogin,
  onSignup,
  onReset,
  initialMode = 'login',
  loading = false,
  className,
  logo,
  logoAlt = 'Logo',
  title,
  subtitle,
  signupSuccess = false,
  signupEmail,
  onResendEmail,
  resending = false,
}: AuthFormProps) {
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    agreeToTerms: false,
    rememberMe: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [fieldTouched, setFieldTouched] = useState<Record<string, boolean>>({});

  const validateField = useCallback((field: keyof FormData, value: string | boolean) => {
    let error = '';
    switch (field) {
      case 'name':
        if (typeof value === 'string' && authMode === 'signup' && !value.trim()) error = 'Nome é obrigatório';
        break;
      case 'phone':
        if (typeof value === 'string' && authMode === 'signup') {
          if (!value.trim()) error = 'WhatsApp é obrigatório';
          else if (!/^\d+$/.test(value.replace(/\D/g, ''))) error = 'Apenas números';
          else if (value.replace(/\D/g, '').length < 10) error = 'Mínimo 10 dígitos';
        }
        break;
      case 'email':
        if (!value || (typeof value === 'string' && !value.trim())) error = 'Email é obrigatório';
        else if (typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Email inválido';
        break;
      case 'password':
        if (!value) error = 'Senha é obrigatória';
        else if (typeof value === 'string' && value.length < 6) error = 'Mínimo 6 caracteres';
        break;
      case 'confirmPassword':
        if (authMode === 'signup' && value !== formData.password) error = 'Senhas não coincidem';
        break;
    }
    return error;
  }, [formData.password, authMode]);

  const handleInputChange = useCallback((field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (fieldTouched[field]) {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error || undefined }));
    }
  }, [fieldTouched, validateField]);

  const handleFieldBlur = useCallback((field: keyof FormData) => {
    setFieldTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field]);
    setErrors(prev => ({ ...prev, [field]: error || undefined }));
  }, [formData, validateField]);

  const validateForm = useCallback(() => {
    const newErrors: FormErrors = {};
    const fields: (keyof FormData)[] = authMode === 'signup'
      ? ['name', 'phone', 'email', 'password', 'confirmPassword']
      : authMode === 'reset' ? ['email'] : ['email', 'password'];
    fields.forEach(f => {
      const err = validateField(f, formData[f]);
      if (err) newErrors[f as keyof FormErrors] = err;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [authMode, formData, validateField]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      if (authMode === 'login') await onLogin?.(formData.email, formData.password);
      else if (authMode === 'signup') await onSignup?.(formData.email, formData.password, formData.name);
      else if (authMode === 'reset') await onReset?.(formData.email);
    } catch {
      // errors handled by parent
    }
  };

  // Signup success screen
  if (signupSuccess) {
    return (
      <div className={cn("w-full max-w-md mx-auto", className)}>
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-primary mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Verifique seu email</h2>
          <p className="text-sm text-muted-foreground">
            Enviamos um link de confirmação para <strong className="text-foreground">{signupEmail}</strong>.
          </p>
          <div className="flex flex-col gap-2">
            {onResendEmail && (
              <button
                onClick={onResendEmail}
                disabled={resending}
                className="w-full py-2.5 border border-input rounded-xl text-sm font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                {resending ? 'Reenviando...' : 'Enviar Novamente'}
              </button>
            )}
            <a href="/login" className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
              Voltar para Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  const renderResetForm = () => (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <KeyRound className="h-10 w-10 text-primary mx-auto mb-2" />
        <h3 className="text-lg font-semibold text-foreground">Recuperar Senha</h3>
        <p className="text-sm text-muted-foreground">
          Informe seu email para receber o link de redefinição.
        </p>
      </div>
      <div className="space-y-1.5">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="email"
            placeholder="seu@email.com"
            value={formData.email}
            onChange={e => handleInputChange('email', e.target.value)}
            onBlur={() => handleFieldBlur('email')}
            className={cn(
              "w-full pl-10 pr-4 py-3 bg-muted/50 border rounded-xl placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground",
              errors.email ? "border-destructive" : "border-input"
            )}
          />
        </div>
        {errors.email && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {errors.email}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <>
            <Mail className="h-4 w-4" />
            Enviar Link
          </>
        )}
      </button>
      <div className="text-center">
        <button type="button" onClick={() => setAuthMode('login')} className="text-primary hover:text-primary/80 text-sm transition-colors">
          Voltar para Login
        </button>
      </div>
    </div>
  );

  const renderMainForm = () => (
    <div className="space-y-4">
      {authMode === 'signup' && (
        <div className="space-y-1.5">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Nome completo"
              value={formData.name}
              onChange={e => handleInputChange('name', e.target.value)}
              onBlur={() => handleFieldBlur('name')}
              className={cn(
                "w-full pl-10 pr-4 py-3 bg-muted/50 border rounded-xl placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground",
                errors.name ? "border-destructive" : "border-input"
              )}
            />
          </div>
          {errors.name && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />{errors.name}
            </p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="email"
            placeholder="seu@email.com"
            value={formData.email}
            onChange={e => handleInputChange('email', e.target.value)}
            onBlur={() => handleFieldBlur('email')}
            className={cn(
              "w-full pl-10 pr-4 py-3 bg-muted/50 border rounded-xl placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground",
              errors.email ? "border-destructive" : "border-input"
            )}
          />
        </div>
        {errors.email && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />{errors.email}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Sua senha"
            value={formData.password}
            onChange={e => handleInputChange('password', e.target.value)}
            onBlur={() => handleFieldBlur('password')}
            className={cn(
              "w-full pl-10 pr-12 py-3 bg-muted/50 border rounded-xl placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground",
              errors.password ? "border-destructive" : "border-input"
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />{errors.password}
          </p>
        )}
        {authMode === 'signup' && <PasswordStrengthIndicator password={formData.password} />}
      </div>

      {authMode === 'signup' && (
        <div className="space-y-1.5">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirmar senha"
              value={formData.confirmPassword}
              onChange={e => handleInputChange('confirmPassword', e.target.value)}
              onBlur={() => handleFieldBlur('confirmPassword')}
              className={cn(
                "w-full pl-10 pr-12 py-3 bg-muted/50 border rounded-xl placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground",
                errors.confirmPassword ? "border-destructive" : "border-input"
              )}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />{errors.confirmPassword}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        {authMode === 'login' ? (
          <>
            <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={formData.rememberMe}
                onChange={e => handleInputChange('rememberMe', e.target.checked)}
                className="w-4 h-4 rounded border-input bg-muted text-primary focus:ring-primary"
              />
              Lembrar de mim
            </label>
            <button type="button" onClick={() => setAuthMode('reset')} className="text-primary hover:text-primary/80 transition-colors">
              Esqueceu a senha?
            </button>
          </>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          authMode === 'login' ? 'Entrar' : 'Criar Conta'
        )}
      </button>
    </div>
  );

  return (
    <div className={cn("w-full max-w-md mx-auto space-y-6", className)}>
      {/* Logo */}
      {logo && (
        <div className="flex flex-col items-center gap-3">
          <img src={logo} alt={logoAlt} className="h-28 w-auto object-contain" />
          {title && <h1 className="text-xl font-bold text-foreground">{title}</h1>}
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl space-y-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-foreground">
            {authMode === 'login' ? 'Bem-vindo de volta' : authMode === 'reset' ? 'Redefinir Senha' : 'Criar Conta'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {authMode === 'login' ? 'Acesse sua conta' : authMode === 'reset' ? 'Recupere o acesso' : 'Crie uma nova conta'}
          </p>
        </div>

        {/* Tabs */}
        {authMode !== 'reset' && (
          <div className="flex bg-muted/50 rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={cn(
                "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all",
                authMode === 'login' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('signup')}
              className={cn(
                "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all",
                authMode === 'signup' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Cadastro
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {authMode === 'reset' ? renderResetForm() : renderMainForm()}
        </form>

        {/* Footer toggle */}
        {authMode !== 'reset' && (
          <div className="pt-2 border-t border-border">
            <p className="text-center text-sm text-muted-foreground">
              {authMode === 'login' ? 'Não tem conta? ' : 'Já tem conta? '}
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {authMode === 'login' ? 'Cadastre-se' : 'Fazer login'}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
