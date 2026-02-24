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
          nome_fantasia?: string | null
          numero?: string | null
          razao_social?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
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
          empresa_id: string | null
          id: string
          ncm_sh: string | null
          nfe_chave_acesso: string | null
          nfe_numero: string | null
          nfe_serie: string | null
          produto: string
          quantidade: number
          status: Database["public"]["Enums"]["shipment_status"]
          transportadora: string | null
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
          empresa_id?: string | null
          id?: string
          ncm_sh?: string | null
          nfe_chave_acesso?: string | null
          nfe_numero?: string | null
          nfe_serie?: string | null
          produto: string
          quantidade?: number
          status?: Database["public"]["Enums"]["shipment_status"]
          transportadora?: string | null
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
          empresa_id?: string | null
          id?: string
          ncm_sh?: string | null
          nfe_chave_acesso?: string | null
          nfe_numero?: string | null
          nfe_serie?: string | null
          produto?: string
          quantidade?: number
          status?: Database["public"]["Enums"]["shipment_status"]
          transportadora?: string | null
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
        ]
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
        ]
      }
      webhook_logs: {
        Row: {
          checkout_provider: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
          status: string | null
        }
        Insert: {
          checkout_provider: string
          created_at?: string
          event_type: string
          id?: string
          payload: Json
          processed?: boolean
          status?: string | null
        }
        Update: {
          checkout_provider?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      shipment_status:
        | "pendente"
        | "em_transito"
        | "saiu_para_entrega"
        | "entregue"
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
      shipment_status: [
        "pendente",
        "em_transito",
        "saiu_para_entrega",
        "entregue",
      ],
    },
  },
} as const
