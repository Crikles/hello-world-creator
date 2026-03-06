export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      checkout_integrations: {
        Row: {
          ativo: boolean
          checkout_id: string
          created_at: string
          id: string
          loja_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          checkout_id: string
          created_at?: string
          id?: string
          loja_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          checkout_id?: string
          created_at?: string
          id?: string
          loja_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      creditos: {
        Row: {
          id: string
          saldo: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          saldo?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          saldo?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creditos_transacoes: {
        Row: {
          admin_id: string | null
          created_at: string
          descricao: string | null
          id: string
          quantidade: number
          tipo: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          quantidade: number
          tipo: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          quantidade?: number
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      empresas: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          logo_url: string | null
          loja_id: string | null
          nome_fantasia: string | null
          numero: string | null
          razao_social: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          loja_id?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          razao_social?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          loja_id?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          razao_social?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      envios: {
        Row: {
          cfop: string | null
          cliente_bairro: string | null
          cliente_cep: string | null
          cliente_cidade: string | null
          cliente_complemento: string | null
          cliente_cpf: string | null
          cliente_email: string
          cliente_endereco: string | null
          cliente_estado: string | null
          cliente_nome: string
          cliente_numero: string | null
          cliente_telefone: string | null
          codigo_rastreio: string | null
          created_at: string
          cst: string | null
          deleted_at: string | null
          empresa_id: string | null
          id: string
          loja_id: string | null
          ncm_sh: string | null
          nfe_chave_acesso: string | null
          nfe_numero: string | null
          nfe_serie: string | null
          produto: string
          proximo_avanco_em: string | null
          quantidade: number
          status: Database["public"]["Enums"]["shipment_status"]
          status_label: string | null
          transportadora: string | null
          ultimo_evento_ordem: number
          unidade: string
          updated_at: string
          valor: number
        }
        Insert: {
          cfop?: string | null
          cliente_bairro?: string | null
          cliente_cep?: string | null
          cliente_cidade?: string | null
          cliente_complemento?: string | null
          cliente_cpf?: string | null
          cliente_email: string
          cliente_endereco?: string | null
          cliente_estado?: string | null
          cliente_nome: string
          cliente_numero?: string | null
          cliente_telefone?: string | null
          codigo_rastreio?: string | null
          created_at?: string
          cst?: string | null
          deleted_at?: string | null
          empresa_id?: string | null
          id?: string
          loja_id?: string | null
          ncm_sh?: string | null
          nfe_chave_acesso?: string | null
          nfe_numero?: string | null
          nfe_serie?: string | null
          produto: string
          proximo_avanco_em?: string | null
          quantidade?: number
          status?: Database["public"]["Enums"]["shipment_status"]
          status_label?: string | null
          transportadora?: string | null
          ultimo_evento_ordem?: number
          unidade?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          cfop?: string | null
          cliente_bairro?: string | null
          cliente_cep?: string | null
          cliente_cidade?: string | null
          cliente_complemento?: string | null
          cliente_cpf?: string | null
          cliente_email?: string
          cliente_endereco?: string | null
          cliente_estado?: string | null
          cliente_nome?: string
          cliente_numero?: string | null
          cliente_telefone?: string | null
          codigo_rastreio?: string | null
          created_at?: string
          cst?: string | null
          deleted_at?: string | null
          empresa_id?: string | null
          id?: string
          loja_id?: string | null
          ncm_sh?: string | null
          nfe_chave_acesso?: string | null
          nfe_numero?: string | null
          nfe_serie?: string | null
          produto?: string
          proximo_avanco_em?: string | null
          quantidade?: number
          status?: Database["public"]["Enums"]["shipment_status"]
          status_label?: string | null
          transportadora?: string | null
          ultimo_evento_ordem?: number
          unidade?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "envios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envios_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf: string | null
          created_at: string | null
          email: string
          endereco: string | null
          envio_id: string | null
          estado: string | null
          id: string
          loja_id: string | null
          nome: string
          numero: string | null
          produto: string | null
          telefone: string | null
          valor: number | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string | null
          email: string
          endereco?: string | null
          envio_id?: string | null
          estado?: string | null
          id?: string
          loja_id?: string | null
          nome: string
          numero?: string | null
          produto?: string | null
          telefone?: string | null
          valor?: number | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string
          endereco?: string | null
          envio_id?: string | null
          estado?: string | null
          id?: string
          loja_id?: string | null
          nome?: string
          numero?: string | null
          produto?: string | null
          telefone?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          created_at: string
          id: string
          nome: string
          slug: string
          updated_at: string
          user_id: string
          webhook_token: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          slug: string
          updated_at?: string
          user_id: string
          webhook_token?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          slug?: string
          updated_at?: string
          user_id?: string
          webhook_token?: string
        }
        Relationships: []
      }
      pedidos: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_country: string | null
          address_district: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip_code: string | null
          checkout_provider: string
          created_at: string
          customer_document: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          envio_id: string | null
          id: string
          loja_id: string | null
          method: string | null
          products: Json | null
          raw_payload: Json | null
          status: string
          total_price: number
          transaction_token: string
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          checkout_provider: string
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          envio_id?: string | null
          id?: string
          loja_id?: string | null
          method?: string | null
          products?: Json | null
          raw_payload?: Json | null
          status: string
          total_price?: number
          transaction_token: string
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          checkout_provider?: string
          created_at?: string
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          envio_id?: string | null
          id?: string
          loja_id?: string | null
          method?: string | null
          products?: Json | null
          raw_payload?: Json | null
          status?: string
          total_price?: number
          transaction_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      pix_payments: {
        Row: {
          amount_cents: number
          copy_paste: string | null
          created_at: string
          id: string
          moedas: number
          paid_at: string | null
          qr_code_base64: string | null
          status: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          copy_paste?: string | null
          created_at?: string
          id?: string
          moedas: number
          paid_at?: string | null
          qr_code_base64?: string | null
          status?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          copy_paste?: string | null
          created_at?: string
          id?: string
          moedas?: number
          paid_at?: string | null
          qr_code_base64?: string | null
          status?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pix_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      postagem_config: {
        Row: {
          ativar_falha_entrega: boolean
          ativar_site_rastreio: boolean
          ativar_taxacao: boolean
          auto_envio: boolean | null
          checkout_url_falha: string | null
          created_at: string
          email_remetente: string | null
          enviar_emails: boolean
          enviar_nfe_email: boolean
          id: string
          loja_id: string
          msg_falha_entrega: string | null
          origem_cidade: string | null
          origem_estado: string | null
          template_ativo_id: string | null
          updated_at: string
          valor_taxa_falha: number | null
          whatsapp_vendedor: string | null
        }
        Insert: {
          ativar_falha_entrega?: boolean
          ativar_site_rastreio?: boolean
          ativar_taxacao?: boolean
          auto_envio?: boolean | null
          checkout_url_falha?: string | null
          created_at?: string
          email_remetente?: string | null
          enviar_emails?: boolean
          enviar_nfe_email?: boolean
          id?: string
          loja_id: string
          msg_falha_entrega?: string | null
          origem_cidade?: string | null
          origem_estado?: string | null
          template_ativo_id?: string | null
          updated_at?: string
          valor_taxa_falha?: number | null
          whatsapp_vendedor?: string | null
        }
        Update: {
          ativar_falha_entrega?: boolean
          ativar_site_rastreio?: boolean
          ativar_taxacao?: boolean
          auto_envio?: boolean | null
          checkout_url_falha?: string | null
          created_at?: string
          email_remetente?: string | null
          enviar_emails?: boolean
          enviar_nfe_email?: boolean
          id?: string
          loja_id?: string
          msg_falha_entrega?: string | null
          origem_cidade?: string | null
          origem_estado?: string | null
          template_ativo_id?: string | null
          updated_at?: string
          valor_taxa_falha?: number | null
          whatsapp_vendedor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "postagem_config_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: true
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "postagem_config_template_ativo_id_fkey"
            columns: ["template_ativo_id"]
            isOneToOne: false
            referencedRelation: "postagem_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      postagem_email_log: {
        Row: {
          assunto: string | null
          created_at: string
          custo: number
          destinatario: string
          envio_id: string | null
          evento_id: string | null
          id: string
          loja_id: string
          status: string
        }
        Insert: {
          assunto?: string | null
          created_at?: string
          custo?: number
          destinatario: string
          envio_id?: string | null
          evento_id?: string | null
          id?: string
          loja_id: string
          status?: string
        }
        Update: {
          assunto?: string | null
          created_at?: string
          custo?: number
          destinatario?: string
          envio_id?: string | null
          evento_id?: string | null
          id?: string
          loja_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "postagem_email_log_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "postagem_email_log_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "postagem_eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "postagem_email_log_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      postagem_eventos: {
        Row: {
          assunto_email: string | null
          corpo_email: string | null
          created_at: string
          delay_horas: number
          descricao: string | null
          enviar_email: boolean
          enviar_nfe_pdf: boolean
          id: string
          is_final: boolean
          nome: string
          ordem: number
          status_label: string | null
          template_id: string
        }
        Insert: {
          assunto_email?: string | null
          corpo_email?: string | null
          created_at?: string
          delay_horas?: number
          descricao?: string | null
          enviar_email?: boolean
          enviar_nfe_pdf?: boolean
          id?: string
          is_final?: boolean
          nome: string
          ordem?: number
          status_label?: string | null
          template_id: string
        }
        Update: {
          assunto_email?: string | null
          corpo_email?: string | null
          created_at?: string
          delay_horas?: number
          descricao?: string | null
          enviar_email?: boolean
          enviar_nfe_pdf?: boolean
          id?: string
          is_final?: boolean
          nome?: string
          ordem?: number
          status_label?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "postagem_eventos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "postagem_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      postagem_templates: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          is_system: boolean
          loja_id: string | null
          nome: string
          tipo: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_system?: boolean
          loja_id?: string | null
          nome: string
          tipo?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_system?: boolean
          loja_id?: string | null
          nome?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "postagem_templates_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          blocked: boolean
          created_at: string
          custom_prices: Json | null
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean | null
          whatsapp: string | null
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          custom_prices?: Json | null
          email?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean | null
          whatsapp?: string | null
        }
        Update: {
          blocked?: boolean
          created_at?: string
          custom_prices?: Json | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      push_notification_log: {
        Row: {
          body: string
          created_at: string
          icon_url: string | null
          id: string
          title: string
          total_failed: number | null
          total_sent: number | null
          url: string | null
        }
        Insert: {
          body: string
          created_at?: string
          icon_url?: string | null
          id?: string
          title: string
          total_failed?: number | null
          total_sent?: number | null
          url?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          icon_url?: string | null
          id?: string
          title?: string
          total_failed?: number | null
          total_sent?: number | null
          url?: string | null
        }
        Relationships: []
      }
      push_notification_settings: {
        Row: {
          badge_url: string | null
          created_at: string
          default_url: string | null
          icon_url: string | null
          id: string
          updated_at: string
        }
        Insert: {
          badge_url?: string | null
          created_at?: string
          default_url?: string | null
          icon_url?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          badge_url?: string | null
          created_at?: string
          default_url?: string | null
          icon_url?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          codigo_rastreio: string | null
          created_at: string
          endpoint: string
          id: string
          keys_auth: string
          keys_p256dh: string
        }
        Insert: {
          codigo_rastreio?: string | null
          created_at?: string
          endpoint: string
          id?: string
          keys_auth: string
          keys_p256dh: string
        }
        Update: {
          codigo_rastreio?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          keys_auth?: string
          keys_p256dh?: string
        }
        Relationships: []
      }
      push_templates: {
        Row: {
          created_at: string
          icon_url: string | null
          id: string
          mensagem: string
          nome: string
          titulo: string
          url: string | null
        }
        Insert: {
          created_at?: string
          icon_url?: string | null
          id?: string
          mensagem: string
          nome: string
          titulo: string
          url?: string | null
        }
        Update: {
          created_at?: string
          icon_url?: string | null
          id?: string
          mensagem?: string
          nome?: string
          titulo?: string
          url?: string | null
        }
        Relationships: []
      }
      shopify_integrations: {
        Row: {
          access_token: string | null
          ativo: boolean | null
          client_id: string
          client_secret: string
          created_at: string
          id: string
          loja_id: string
          shop_url: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          ativo?: boolean | null
          client_id: string
          client_secret: string
          created_at?: string
          id?: string
          loja_id: string
          shop_url: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          ativo?: boolean | null
          client_id?: string
          client_secret?: string
          created_at?: string
          id?: string
          loja_id?: string
          shop_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_integrations_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: true
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          created_at: string
          id: string
          mensagem: string
          status_key: string
          status_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mensagem: string
          status_key: string
          status_label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mensagem?: string
          status_key?: string
          status_label?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_config: {
        Row: {
          created_at: string
          key: string
          label: string | null
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          key: string
          label?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          key?: string
          label?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          checkout_provider: string
          created_at: string
          event_type: string
          id: string
          loja_id: string | null
          payload: Json
          processed: boolean
          status: string | null
        }
        Insert: {
          checkout_provider: string
          created_at?: string
          event_type: string
          id?: string
          loja_id?: string | null
          payload: Json
          processed?: boolean
          status?: string | null
        }
        Update: {
          checkout_provider?: string
          created_at?: string
          event_type?: string
          id?: string
          loja_id?: string | null
          payload?: Json
          processed?: boolean
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      debit_user_credits: {
        Args: { _descricao: string; _quantidade: number; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_owns_loja: {
        Args: { _loja_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      shipment_status:
        | "pendente"
        | "em_transito"
        | "saiu_para_entrega"
        | "entregue"
        | "coletado"
        | "centro_local"
        | "taxacao"
        | "pagamento_confirmado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      shipment_status: [
        "pendente",
        "em_transito",
        "saiu_para_entrega",
        "entregue",
        "coletado",
        "centro_local",
        "taxacao",
        "pagamento_confirmado",
      ],
    },
  },
} as const
