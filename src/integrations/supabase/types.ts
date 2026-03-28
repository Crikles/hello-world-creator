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
      admin_cashback_processed: {
        Row: {
          destinatarios: Json
          id: string
          period_end: string
          period_start: string
          processed_at: string
          processed_by: string
          total_cashback: number
          total_clients: number
          user_id: string
        }
        Insert: {
          destinatarios?: Json
          id?: string
          period_end: string
          period_start: string
          processed_at?: string
          processed_by: string
          total_cashback?: number
          total_clients?: number
          user_id: string
        }
        Update: {
          destinatarios?: Json
          id?: string
          period_end?: string
          period_start?: string
          processed_at?: string
          processed_by?: string
          total_cashback?: number
          total_clients?: number
          user_id?: string
        }
        Relationships: []
      }
      batch_progress: {
        Row: {
          cancelled: boolean
          current_item: number
          id: string
          loja_id: string
          started_at: string
          total_items: number
          updated_at: string
        }
        Insert: {
          cancelled?: boolean
          current_item?: number
          id?: string
          loja_id: string
          started_at?: string
          total_items?: number
          updated_at?: string
        }
        Update: {
          cancelled?: boolean
          current_item?: number
          id?: string
          loja_id?: string
          started_at?: string
          total_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_progress_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: true
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      cashback_log: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          envio_id: string
          id: string
          loja_id: string
          motivo: string | null
          status: string
          user_id: string
          valor_devolvido: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          envio_id: string
          id?: string
          loja_id: string
          motivo?: string | null
          status?: string
          user_id: string
          valor_devolvido?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          envio_id?: string
          id?: string
          loja_id?: string
          motivo?: string | null
          status?: string
          user_id?: string
          valor_devolvido?: number
        }
        Relationships: []
      }
      checkout_integrations: {
        Row: {
          ativo: boolean
          checkout_id: string
          created_at: string
          filtro_metodo: string
          id: string
          loja_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          checkout_id: string
          created_at?: string
          filtro_metodo?: string
          id?: string
          loja_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          checkout_id?: string
          created_at?: string
          filtro_metodo?: string
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
          postagem_template_id: string | null
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
          postagem_template_id?: string | null
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
          postagem_template_id?: string | null
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
          {
            foreignKeyName: "envios_postagem_template_id_fkey"
            columns: ["postagem_template_id"]
            isOneToOne: false
            referencedRelation: "postagem_templates"
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
          logistica_provider: string | null
          nome: string
          slug: string
          updated_at: string
          user_id: string
          webhook_token: string
        }
        Insert: {
          created_at?: string
          id?: string
          logistica_provider?: string | null
          nome: string
          slug: string
          updated_at?: string
          user_id: string
          webhook_token?: string
        }
        Update: {
          created_at?: string
          id?: string
          logistica_provider?: string | null
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
          ativar_vizinho: boolean
          auto_envio: boolean | null
          checkout_url_falha: string | null
          cor_botao_cta: string | null
          cor_primaria: string | null
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
          whatsapp_auto_send: boolean | null
          whatsapp_btn_text: string | null
          whatsapp_btn2_text: string | null
          whatsapp_btn2_url: string | null
          whatsapp_delay_seconds: number | null
          whatsapp_footer: string | null
          whatsapp_image_url: string | null
          whatsapp_msg_template: string | null
          whatsapp_reply_text: string | null
          whatsapp_vendedor: string | null
        }
        Insert: {
          ativar_falha_entrega?: boolean
          ativar_site_rastreio?: boolean
          ativar_taxacao?: boolean
          ativar_vizinho?: boolean
          auto_envio?: boolean | null
          checkout_url_falha?: string | null
          cor_botao_cta?: string | null
          cor_primaria?: string | null
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
          whatsapp_auto_send?: boolean | null
          whatsapp_btn_text?: string | null
          whatsapp_btn2_text?: string | null
          whatsapp_btn2_url?: string | null
          whatsapp_delay_seconds?: number | null
          whatsapp_footer?: string | null
          whatsapp_image_url?: string | null
          whatsapp_msg_template?: string | null
          whatsapp_reply_text?: string | null
          whatsapp_vendedor?: string | null
        }
        Update: {
          ativar_falha_entrega?: boolean
          ativar_site_rastreio?: boolean
          ativar_taxacao?: boolean
          ativar_vizinho?: boolean
          auto_envio?: boolean | null
          checkout_url_falha?: string | null
          cor_botao_cta?: string | null
          cor_primaria?: string | null
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
          whatsapp_auto_send?: boolean | null
          whatsapp_btn_text?: string | null
          whatsapp_btn2_text?: string | null
          whatsapp_btn2_url?: string | null
          whatsapp_delay_seconds?: number | null
          whatsapp_footer?: string | null
          whatsapp_image_url?: string | null
          whatsapp_msg_template?: string | null
          whatsapp_reply_text?: string | null
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
          resend_email_id: string | null
          status: string
          updated_at: string | null
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
          resend_email_id?: string | null
          status?: string
          updated_at?: string | null
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
          resend_email_id?: string | null
          status?: string
          updated_at?: string | null
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
          admin_tag: string | null
          blocked: boolean
          created_at: string
          custom_prices: Json | null
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean | null
          referral_code: string | null
          referred_by: string | null
          whatsapp: string | null
          whatsapp_verified: boolean
        }
        Insert: {
          admin_tag?: string | null
          blocked?: boolean
          created_at?: string
          custom_prices?: Json | null
          email?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean | null
          referral_code?: string | null
          referred_by?: string | null
          whatsapp?: string | null
          whatsapp_verified?: boolean
        }
        Update: {
          admin_tag?: string | null
          blocked?: boolean
          created_at?: string
          custom_prices?: Json | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          referral_code?: string | null
          referred_by?: string | null
          whatsapp?: string | null
          whatsapp_verified?: boolean
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
      referral_earnings: {
        Row: {
          amount_earned: number
          created_at: string
          id: string
          pix_payment_id: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          amount_earned: number
          created_at?: string
          id?: string
          pix_payment_id: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          amount_earned?: number
          created_at?: string
          id?: string
          pix_payment_id?: string
          referred_id?: string
          referrer_id?: string
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
      signup_verifications: {
        Row: {
          approved_by: string | null
          code: string
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          phone: string
          status: string
          verified_at: string | null
        }
        Insert: {
          approved_by?: string | null
          code: string
          created_at?: string
          email: string
          expires_at?: string
          full_name: string
          id?: string
          phone: string
          status?: string
          verified_at?: string | null
        }
        Update: {
          approved_by?: string | null
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          phone?: string
          status?: string
          verified_at?: string | null
        }
        Relationships: []
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
          text_value: string | null
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          key: string
          label?: string | null
          text_value?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          key?: string
          label?: string | null
          text_value?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      upsell_config: {
        Row: {
          ativo: boolean
          botao_texto: string | null
          botao_url: string | null
          cor_botao_bg: string | null
          cor_botao_texto: string | null
          cor_descricao: string | null
          cor_fundo: string | null
          cor_headline: string | null
          cor_nome_produto: string | null
          cor_sub_headline: string | null
          cor_valor: string | null
          created_at: string
          headline: string | null
          id: string
          loja_id: string
          produto_descricao: string | null
          produto_imagem_url: string | null
          produto_nome: string | null
          produto_valor: string | null
          sub_headline: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          botao_texto?: string | null
          botao_url?: string | null
          cor_botao_bg?: string | null
          cor_botao_texto?: string | null
          cor_descricao?: string | null
          cor_fundo?: string | null
          cor_headline?: string | null
          cor_nome_produto?: string | null
          cor_sub_headline?: string | null
          cor_valor?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          loja_id: string
          produto_descricao?: string | null
          produto_imagem_url?: string | null
          produto_nome?: string | null
          produto_valor?: string | null
          sub_headline?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          botao_texto?: string | null
          botao_url?: string | null
          cor_botao_bg?: string | null
          cor_botao_texto?: string | null
          cor_descricao?: string | null
          cor_fundo?: string | null
          cor_headline?: string | null
          cor_nome_produto?: string | null
          cor_sub_headline?: string | null
          cor_valor?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          loja_id?: string
          produto_descricao?: string | null
          produto_imagem_url?: string | null
          produto_nome?: string | null
          produto_valor?: string | null
          sub_headline?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "upsell_config_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
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
      whatsapp_instances: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          instance_name: string
          instance_token: string
          label: string | null
          loja_id: string
          pairing_code: string | null
          phone: string | null
          qr_code: string | null
          status: string
          subscription_id: string | null
          subscription_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          instance_name: string
          instance_token: string
          label?: string | null
          loja_id: string
          pairing_code?: string | null
          phone?: string | null
          qr_code?: string | null
          status?: string
          subscription_id?: string | null
          subscription_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          instance_name?: string
          instance_token?: string
          label?: string | null
          loja_id?: string
          pairing_code?: string | null
          phone?: string | null
          qr_code?: string | null
          status?: string
          subscription_id?: string | null
          subscription_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_log: {
        Row: {
          created_at: string
          envio_id: string
          error_reason: string | null
          http_status: number | null
          id: string
          instance_id: string | null
          loja_id: string
          provider_response: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          envio_id: string
          error_reason?: string | null
          http_status?: number | null
          id?: string
          instance_id?: string | null
          loja_id: string
          provider_response?: Json | null
          status?: string
        }
        Update: {
          created_at?: string
          envio_id?: string
          error_reason?: string | null
          http_status?: number | null
          id?: string
          instance_id?: string | null
          loja_id?: string
          provider_response?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_log_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_log_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_log_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_send_queue: {
        Row: {
          choices: Json | null
          created_at: string
          envio_id: string
          error_reason: string | null
          footer_text: string | null
          http_status: number | null
          id: string
          image_url: string | null
          instance_id: string | null
          loja_id: string
          msg_text: string
          number: string
          processed_at: string | null
          provider_response: Json | null
          retry_count: number
          scheduled_at: string
          status: string
        }
        Insert: {
          choices?: Json | null
          created_at?: string
          envio_id: string
          error_reason?: string | null
          footer_text?: string | null
          http_status?: number | null
          id?: string
          image_url?: string | null
          instance_id?: string | null
          loja_id: string
          msg_text: string
          number: string
          processed_at?: string | null
          provider_response?: Json | null
          retry_count?: number
          scheduled_at?: string
          status?: string
        }
        Update: {
          choices?: Json | null
          created_at?: string
          envio_id?: string
          error_reason?: string | null
          footer_text?: string | null
          http_status?: number | null
          id?: string
          image_url?: string | null
          instance_id?: string | null
          loja_id?: string
          msg_text?: string
          number?: string
          processed_at?: string | null
          provider_response?: Json | null
          retry_count?: number
          scheduled_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_send_queue_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_send_queue_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_send_queue_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_subscriptions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          loja_id: string
          price_paid: number
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          loja_id: string
          price_paid?: number
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          loja_id?: string
          price_paid?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_subscriptions_loja_id_fkey"
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
      approve_cashback: {
        Args: { _admin_id: string; _cashback_id: string }
        Returns: boolean
      }
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
      process_cashback: {
        Args: { _envio_id: string; _user_id: string }
        Returns: number
      }
      reject_cashback: {
        Args: { _admin_id: string; _cashback_id: string }
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
