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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_cashback_processed: {
        Row: {
          created_at: string
          destinatarios: string[] | null
          id: string
          period_end: string
          period_start: string
          processed_by: string
          total_cashback: number
          total_clients: number
          user_id: string
        }
        Insert: {
          created_at?: string
          destinatarios?: string[] | null
          id?: string
          period_end: string
          period_start: string
          processed_by: string
          total_cashback?: number
          total_clients?: number
          user_id: string
        }
        Update: {
          created_at?: string
          destinatarios?: string[] | null
          id?: string
          period_end?: string
          period_start?: string
          processed_by?: string
          total_cashback?: number
          total_clients?: number
          user_id?: string
        }
        Relationships: []
      }
      admin_payment_webhooks: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          label: string | null
          url: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          label?: string | null
          url: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          label?: string | null
          url?: string
        }
        Relationships: []
      }
      backup_runs: {
        Row: {
          details: Json | null
          drive_folder_id: string | null
          error: string | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          tables_processed: number | null
          total_bytes: number | null
          total_rows: number | null
        }
        Insert: {
          details?: Json | null
          drive_folder_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          tables_processed?: number | null
          total_bytes?: number | null
          total_rows?: number | null
        }
        Update: {
          details?: Json | null
          drive_folder_id?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          tables_processed?: number | null
          total_bytes?: number | null
          total_rows?: number | null
        }
        Relationships: []
      }
      backup_state: {
        Row: {
          last_backup_at: string
          last_error: string | null
          last_rows_count: number | null
          last_run_at: string | null
          last_status: string | null
          table_name: string
          updated_at: string
        }
        Insert: {
          last_backup_at?: string
          last_error?: string | null
          last_rows_count?: number | null
          last_run_at?: string | null
          last_status?: string | null
          table_name: string
          updated_at?: string
        }
        Update: {
          last_backup_at?: string
          last_error?: string | null
          last_rows_count?: number | null
          last_run_at?: string | null
          last_status?: string | null
          table_name?: string
          updated_at?: string
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
          created_at: string
          descricao: string | null
          envio_id: string | null
          id: string
          loja_id: string | null
          status: string
          user_id: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          envio_id?: string | null
          id?: string
          loja_id?: string | null
          status?: string
          user_id?: string | null
          valor?: number
        }
        Update: {
          created_at?: string
          descricao?: string | null
          envio_id?: string | null
          id?: string
          loja_id?: string | null
          status?: string
          user_id?: string | null
          valor?: number
        }
        Relationships: []
      }
      checkout_integrations: {
        Row: {
          api_key: string | null
          ativo: boolean
          checkout_id: string | null
          config: Json | null
          created_at: string
          filtro_metodo: string
          id: string
          loja_id: string
          provider: string | null
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          api_key?: string | null
          ativo?: boolean
          checkout_id?: string | null
          config?: Json | null
          created_at?: string
          filtro_metodo?: string
          id?: string
          loja_id: string
          provider?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          api_key?: string | null
          ativo?: boolean
          checkout_id?: string | null
          config?: Json | null
          created_at?: string
          filtro_metodo?: string
          id?: string
          loja_id?: string
          provider?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_integrations_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      confirmacao_pagamento_config: {
        Row: {
          assunto_email: string
          ativo: boolean
          corpo_email: string
          created_at: string
          email_remetente_nome: string | null
          enviar_email: boolean
          enviar_sms: boolean
          id: string
          loja_id: string
          sms_template: string
          updated_at: string
        }
        Insert: {
          assunto_email?: string
          ativo?: boolean
          corpo_email?: string
          created_at?: string
          email_remetente_nome?: string | null
          enviar_email?: boolean
          enviar_sms?: boolean
          id?: string
          loja_id: string
          sms_template?: string
          updated_at?: string
        }
        Update: {
          assunto_email?: string
          ativo?: boolean
          corpo_email?: string
          created_at?: string
          email_remetente_nome?: string | null
          enviar_email?: boolean
          enviar_sms?: boolean
          id?: string
          loja_id?: string
          sms_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      confirmacao_pagamento_log: {
        Row: {
          created_at: string
          custo: number
          destinatario: string
          error_reason: string | null
          id: string
          loja_id: string
          pedido_id: string | null
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string
          custo?: number
          destinatario: string
          error_reason?: string | null
          id?: string
          loja_id: string
          pedido_id?: string | null
          status?: string
          tipo?: string
        }
        Update: {
          created_at?: string
          custo?: number
          destinatario?: string
          error_reason?: string | null
          id?: string
          loja_id?: string
          pedido_id?: string | null
          status?: string
          tipo?: string
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
      debit_blocks: {
        Row: {
          blocked_until: string | null
          created_at: string
          id: string
          reason: string
          resolved: boolean
          user_id: string
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string
          id?: string
          reason: string
          resolved?: boolean
          user_id: string
        }
        Update: {
          blocked_until?: string | null
          created_at?: string
          id?: string
          reason?: string
          resolved?: boolean
          user_id?: string
        }
        Relationships: []
      }
      empresas: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string
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
          razao_social: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj: string
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
          razao_social: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string
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
          razao_social?: string
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
          email_invalid: boolean
          empresa_id: string | null
          global_flow_lang: string | null
          id: string
          is_international: boolean
          loja_id: string | null
          marca: string | null
          moeda: string
          ncm_sh: string | null
          nfe_chave_acesso: string | null
          nfe_cobrado: boolean
          nfe_numero: string | null
          nfe_serie: string | null
          postagem_template_id: string | null
          produto: string
          proximo_avanco_em: string | null
          quantidade: number
          sem_cobranca: boolean
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
          email_invalid?: boolean
          empresa_id?: string | null
          global_flow_lang?: string | null
          id?: string
          is_international?: boolean
          loja_id?: string | null
          marca?: string | null
          moeda?: string
          ncm_sh?: string | null
          nfe_chave_acesso?: string | null
          nfe_cobrado?: boolean
          nfe_numero?: string | null
          nfe_serie?: string | null
          postagem_template_id?: string | null
          produto: string
          proximo_avanco_em?: string | null
          quantidade?: number
          sem_cobranca?: boolean
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
          email_invalid?: boolean
          empresa_id?: string | null
          global_flow_lang?: string | null
          id?: string
          is_international?: boolean
          loja_id?: string | null
          marca?: string | null
          moeda?: string
          ncm_sh?: string | null
          nfe_chave_acesso?: string | null
          nfe_cobrado?: boolean
          nfe_numero?: string | null
          nfe_serie?: string | null
          postagem_template_id?: string | null
          produto?: string
          proximo_avanco_em?: string | null
          quantidade?: number
          sem_cobranca?: boolean
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
      global_flow_config: {
        Row: {
          ativo: boolean
          confirm_email_template_en: Json | null
          confirm_email_template_es: Json | null
          confirmacao_email: boolean
          confirmacao_sms: boolean
          created_at: string
          enviar_email: boolean
          enviar_sms: boolean
          idioma: string
          loja_id: string
          pais_origem: string
          pais_origem_nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          confirm_email_template_en?: Json | null
          confirm_email_template_es?: Json | null
          confirmacao_email?: boolean
          confirmacao_sms?: boolean
          created_at?: string
          enviar_email?: boolean
          enviar_sms?: boolean
          idioma?: string
          loja_id: string
          pais_origem?: string
          pais_origem_nome?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          confirm_email_template_en?: Json | null
          confirm_email_template_es?: Json | null
          confirmacao_email?: boolean
          confirmacao_sms?: boolean
          created_at?: string
          enviar_email?: boolean
          enviar_sms?: boolean
          idioma?: string
          loja_id?: string
          pais_origem?: string
          pais_origem_nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_flow_config_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: true
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      global_flow_eventos: {
        Row: {
          ativo: boolean
          created_at: string
          delay_horas: number
          id: string
          loja_id: string
          nome_en: string
          nome_es: string
          nome_pt: string
          step_key: string
          step_order: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          delay_horas?: number
          id?: string
          loja_id: string
          nome_en: string
          nome_es: string
          nome_pt: string
          step_key: string
          step_order: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          delay_horas?: number
          id?: string
          loja_id?: string
          nome_en?: string
          nome_es?: string
          nome_pt?: string
          step_key?: string
          step_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_flow_eventos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      global_flow_system_templates: {
        Row: {
          body: string
          closing: string
          cta_label: string
          headline: string
          hint: string | null
          id: string
          intro: string
          lang: string
          preview: string
          sms_texto: string
          status_label: string
          step_key: string
          step_order: number
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          closing: string
          cta_label: string
          headline: string
          hint?: string | null
          id?: string
          intro: string
          lang: string
          preview: string
          sms_texto: string
          status_label: string
          step_key: string
          step_order: number
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          closing?: string
          cta_label?: string
          headline?: string
          hint?: string | null
          id?: string
          intro?: string
          lang?: string
          preview?: string
          sms_texto?: string
          status_label?: string
          step_key?: string
          step_order?: number
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          email: string | null
          endereco: string | null
          envio_id: string | null
          estado: string | null
          id: string
          loja_id: string | null
          metadata: Json | null
          nome: string | null
          numero: string | null
          origem: string | null
          produto: string | null
          telefone: string | null
          user_id: string | null
          valor: number | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          envio_id?: string | null
          estado?: string | null
          id?: string
          loja_id?: string | null
          metadata?: Json | null
          nome?: string | null
          numero?: string | null
          origem?: string | null
          produto?: string | null
          telefone?: string | null
          user_id?: string | null
          valor?: number | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          envio_id?: string | null
          estado?: string | null
          id?: string
          loja_id?: string | null
          metadata?: Json | null
          nome?: string | null
          numero?: string | null
          origem?: string | null
          produto?: string | null
          telefone?: string | null
          user_id?: string | null
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
      live_view_pings: {
        Row: {
          cidade: string | null
          codigo_rastreio: string | null
          created_at: string
          estado: string | null
          id: string
          last_seen_at: string
          lat: number | null
          lng: number | null
          loja_id: string
          pais: string | null
          pais_codigo: string | null
          session_id: string
          user_agent: string | null
        }
        Insert: {
          cidade?: string | null
          codigo_rastreio?: string | null
          created_at?: string
          estado?: string | null
          id?: string
          last_seen_at?: string
          lat?: number | null
          lng?: number | null
          loja_id: string
          pais?: string | null
          pais_codigo?: string | null
          session_id: string
          user_agent?: string | null
        }
        Update: {
          cidade?: string | null
          codigo_rastreio?: string | null
          created_at?: string
          estado?: string | null
          id?: string
          last_seen_at?: string
          lat?: number | null
          lng?: number | null
          loja_id?: string
          pais?: string | null
          pais_codigo?: string | null
          session_id?: string
          user_agent?: string | null
        }
        Relationships: []
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
        Relationships: []
      }
      postagem_config: {
        Row: {
          ativar_site_rastreio: boolean
          ativar_vizinho: boolean
          auto_envio: boolean
          cor_botao_cta: string | null
          cor_primaria: string | null
          created_at: string
          enviar_emails: boolean
          enviar_nfe_email: boolean
          id: string
          loja_id: string
          origem_cidade: string | null
          origem_estado: string | null
          template_ativo_id: string | null
          updated_at: string
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
          widget_rastreio_ativo: boolean
        }
        Insert: {
          ativar_site_rastreio?: boolean
          ativar_vizinho?: boolean
          auto_envio?: boolean
          cor_botao_cta?: string | null
          cor_primaria?: string | null
          created_at?: string
          enviar_emails?: boolean
          enviar_nfe_email?: boolean
          id?: string
          loja_id: string
          origem_cidade?: string | null
          origem_estado?: string | null
          template_ativo_id?: string | null
          updated_at?: string
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
          widget_rastreio_ativo?: boolean
        }
        Update: {
          ativar_site_rastreio?: boolean
          ativar_vizinho?: boolean
          auto_envio?: boolean
          cor_botao_cta?: string | null
          cor_primaria?: string | null
          created_at?: string
          enviar_emails?: boolean
          enviar_nfe_email?: boolean
          id?: string
          loja_id?: string
          origem_cidade?: string | null
          origem_estado?: string | null
          template_ativo_id?: string | null
          updated_at?: string
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
          widget_rastreio_ativo?: boolean
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
          custo: number | null
          destinatario: string
          envio_id: string | null
          error_message: string | null
          evento: string | null
          evento_id: string | null
          id: string
          loja_id: string | null
          resend_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assunto?: string | null
          created_at?: string
          custo?: number | null
          destinatario: string
          envio_id?: string | null
          error_message?: string | null
          evento?: string | null
          evento_id?: string | null
          id?: string
          loja_id?: string | null
          resend_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assunto?: string | null
          created_at?: string
          custo?: number | null
          destinatario?: string
          envio_id?: string | null
          error_message?: string | null
          evento?: string | null
          evento_id?: string | null
          id?: string
          loja_id?: string | null
          resend_id?: string | null
          status?: string
          updated_at?: string
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
          loja_id: string | null
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
          loja_id?: string | null
          nome?: string
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
          loja_id?: string | null
          nome?: string
          ordem?: number
          status_label?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "postagem_eventos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
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
          evento: string | null
          html: string
          id: string
          is_system: boolean
          loja_id: string | null
          nome: string
          subject: string
          tipo: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          evento?: string | null
          html?: string
          id?: string
          is_system?: boolean
          loja_id?: string | null
          nome: string
          subject?: string
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          evento?: string | null
          html?: string
          id?: string
          is_system?: boolean
          loja_id?: string | null
          nome?: string
          subject?: string
          tipo?: string | null
          updated_at?: string
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
          preco_envio_custom: number | null
          preco_recarga_custom: number | null
          referral_code: string | null
          referred_by: string | null
          whatsapp: string | null
          whatsapp_verified: boolean | null
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          custom_prices?: Json | null
          email?: string | null
          full_name?: string | null
          id: string
          preco_envio_custom?: number | null
          preco_recarga_custom?: number | null
          referral_code?: string | null
          referred_by?: string | null
          whatsapp?: string | null
          whatsapp_verified?: boolean | null
        }
        Update: {
          blocked?: boolean
          created_at?: string
          custom_prices?: Json | null
          email?: string | null
          full_name?: string | null
          id?: string
          preco_envio_custom?: number | null
          preco_recarga_custom?: number | null
          referral_code?: string | null
          referred_by?: string | null
          whatsapp?: string | null
          whatsapp_verified?: boolean | null
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
          user_id: string | null
        }
        Insert: {
          codigo_rastreio?: string | null
          created_at?: string
          endpoint: string
          id?: string
          keys_auth: string
          keys_p256dh: string
          user_id?: string | null
        }
        Update: {
          codigo_rastreio?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          keys_auth?: string
          keys_p256dh?: string
          user_id?: string | null
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
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          icon_url?: string | null
          id?: string
          mensagem?: string
          nome: string
          titulo?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          icon_url?: string | null
          id?: string
          mensagem?: string
          nome?: string
          titulo?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      recovery_config: {
        Row: {
          assunto_email: string
          ativo: boolean
          beneficio_1: string | null
          beneficio_2: string | null
          beneficio_3: string | null
          beneficio_principal: string | null
          codigo_cupom: string | null
          corpo_email: string
          created_at: string
          cupom_ativo: boolean
          delay_minutos: number
          descricao_cupom: string | null
          enviar_sms: boolean
          garantia: string | null
          id: string
          loja_id: string
          ps_reforco_urgencia: string | null
          sms_template: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          assunto_email?: string
          ativo?: boolean
          beneficio_1?: string | null
          beneficio_2?: string | null
          beneficio_3?: string | null
          beneficio_principal?: string | null
          codigo_cupom?: string | null
          corpo_email?: string
          created_at?: string
          cupom_ativo?: boolean
          delay_minutos?: number
          descricao_cupom?: string | null
          enviar_sms?: boolean
          garantia?: string | null
          id?: string
          loja_id: string
          ps_reforco_urgencia?: string | null
          sms_template?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          assunto_email?: string
          ativo?: boolean
          beneficio_1?: string | null
          beneficio_2?: string | null
          beneficio_3?: string | null
          beneficio_principal?: string | null
          codigo_cupom?: string | null
          corpo_email?: string
          created_at?: string
          cupom_ativo?: boolean
          delay_minutos?: number
          descricao_cupom?: string | null
          enviar_sms?: boolean
          garantia?: string | null
          id?: string
          loja_id?: string
          ps_reforco_urgencia?: string | null
          sms_template?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      recovery_leads: {
        Row: {
          checkout_url: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          email: string | null
          email_sent_at: string | null
          id: string
          loja_id: string
          metadata: Json | null
          nome: string | null
          pix_code: string | null
          pix_qrcode_url: string | null
          products: Json | null
          produto: string | null
          raw_payload: Json | null
          sms_sent_at: string | null
          status: string
          telefone: string | null
          tipo: string
          total_value: number | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          checkout_url?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          email?: string | null
          email_sent_at?: string | null
          id?: string
          loja_id: string
          metadata?: Json | null
          nome?: string | null
          pix_code?: string | null
          pix_qrcode_url?: string | null
          products?: Json | null
          produto?: string | null
          raw_payload?: Json | null
          sms_sent_at?: string | null
          status?: string
          telefone?: string | null
          tipo: string
          total_value?: number | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          checkout_url?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          email?: string | null
          email_sent_at?: string | null
          id?: string
          loja_id?: string
          metadata?: Json | null
          nome?: string | null
          pix_code?: string | null
          pix_qrcode_url?: string | null
          products?: Json | null
          produto?: string | null
          raw_payload?: Json | null
          sms_sent_at?: string | null
          status?: string
          telefone?: string | null
          tipo?: string
          total_value?: number | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: []
      }
      restore_runs: {
        Row: {
          details: Json | null
          error: string | null
          finished_at: string | null
          id: string
          mode: string
          source_folder: string | null
          started_at: string
          status: string
          tables_processed: number | null
          total_rows: number | null
        }
        Insert: {
          details?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          source_folder?: string | null
          started_at?: string
          status?: string
          tables_processed?: number | null
          total_rows?: number | null
        }
        Update: {
          details?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          source_folder?: string | null
          started_at?: string
          status?: string
          tables_processed?: number | null
          total_rows?: number | null
        }
        Relationships: []
      }
      retry_execucoes: {
        Row: {
          expires_at: string
          falhas: number
          finished_at: string | null
          id: string
          loja_id: string
          mensagem: string | null
          processados: number
          started_at: string
          status: string
          sucesso: number
          total_pendentes: number
          updated_at: string
        }
        Insert: {
          expires_at?: string
          falhas?: number
          finished_at?: string | null
          id?: string
          loja_id: string
          mensagem?: string | null
          processados?: number
          started_at?: string
          status?: string
          sucesso?: number
          total_pendentes?: number
          updated_at?: string
        }
        Update: {
          expires_at?: string
          falhas?: number
          finished_at?: string | null
          id?: string
          loja_id?: string
          mensagem?: string | null
          processados?: number
          started_at?: string
          status?: string
          sucesso?: number
          total_pendentes?: number
          updated_at?: string
        }
        Relationships: []
      }
      shopify_integrations: {
        Row: {
          access_token: string | null
          ativo: boolean
          created_at: string
          id: string
          loja_id: string
          shop_domain: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          access_token?: string | null
          ativo?: boolean
          created_at?: string
          id?: string
          loja_id: string
          shop_domain: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string | null
          ativo?: boolean
          created_at?: string
          id?: string
          loja_id?: string
          shop_domain?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_integrations_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_verifications: {
        Row: {
          approved_by: string | null
          code: string | null
          created_at: string
          email: string | null
          expires_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          status: string
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          approved_by?: string | null
          code?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          approved_by?: string | null
          code?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      sms_log: {
        Row: {
          created_at: string
          custo: number
          envio_id: string | null
          evento_id: string | null
          id: string
          loja_id: string
          motivo: string | null
          provider_response: Json | null
          status: string
          status_label: string | null
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          custo?: number
          envio_id?: string | null
          evento_id?: string | null
          id?: string
          loja_id: string
          motivo?: string | null
          provider_response?: Json | null
          status?: string
          status_label?: string | null
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          custo?: number
          envio_id?: string | null
          evento_id?: string | null
          id?: string
          loja_id?: string
          motivo?: string | null
          provider_response?: Json | null
          status?: string
          status_label?: string | null
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_log_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "envios"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          ativo: boolean
          created_at: string
          evento: string | null
          id: string
          mensagem: string
          nome: string
          status_key: string | null
          status_label: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          evento?: string | null
          id?: string
          mensagem: string
          nome: string
          status_key?: string | null
          status_label?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          evento?: string | null
          id?: string
          mensagem?: string
          nome?: string
          status_key?: string | null
          status_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_config: {
        Row: {
          key: string
          label: string | null
          text_value: string | null
          updated_at: string
          value: number
        }
        Insert: {
          key: string
          label?: string | null
          text_value?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
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
      whatsapp_instances: {
        Row: {
          ativo: boolean
          created_at: string
          expires_at: string | null
          id: string
          instance_name: string | null
          instance_token: string | null
          label: string | null
          loja_id: string | null
          numero: string | null
          pairing_code: string | null
          phone: string | null
          qr_code: string | null
          status: string
          subscription_id: string | null
          subscription_price: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          instance_name?: string | null
          instance_token?: string | null
          label?: string | null
          loja_id?: string | null
          numero?: string | null
          pairing_code?: string | null
          phone?: string | null
          qr_code?: string | null
          status?: string
          subscription_id?: string | null
          subscription_price?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          instance_name?: string | null
          instance_token?: string | null
          label?: string | null
          loja_id?: string | null
          numero?: string | null
          pairing_code?: string | null
          phone?: string | null
          qr_code?: string | null
          status?: string
          subscription_id?: string | null
          subscription_price?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_log: {
        Row: {
          created_at: string
          destinatario: string
          envio_id: string | null
          error_message: string | null
          error_reason: string | null
          evento: string | null
          id: string
          instance_id: string | null
          loja_id: string | null
          mensagem: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          destinatario: string
          envio_id?: string | null
          error_message?: string | null
          error_reason?: string | null
          evento?: string | null
          id?: string
          instance_id?: string | null
          loja_id?: string | null
          mensagem?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          destinatario?: string
          envio_id?: string | null
          error_message?: string | null
          error_reason?: string | null
          evento?: string | null
          id?: string
          instance_id?: string | null
          loja_id?: string | null
          mensagem?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
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
          created_at: string
          envio_id: string | null
          id: string
          loja_id: string
          payload: Json | null
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          envio_id?: string | null
          id?: string
          loja_id: string
          payload?: Json | null
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          envio_id?: string | null
          id?: string
          loja_id?: string
          payload?: Json | null
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          loja_id: string | null
          price_paid: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          loja_id?: string | null
          price_paid?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          loja_id?: string | null
          price_paid?: number | null
          user_id?: string | null
        }
        Relationships: []
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
      get_admin_debit_diagnostics: {
        Args: never
        Returns: {
          auto_envio: boolean
          custo_estimado: number
          envios_travados: number
          filtro_metodo: string
          loja_id: string
          loja_nome: string
          motivo: string
          pedidos_descartados: number
          saldo: number
          ultima_atividade: string
          user_email: string
          user_id: string
          user_nome: string
        }[]
      }
      get_admin_user_activity: {
        Args: never
        Returns: {
          envios_30d: number
          total_envios: number
          ultimo_deposito: string
          ultimo_envio: string
          user_id: string
        }[]
      }
      get_confirmacao_grouped: {
        Args: {
          p_date?: string
          p_limit?: number
          p_loja_id: string
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          created_at: string
          custo_total: number
          email: string
          email_status: string
          group_key: string
          nome: string
          pedido_id: string
          sms_status: string
          telefone: string
          total_count: number
        }[]
      }
      get_confirmacao_placar: {
        Args: { p_loja_id: string }
        Returns: {
          enviados: number
          pendentes: number
          total: number
        }[]
      }
      get_envios_paginated: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_loja_id: string
          p_metodo?: string
          p_origem?: string
          p_page?: number
          p_per_page?: number
          p_search?: string
          p_status?: string
        }
        Returns: Json[]
      }
      get_envios_stats: {
        Args: { p_loja_id: string }
        Returns: {
          em_transito: number
          entregues: number
          pendentes: number
          total: number
        }[]
      }
      get_loja_chart_data: {
        Args: { p_loja_id: string }
        Returns: {
          dia: string
          pedidos: number
          receita: number
        }[]
      }
      get_loja_chart_data_por_moeda: {
        Args: { p_loja_id: string }
        Returns: {
          dia: string
          moeda: string
          pedidos: number
          receita: number
        }[]
      }
      get_loja_faturamento: { Args: { p_loja_id: string }; Returns: number }
      get_loja_faturamento_por_moeda: {
        Args: { p_loja_id: string }
        Returns: {
          moeda: string
          total: number
        }[]
      }
      get_my_debit_blocks: {
        Args: { p_loja_id: string }
        Returns: {
          auto_envio: boolean
          custo_estimado: number
          envios_travados: number
          filtro_metodo: string
          motivo: string
          pedidos_descartados: number
          saldo: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      refund_user_credits: {
        Args: { _descricao: string; _quantidade: number; _user_id: string }
        Returns: boolean
      }
      seed_global_flow_eventos: {
        Args: { _loja_id: string }
        Returns: undefined
      }
      try_create_envio_dedupe: {
        Args: {
          _cliente_email: string
          _envio_data: Json
          _loja_id: string
          _valor: number
        }
        Returns: {
          envio_id: string
          was_duplicate: boolean
        }[]
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
