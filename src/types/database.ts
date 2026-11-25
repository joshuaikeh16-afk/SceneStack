// Generated from local migrations by npm run db:types. Do not edit by hand.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type Database = {
  public: {
    Tables: {
      account_deletions: {
        Row: {
          user_id: string;
          requested_at: string;
          recover_until: string;
          claimed_at: string | null;
        };
        Insert: {
          user_id: string;
          requested_at?: string;
          recover_until?: string;
          claimed_at?: string | null;
        };
        Update: {
          user_id?: string;
          requested_at?: string;
          recover_until?: string;
          claimed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "account_deletions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_alerts: {
        Row: {
          id: string;
          provider_id: string | null;
          title_id: string | null;
          code: string;
          message: string;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          provider_id?: string | null;
          title_id?: string | null;
          code: string;
          message: string;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          provider_id?: string | null;
          title_id?: string | null;
          code?: string;
          message?: string;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "admin_alerts_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "metadata_providers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_alerts_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_invitations: {
        Row: {
          id: string;
          invited_user_id: string;
          invited_by: string;
          status: string;
          reason: string;
          created_at: string;
          expires_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          invited_user_id: string;
          invited_by: string;
          status?: string;
          reason: string;
          created_at?: string;
          expires_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          invited_user_id?: string;
          invited_by?: string;
          status?: string;
          reason?: string;
          created_at?: string;
          expires_at?: string;
          responded_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "admin_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_invitations_invited_user_id_fkey";
            columns: ["invited_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_roles: {
        Row: {
          user_id: string;
          role: "super_admin" | "moderator" | "catalog_editor";
          granted_by: string | null;
          granted_at: string;
          suspended_at: string | null;
          suspension_reason: string | null;
        };
        Insert: {
          user_id: string;
          role: "super_admin" | "moderator" | "catalog_editor";
          granted_by?: string | null;
          granted_at?: string;
          suspended_at?: string | null;
          suspension_reason?: string | null;
        };
        Update: {
          user_id?: string;
          role?: "super_admin" | "moderator" | "catalog_editor";
          granted_by?: string | null;
          granted_at?: string;
          suspended_at?: string | null;
          suspension_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "admin_roles_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_user_notes: {
        Row: {
          id: string;
          user_id: string;
          actor_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          actor_id?: string | null;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          actor_id?: string | null;
          body?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_user_notes_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_user_notes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          detail: string;
          created_at: string;
          actor_role: string | null;
          reason: string;
          previous_state: Json | null;
          next_state: Json | null;
          outcome: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          detail?: string;
          created_at?: string;
          actor_role?: string | null;
          reason?: string;
          previous_state?: Json | null;
          next_state?: Json | null;
          outcome?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          detail?: string;
          created_at?: string;
          actor_role?: string | null;
          reason?: string;
          previous_state?: Json | null;
          next_state?: Json | null;
          outcome?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      blocks: {
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          blocker_id?: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          blocker_id?: string;
          blocked_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey";
            columns: ["blocked_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey";
            columns: ["blocker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_job_failures: {
        Row: {
          id: string;
          job_id: string;
          source: string;
          external_id: string;
          code: string;
          attempts: number;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          job_id: string;
          source: string;
          external_id: string;
          code: string;
          attempts?: number;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          job_id?: string;
          source?: string;
          external_id?: string;
          code?: string;
          attempts?: number;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_job_failures_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "catalog_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_job_progress: {
        Row: {
          job_id: string;
          source: string;
          external_id: string;
          outcome: string;
          title_id: string | null;
          created_at: string;
        };
        Insert: {
          job_id: string;
          source: string;
          external_id: string;
          outcome: string;
          title_id?: string | null;
          created_at?: string;
        };
        Update: {
          job_id?: string;
          source?: string;
          external_id?: string;
          outcome?: string;
          title_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_job_progress_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "catalog_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_job_progress_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_jobs: {
        Row: {
          id: string;
          provider_id: string;
          kind: string;
          state: string;
          query: Json;
          checkpoint: Json;
          processed: number;
          imported: number;
          updated: number;
          skipped: number;
          failed: number;
          estimated_total: number | null;
          attempts: number;
          max_attempts: number;
          lease_token: string | null;
          lease_expires_at: string | null;
          available_at: string;
          last_error: string | null;
          created_by: string | null;
          created_at: string;
          started_at: string | null;
          finished_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          kind: string;
          state?: string;
          query?: Json;
          checkpoint?: Json;
          processed?: number;
          imported?: number;
          updated?: number;
          skipped?: number;
          failed?: number;
          estimated_total?: number | null;
          attempts?: number;
          max_attempts?: number;
          lease_token?: string | null;
          lease_expires_at?: string | null;
          available_at?: string;
          last_error?: string | null;
          created_by?: string | null;
          created_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          kind?: string;
          state?: string;
          query?: Json;
          checkpoint?: Json;
          processed?: number;
          imported?: number;
          updated?: number;
          skipped?: number;
          failed?: number;
          estimated_total?: number | null;
          attempts?: number;
          max_attempts?: number;
          lease_token?: string | null;
          lease_expires_at?: string | null;
          available_at?: string;
          last_error?: string | null;
          created_by?: string | null;
          created_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_jobs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_jobs_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "metadata_providers";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_merge_requests: {
        Row: {
          id: string;
          source_id: string;
          target_id: string;
          requested_by: string;
          reason: string;
          status: "pending" | "approved" | "rejected";
          reviewer_id: string | null;
          reviewed_at: string | null;
          reviewer_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          target_id: string;
          requested_by: string;
          reason: string;
          status?: "pending" | "approved" | "rejected";
          reviewer_id?: string | null;
          reviewed_at?: string | null;
          reviewer_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_id?: string;
          target_id?: string;
          requested_by?: string;
          reason?: string;
          status?: "pending" | "approved" | "rejected";
          reviewer_id?: string | null;
          reviewed_at?: string | null;
          reviewer_notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_merge_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_merge_requests_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_merge_requests_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_merge_requests_target_id_fkey";
            columns: ["target_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_schedules: {
        Row: {
          id: string;
          provider_id: string;
          name: string;
          kind: string;
          query: Json;
          interval_minutes: number;
          enabled: boolean;
          next_run_at: string;
          last_job_id: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          name: string;
          kind: string;
          query?: Json;
          interval_minutes: number;
          enabled?: boolean;
          next_run_at?: string;
          last_job_id?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          name?: string;
          kind?: string;
          query?: Json;
          interval_minutes?: number;
          enabled?: boolean;
          next_run_at?: string;
          last_job_id?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_schedules_last_job_id_fkey";
            columns: ["last_job_id"];
            isOneToOne: false;
            referencedRelation: "catalog_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_schedules_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "metadata_providers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_schedules_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      collection_favorites: {
        Row: {
          id: string;
          user_id: string;
          collection_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          collection_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          collection_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collection_favorites_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_favorites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      collection_imports: {
        Row: {
          id: string;
          user_id: string;
          imported_collection_id: string;
          source_collection_id: string | null;
          source_owner_id: string | null;
          created_at: string;
          client_request_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          imported_collection_id: string;
          source_collection_id?: string | null;
          source_owner_id?: string | null;
          created_at?: string;
          client_request_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          imported_collection_id?: string;
          source_collection_id?: string | null;
          source_owner_id?: string | null;
          created_at?: string;
          client_request_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "collection_imports_imported_collection_id_fkey";
            columns: ["imported_collection_id"];
            isOneToOne: true;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_imports_source_collection_id_fkey";
            columns: ["source_collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_imports_source_owner_id_fkey";
            columns: ["source_owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_imports_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      collection_items: {
        Row: {
          id: string;
          collection_id: string;
          title_id: string;
          position: number;
          creator_note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          title_id: string;
          position: number;
          creator_note?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          collection_id?: string;
          title_id?: string;
          position?: number;
          creator_note?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_items_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      collection_saves: {
        Row: {
          id: string;
          user_id: string;
          collection_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          collection_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          collection_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collection_saves_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_saves_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      collections: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string;
          visibility: "private" | "published";
          spoiler_warning: boolean;
          cover_path: string | null;
          collage_reference: string | null;
          sort_by: string;
          sort_desc: boolean;
          removed_at: string | null;
          created_at: string;
          updated_at: string;
          client_request_id: string | null;
          version: number;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          title: string;
          description?: string;
          visibility?: "private" | "published";
          spoiler_warning?: boolean;
          cover_path?: string | null;
          collage_reference?: string | null;
          sort_by?: string;
          sort_desc?: boolean;
          removed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          client_request_id?: string | null;
          version?: number;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string;
          title?: string;
          description?: string;
          visibility?: "private" | "published";
          spoiler_warning?: boolean;
          cover_path?: string | null;
          collage_reference?: string | null;
          sort_by?: string;
          sort_desc?: boolean;
          removed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          client_request_id?: string | null;
          version?: number;
          published_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "collections_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      content_warnings: {
        Row: {
          id: string;
          label: string;
        };
        Insert: {
          id?: string;
          label: string;
        };
        Update: {
          id?: string;
          label?: string;
        };
        Relationships: [];
      };
      control_cases: {
        Row: {
          id: string;
          kind: string;
          owner_id: string | null;
          subject: string;
          description: string;
          status: string;
          priority: string;
          assigned_to: string | null;
          report_id: string | null;
          request_id: string | null;
          correction_id: string | null;
          enforcement_id: string | null;
          target_user_id: string | null;
          collection_id: string | null;
          title_id: string | null;
          grouped_into: string | null;
          payload: Json;
          resolution: string;
          due_at: string | null;
          satisfaction: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: string;
          owner_id?: string | null;
          subject: string;
          description?: string;
          status?: string;
          priority?: string;
          assigned_to?: string | null;
          report_id?: string | null;
          request_id?: string | null;
          correction_id?: string | null;
          enforcement_id?: string | null;
          target_user_id?: string | null;
          collection_id?: string | null;
          title_id?: string | null;
          grouped_into?: string | null;
          payload?: Json;
          resolution?: string;
          due_at?: string | null;
          satisfaction?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kind?: string;
          owner_id?: string | null;
          subject?: string;
          description?: string;
          status?: string;
          priority?: string;
          assigned_to?: string | null;
          report_id?: string | null;
          request_id?: string | null;
          correction_id?: string | null;
          enforcement_id?: string | null;
          target_user_id?: string | null;
          collection_id?: string | null;
          title_id?: string | null;
          grouped_into?: string | null;
          payload?: Json;
          resolution?: string;
          due_at?: string | null;
          satisfaction?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "control_cases_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "control_cases_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "control_cases_correction_id_fkey";
            columns: ["correction_id"];
            isOneToOne: true;
            referencedRelation: "metadata_corrections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "control_cases_enforcement_id_fkey";
            columns: ["enforcement_id"];
            isOneToOne: false;
            referencedRelation: "control_enforcements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "control_cases_grouped_into_fkey";
            columns: ["grouped_into"];
            isOneToOne: false;
            referencedRelation: "control_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "control_cases_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "control_cases_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: true;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "control_cases_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: true;
            referencedRelation: "missing_title_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "control_cases_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "control_cases_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      control_document_deliveries: {
        Row: {
          document_id: string;
          user_id: string;
          version: number | null;
          created_at: string;
        };
        Insert: {
          document_id: string;
          user_id: string;
          version?: number | null;
          created_at?: string;
        };
        Update: {
          document_id?: string;
          user_id?: string;
          version?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "control_document_deliveries_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "control_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "control_document_deliveries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      control_document_revisions: {
        Row: {
          id: string;
          document_id: string;
          version: number;
          snapshot: Json;
          actor_id: string | null;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          version: number;
          snapshot: Json;
          actor_id?: string | null;
          reason: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          version?: number;
          snapshot?: Json;
          actor_id?: string | null;
          reason?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "control_document_revisions_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "control_document_revisions_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "control_documents";
            referencedColumns: ["id"];
          },
        ];
      };
      control_documents: {
        Row: {
          id: string;
          kind: string;
          slug: string;
          title: string;
          category: string;
          body: string;
          content: Json;
          status: string;
          audience: string;
          starts_at: string | null;
          expires_at: string | null;
          version: number;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: string;
          slug: string;
          title: string;
          category?: string;
          body?: string;
          content?: Json;
          status?: string;
          audience?: string;
          starts_at?: string | null;
          expires_at?: string | null;
          version?: number;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kind?: string;
          slug?: string;
          title?: string;
          category?: string;
          body?: string;
          content?: Json;
          status?: string;
          audience?: string;
          starts_at?: string | null;
          expires_at?: string | null;
          version?: number;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "control_documents_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "control_documents_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      control_enforcements: {
        Row: {
          id: string;
          user_id: string;
          actor_id: string | null;
          kind: string;
          feature: string | null;
          reason: string;
          explanation: string;
          starts_at: string;
          expires_at: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          case_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          actor_id?: string | null;
          kind: string;
          feature?: string | null;
          reason: string;
          explanation: string;
          starts_at?: string;
          expires_at?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          case_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          actor_id?: string | null;
          kind?: string;
          feature?: string | null;
          reason?: string;
          explanation?: string;
          starts_at?: string;
          expires_at?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          case_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "control_enforcements_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "control_enforcements_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "control_enforcements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enforcement_case";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "control_cases";
            referencedColumns: ["id"];
          },
        ];
      };
      control_messages: {
        Row: {
          id: string;
          case_id: string;
          author_id: string | null;
          body: string;
          internal: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          author_id?: string | null;
          body: string;
          internal?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          author_id?: string | null;
          body?: string;
          internal?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "control_messages_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "control_messages_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "control_cases";
            referencedColumns: ["id"];
          },
        ];
      };
      control_notifications: {
        Row: {
          id: string;
          recipient_id: string;
          subject: string;
          body: string;
          href: string;
          event_key: string;
          essential: boolean;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          subject: string;
          body?: string;
          href: string;
          event_key: string;
          essential?: boolean;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          subject?: string;
          body?: string;
          href?: string;
          event_key?: string;
          essential?: boolean;
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "control_notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      correction_field_decisions: {
        Row: {
          case_id: string;
          field_name: string;
          approved: boolean;
          reason: string;
          decided_by: string | null;
          decided_at: string;
        };
        Insert: {
          case_id: string;
          field_name: string;
          approved: boolean;
          reason: string;
          decided_by?: string | null;
          decided_at?: string;
        };
        Update: {
          case_id?: string;
          field_name?: string;
          approved?: boolean;
          reason?: string;
          decided_by?: string | null;
          decided_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "correction_field_decisions_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "control_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "correction_field_decisions_decided_by_fkey";
            columns: ["decided_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      countries: {
        Row: {
          code: string;
          name: string;
        };
        Insert: {
          code: string;
          name: string;
        };
        Update: {
          code?: string;
          name?: string;
        };
        Relationships: [];
      };
      data_export_requests: {
        Row: {
          id: string;
          user_id: string;
          format: string;
          status: string;
          created_at: string;
          completed_at: string | null;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          format: string;
          status?: string;
          created_at?: string;
          completed_at?: string | null;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          format?: string;
          status?: string;
          created_at?: string;
          completed_at?: string | null;
          expires_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "data_export_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      document_dismissals: {
        Row: {
          document_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          document_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          document_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_dismissals_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "control_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_dismissals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      favorite_genres: {
        Row: {
          user_id: string;
          genre_id: string;
        };
        Insert: {
          user_id?: string;
          genre_id: string;
        };
        Update: {
          user_id?: string;
          genre_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorite_genres_genre_id_fkey";
            columns: ["genre_id"];
            isOneToOne: false;
            referencedRelation: "genres";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favorite_genres_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          title_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favorites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      follows: {
        Row: {
          id: string;
          follower_id: string;
          followed_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_id?: string;
          followed_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          follower_id?: string;
          followed_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "follows_followed_id_fkey";
            columns: ["followed_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      genres: {
        Row: {
          id: string;
          name: string;
        };
        Insert: {
          id?: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      languages: {
        Row: {
          code: string;
          name: string;
        };
        Insert: {
          code: string;
          name: string;
        };
        Update: {
          code?: string;
          name?: string;
        };
        Relationships: [];
      };
      metadata_corrections: {
        Row: {
          id: string;
          user_id: string;
          title_id: string;
          field_name: string;
          proposed_value: string;
          reason: string;
          status: "pending" | "approved" | "rejected";
          reviewer_id: string | null;
          reviewed_at: string | null;
          reviewer_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title_id: string;
          field_name: string;
          proposed_value: string;
          reason: string;
          status?: "pending" | "approved" | "rejected";
          reviewer_id?: string | null;
          reviewed_at?: string | null;
          reviewer_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title_id?: string;
          field_name?: string;
          proposed_value?: string;
          reason?: string;
          status?: "pending" | "approved" | "rejected";
          reviewer_id?: string | null;
          reviewed_at?: string | null;
          reviewer_notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "metadata_corrections_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metadata_corrections_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metadata_corrections_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      metadata_locks: {
        Row: {
          title_id: string;
          field_name: string;
          locked: boolean;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          title_id: string;
          field_name: string;
          locked?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          title_id?: string;
          field_name?: string;
          locked?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "metadata_locks_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metadata_locks_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      metadata_provenance: {
        Row: {
          id: string;
          title_id: string;
          provider_id: string | null;
          field_name: string;
          source_reference: string | null;
          retrieved_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          title_id: string;
          provider_id?: string | null;
          field_name: string;
          source_reference?: string | null;
          retrieved_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          title_id?: string;
          provider_id?: string | null;
          field_name?: string;
          source_reference?: string | null;
          retrieved_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "metadata_provenance_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "metadata_providers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metadata_provenance_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metadata_provenance_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      metadata_providers: {
        Row: {
          id: string;
          key: string;
          name: string;
          approved: boolean;
          enabled: boolean;
          attribution: string | null;
          terms_url: string | null;
          created_at: string;
          allow_offline_cache: boolean;
          bulk_approved: boolean;
        };
        Insert: {
          id?: string;
          key: string;
          name: string;
          approved?: boolean;
          enabled?: boolean;
          attribution?: string | null;
          terms_url?: string | null;
          created_at?: string;
          allow_offline_cache?: boolean;
          bulk_approved?: boolean;
        };
        Update: {
          id?: string;
          key?: string;
          name?: string;
          approved?: boolean;
          enabled?: boolean;
          attribution?: string | null;
          terms_url?: string | null;
          created_at?: string;
          allow_offline_cache?: boolean;
          bulk_approved?: boolean;
        };
        Relationships: [];
      };
      metadata_refresh_requests: {
        Row: {
          id: string;
          title_id: string;
          provider_id: string;
          requested_by: string | null;
          state: string;
          created_at: string;
          finished_at: string | null;
          claimed_at: string | null;
        };
        Insert: {
          id?: string;
          title_id: string;
          provider_id: string;
          requested_by?: string | null;
          state?: string;
          created_at?: string;
          finished_at?: string | null;
          claimed_at?: string | null;
        };
        Update: {
          id?: string;
          title_id?: string;
          provider_id?: string;
          requested_by?: string | null;
          state?: string;
          created_at?: string;
          finished_at?: string | null;
          claimed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "metadata_refresh_requests_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "metadata_providers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metadata_refresh_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metadata_refresh_requests_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      metadata_revisions: {
        Row: {
          id: string;
          title_id: string;
          actor_id: string | null;
          reason: string;
          previous_state: Json;
          next_state: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          title_id: string;
          actor_id?: string | null;
          reason: string;
          previous_state: Json;
          next_state: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          title_id?: string;
          actor_id?: string | null;
          reason?: string;
          previous_state?: Json;
          next_state?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "metadata_revisions_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metadata_revisions_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      missing_title_requests: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          kind:
            "anime" | "movie" | "series" | "cartoon" | "drama" | "documentary";
          details: string;
          status: "pending" | "approved" | "rejected";
          reviewer_id: string | null;
          reviewed_at: string | null;
          reviewer_notes: string | null;
          resolved_title_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          kind:
            "anime" | "movie" | "series" | "cartoon" | "drama" | "documentary";
          details?: string;
          status?: "pending" | "approved" | "rejected";
          reviewer_id?: string | null;
          reviewed_at?: string | null;
          reviewer_notes?: string | null;
          resolved_title_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          kind?:
            "anime" | "movie" | "series" | "cartoon" | "drama" | "documentary";
          details?: string;
          status?: "pending" | "approved" | "rejected";
          reviewer_id?: string | null;
          reviewed_at?: string | null;
          reviewer_notes?: string | null;
          resolved_title_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "missing_title_requests_resolved_title_id_fkey";
            columns: ["resolved_title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "missing_title_requests_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "missing_title_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      moderation_actions: {
        Row: {
          id: string;
          report_id: string | null;
          actor_id: string | null;
          target_user_id: string | null;
          collection_id: string | null;
          action:
            "dismissal" | "content_removal" | "warning" | "suspension" | "ban";
          reason: string;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id?: string | null;
          actor_id?: string | null;
          target_user_id?: string | null;
          collection_id?: string | null;
          action:
            "dismissal" | "content_removal" | "warning" | "suspension" | "ban";
          reason: string;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string | null;
          actor_id?: string | null;
          target_user_id?: string | null;
          collection_id?: string | null;
          action?:
            "dismissal" | "content_removal" | "warning" | "suspension" | "ban";
          reason?: string;
          expires_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "moderation_actions_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderation_actions_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderation_actions_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderation_actions_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          enabled: boolean;
          new_followers: boolean;
          collection_favorites: boolean;
          followed_collections: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          enabled?: boolean;
          new_followers?: boolean;
          collection_favorites?: boolean;
          followed_collections?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          enabled?: boolean;
          new_followers?: boolean;
          collection_favorites?: boolean;
          followed_collections?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          actor_id: string | null;
          kind: "new_follower" | "collection_favorite" | "collection_published";
          collection_id: string | null;
          dedupe_key: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          actor_id?: string | null;
          kind: "new_follower" | "collection_favorite" | "collection_published";
          collection_id?: string | null;
          dedupe_key: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          actor_id?: string | null;
          kind?:
            "new_follower" | "collection_favorite" | "collection_published";
          collection_id?: string | null;
          dedupe_key?: string;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      onboarding: {
        Row: {
          user_id: string;
          completed_at: string | null;
          created_at: string;
          step: number;
          draft_username: string | null;
          draft_display_name: string | null;
          draft_starter_titles: string[];
        };
        Insert: {
          user_id: string;
          completed_at?: string | null;
          created_at?: string;
          step?: number;
          draft_username?: string | null;
          draft_display_name?: string | null;
          draft_starter_titles?: string[];
        };
        Update: {
          user_id?: string;
          completed_at?: string | null;
          created_at?: string;
          step?: number;
          draft_username?: string | null;
          draft_display_name?: string | null;
          draft_starter_titles?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "onboarding_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      people: {
        Row: {
          id: string;
          name: string;
          provider_id: string | null;
          external_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          provider_id?: string | null;
          external_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          provider_id?: string | null;
          external_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "people_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "metadata_providers";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_daily_metrics: {
        Row: {
          day: string;
          registered_users: number;
          catalog_titles: number;
          published_collections: number;
          collection_favorites: number;
          collection_saves: number;
          collection_imports: number;
          captured_at: string;
        };
        Insert: {
          day: string;
          registered_users?: number;
          catalog_titles?: number;
          published_collections?: number;
          collection_favorites?: number;
          collection_saves?: number;
          collection_imports?: number;
          captured_at?: string;
        };
        Update: {
          day?: string;
          registered_users?: number;
          catalog_titles?: number;
          published_collections?: number;
          collection_favorites?: number;
          collection_saves?: number;
          collection_imports?: number;
          captured_at?: string;
        };
        Relationships: [];
      };
      platform_settings: {
        Row: {
          singleton: boolean;
          settings: Json;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          singleton?: boolean;
          settings?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          singleton?: boolean;
          settings?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      preferred_categories: {
        Row: {
          user_id: string;
          category:
            "anime" | "movie" | "series" | "cartoon" | "drama" | "documentary";
        };
        Insert: {
          user_id?: string;
          category:
            "anime" | "movie" | "series" | "cartoon" | "drama" | "documentary";
        };
        Update: {
          user_id?: string;
          category?:
            "anime" | "movie" | "series" | "cartoon" | "drama" | "documentary";
        };
        Relationships: [
          {
            foreignKeyName: "preferred_categories_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      preferred_languages: {
        Row: {
          user_id: string;
          language_code: string;
        };
        Insert: {
          user_id?: string;
          language_code: string;
        };
        Update: {
          user_id?: string;
          language_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "preferred_languages_language_code_fkey";
            columns: ["language_code"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "preferred_languages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      production_companies: {
        Row: {
          id: string;
          provider_id: string | null;
          external_id: string | null;
          name: string;
          country_code: string | null;
        };
        Insert: {
          id?: string;
          provider_id?: string | null;
          external_id?: string | null;
          name: string;
          country_code?: string | null;
        };
        Update: {
          id?: string;
          provider_id?: string | null;
          external_id?: string | null;
          name?: string;
          country_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "production_companies_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "production_companies_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "metadata_providers";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          username: string | null;
          display_name: string;
          avatar_path: string | null;
          bio: string;
          status:
            "active" | "suspended" | "banned" | "deletion_pending" | "purging";
          created_at: string;
          updated_at: string;
          cover_path: string | null;
          featured_collection_id: string | null;
          verified_at: string | null;
          verified_by: string | null;
          username_change_required: boolean;
        };
        Insert: {
          id: string;
          username?: string | null;
          display_name?: string;
          avatar_path?: string | null;
          bio?: string;
          status?:
            "active" | "suspended" | "banned" | "deletion_pending" | "purging";
          created_at?: string;
          updated_at?: string;
          cover_path?: string | null;
          featured_collection_id?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          username_change_required?: boolean;
        };
        Update: {
          id?: string;
          username?: string | null;
          display_name?: string;
          avatar_path?: string | null;
          bio?: string;
          status?:
            "active" | "suspended" | "banned" | "deletion_pending" | "purging";
          created_at?: string;
          updated_at?: string;
          cover_path?: string | null;
          featured_collection_id?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          username_change_required?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_featured_collection_id_fkey";
            columns: ["featured_collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_sync_state: {
        Row: {
          title_id: string;
          provider_id: string;
          last_success_at: string | null;
          next_attempt_at: string | null;
          attempts: number;
          state: string;
          last_error_code: string | null;
          last_error: string | null;
          updated_at: string;
        };
        Insert: {
          title_id: string;
          provider_id: string;
          last_success_at?: string | null;
          next_attempt_at?: string | null;
          attempts?: number;
          state?: string;
          last_error_code?: string | null;
          last_error?: string | null;
          updated_at?: string;
        };
        Update: {
          title_id?: string;
          provider_id?: string;
          last_success_at?: string | null;
          next_attempt_at?: string | null;
          attempts?: number;
          state?: string;
          last_error_code?: string | null;
          last_error?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_sync_state_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "metadata_providers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_sync_state_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_title_ids: {
        Row: {
          id: string;
          title_id: string;
          provider_id: string;
          external_id: string;
          external_type: string;
        };
        Insert: {
          id?: string;
          title_id: string;
          provider_id: string;
          external_id: string;
          external_type: string;
        };
        Update: {
          id?: string;
          title_id?: string;
          provider_id?: string;
          external_id?: string;
          external_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_title_ids_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "metadata_providers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_title_ids_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      rating_history: {
        Row: {
          id: string;
          user_id: string;
          rating_id: string | null;
          title_id: string;
          previous_score: number | null;
          next_score: number | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          rating_id?: string | null;
          title_id: string;
          previous_score?: number | null;
          next_score?: number | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          rating_id?: string | null;
          title_id?: string;
          previous_score?: number | null;
          next_score?: number | null;
          changed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rating_history_rating_id_fkey";
            columns: ["rating_id"];
            isOneToOne: false;
            referencedRelation: "ratings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rating_history_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rating_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ratings: {
        Row: {
          id: string;
          user_id: string;
          title_id: string;
          score: number;
          eligible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title_id: string;
          score: number;
          eligible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title_id?: string;
          score?: number;
          eligible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ratings_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ratings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      recent_searches: {
        Row: {
          user_id: string;
          query: string;
          searched_at: string;
        };
        Insert: {
          user_id?: string;
          query: string;
          searched_at?: string;
        };
        Update: {
          user_id?: string;
          query?: string;
          searched_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recent_searches_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      recent_titles: {
        Row: {
          user_id: string;
          title_id: string;
          viewed_at: string;
        };
        Insert: {
          user_id?: string;
          title_id: string;
          viewed_at?: string;
        };
        Update: {
          user_id?: string;
          title_id?: string;
          viewed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recent_titles_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recent_titles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      recommendation_preferences: {
        Row: {
          user_id: string;
          enabled: boolean;
          include_mature: boolean;
          diversify: boolean;
          updated_at: string;
          remember_searches: boolean;
          remember_viewed: boolean;
        };
        Insert: {
          user_id: string;
          enabled?: boolean;
          include_mature?: boolean;
          diversify?: boolean;
          updated_at?: string;
          remember_searches?: boolean;
          remember_viewed?: boolean;
        };
        Update: {
          user_id?: string;
          enabled?: boolean;
          include_mature?: boolean;
          diversify?: boolean;
          updated_at?: string;
          remember_searches?: boolean;
          remember_viewed?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "recommendation_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_user_id: string | null;
          collection_id: string | null;
          reason: string;
          details: string;
          status: "pending" | "approved" | "rejected";
          reviewer_id: string | null;
          reviewed_at: string | null;
          reviewer_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_user_id?: string | null;
          collection_id?: string | null;
          reason: string;
          details?: string;
          status?: "pending" | "approved" | "rejected";
          reviewer_id?: string | null;
          reviewed_at?: string | null;
          reviewer_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          target_user_id?: string | null;
          collection_id?: string | null;
          reason?: string;
          details?: string;
          status?: "pending" | "approved" | "rejected";
          reviewer_id?: string | null;
          reviewed_at?: string | null;
          reviewer_notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      search_daily_metrics: {
        Row: {
          day: string;
          query: string;
          category: string;
          searches: number;
          no_results: number;
        };
        Insert: {
          day: string;
          query: string;
          category?: string;
          searches?: number;
          no_results?: number;
        };
        Update: {
          day?: string;
          query?: string;
          category?: string;
          searches?: number;
          no_results?: number;
        };
        Relationships: [];
      };
      support_templates: {
        Row: {
          id: string;
          title: string;
          body: string;
          created_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body: string;
          created_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          body?: string;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      title_artwork: {
        Row: {
          id: string;
          title_id: string;
          provider_id: string | null;
          kind: string;
          url: string;
          attribution: string | null;
          language_code: string | null;
          width: number | null;
          height: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title_id: string;
          provider_id?: string | null;
          kind: string;
          url: string;
          attribution?: string | null;
          language_code?: string | null;
          width?: number | null;
          height?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title_id?: string;
          provider_id?: string | null;
          kind?: string;
          url?: string;
          attribution?: string | null;
          language_code?: string | null;
          width?: number | null;
          height?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "title_artwork_language_code_fkey";
            columns: ["language_code"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "title_artwork_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "metadata_providers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "title_artwork_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      title_companies: {
        Row: {
          title_id: string;
          company_id: string;
        };
        Insert: {
          title_id: string;
          company_id: string;
        };
        Update: {
          title_id?: string;
          company_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "title_companies_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "production_companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "title_companies_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      title_content_warnings: {
        Row: {
          title_id: string;
          warning_id: string;
        };
        Insert: {
          title_id: string;
          warning_id: string;
        };
        Update: {
          title_id?: string;
          warning_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "title_content_warnings_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "title_content_warnings_warning_id_fkey";
            columns: ["warning_id"];
            isOneToOne: false;
            referencedRelation: "content_warnings";
            referencedColumns: ["id"];
          },
        ];
      };
      title_countries: {
        Row: {
          title_id: string;
          country_code: string;
        };
        Insert: {
          title_id: string;
          country_code: string;
        };
        Update: {
          title_id?: string;
          country_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "title_countries_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "title_countries_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      title_credits: {
        Row: {
          id: string;
          title_id: string;
          person_id: string;
          department: string;
          role_name: string;
          billing_order: number;
        };
        Insert: {
          id?: string;
          title_id: string;
          person_id: string;
          department: string;
          role_name?: string;
          billing_order?: number;
        };
        Update: {
          id?: string;
          title_id?: string;
          person_id?: string;
          department?: string;
          role_name?: string;
          billing_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "title_credits_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "title_credits_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      title_feedback: {
        Row: {
          id: string;
          user_id: string;
          title_id: string;
          feedback: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title_id: string;
          feedback: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title_id?: string;
          feedback?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "title_feedback_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "title_feedback_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      title_genres: {
        Row: {
          title_id: string;
          genre_id: string;
        };
        Insert: {
          title_id: string;
          genre_id: string;
        };
        Update: {
          title_id?: string;
          genre_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "title_genres_genre_id_fkey";
            columns: ["genre_id"];
            isOneToOne: false;
            referencedRelation: "genres";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "title_genres_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      title_languages: {
        Row: {
          title_id: string;
          language_code: string;
        };
        Insert: {
          title_id: string;
          language_code: string;
        };
        Update: {
          title_id?: string;
          language_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "title_languages_language_code_fkey";
            columns: ["language_code"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "title_languages_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      title_names: {
        Row: {
          id: string;
          title_id: string;
          name: string;
          name_kind: string;
          language_code: string | null;
          search_document: string | null;
        };
        Insert: {
          id?: string;
          title_id: string;
          name: string;
          name_kind: string;
          language_code?: string | null;
        };
        Update: {
          id?: string;
          title_id?: string;
          name?: string;
          name_kind?: string;
          language_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "title_names_language_code_fkey";
            columns: ["language_code"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "title_names_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      title_redirects: {
        Row: {
          source_id: string;
          target_id: string;
          created_at: string;
        };
        Insert: {
          source_id: string;
          target_id: string;
          created_at?: string;
        };
        Update: {
          source_id?: string;
          target_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "title_redirects_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: true;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "title_redirects_target_id_fkey";
            columns: ["target_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      title_relations: {
        Row: {
          source_id: string;
          related_id: string;
          relation: string;
          verified: boolean;
        };
        Insert: {
          source_id: string;
          related_id: string;
          relation: string;
          verified?: boolean;
        };
        Update: {
          source_id?: string;
          related_id?: string;
          relation?: string;
          verified?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "title_relations_related_id_fkey";
            columns: ["related_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "title_relations_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      title_request_votes: {
        Row: {
          case_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          case_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          case_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "title_request_votes_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "control_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "title_request_votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      title_trailers: {
        Row: {
          id: string;
          title_id: string;
          provider_id: string | null;
          url: string;
          language_code: string | null;
          label: string | null;
        };
        Insert: {
          id?: string;
          title_id: string;
          provider_id?: string | null;
          url: string;
          language_code?: string | null;
          label?: string | null;
        };
        Update: {
          id?: string;
          title_id?: string;
          provider_id?: string | null;
          url?: string;
          language_code?: string | null;
          label?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "title_trailers_language_code_fkey";
            columns: ["language_code"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "title_trailers_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "metadata_providers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "title_trailers_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      titles: {
        Row: {
          id: string;
          display_title: string;
          original_title: string | null;
          kind:
            "anime" | "movie" | "series" | "cartoon" | "drama" | "documentary";
          edition: string;
          parent_title_id: string | null;
          season_number: number | null;
          release_year: number | null;
          description: string;
          status:
            | "announced"
            | "airing"
            | "released"
            | "ended"
            | "unavailable"
            | "merged";
          age_rating: string | null;
          search_document: string | null;
          created_at: string;
          updated_at: string;
          popularity: number | null;
          release_date: string | null;
          runtime_minutes: number | null;
        };
        Insert: {
          id?: string;
          display_title: string;
          original_title?: string | null;
          kind:
            "anime" | "movie" | "series" | "cartoon" | "drama" | "documentary";
          edition?: string;
          parent_title_id?: string | null;
          season_number?: number | null;
          release_year?: number | null;
          description?: string;
          status?:
            | "announced"
            | "airing"
            | "released"
            | "ended"
            | "unavailable"
            | "merged";
          age_rating?: string | null;
          created_at?: string;
          updated_at?: string;
          popularity?: number | null;
          release_date?: string | null;
          runtime_minutes?: number | null;
        };
        Update: {
          id?: string;
          display_title?: string;
          original_title?: string | null;
          kind?:
            "anime" | "movie" | "series" | "cartoon" | "drama" | "documentary";
          edition?: string;
          parent_title_id?: string | null;
          season_number?: number | null;
          release_year?: number | null;
          description?: string;
          status?:
            | "announced"
            | "airing"
            | "released"
            | "ended"
            | "unavailable"
            | "merged";
          age_rating?: string | null;
          created_at?: string;
          updated_at?: string;
          popularity?: number | null;
          release_date?: string | null;
          runtime_minutes?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "titles_parent_title_id_fkey";
            columns: ["parent_title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      tracking: {
        Row: {
          id: string;
          user_id: string;
          title_id: string;
          status: "planned" | "watching" | "completed" | "on_hold" | "dropped";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title_id: string;
          status: "planned" | "watching" | "completed" | "on_hold" | "dropped";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title_id?: string;
          status?: "planned" | "watching" | "completed" | "on_hold" | "dropped";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tracking_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tracking_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tracking_history: {
        Row: {
          id: string;
          user_id: string;
          tracking_id: string | null;
          title_id: string;
          previous_status:
            "planned" | "watching" | "completed" | "on_hold" | "dropped" | null;
          next_status:
            "planned" | "watching" | "completed" | "on_hold" | "dropped" | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tracking_id?: string | null;
          title_id: string;
          previous_status?:
            "planned" | "watching" | "completed" | "on_hold" | "dropped" | null;
          next_status?:
            "planned" | "watching" | "completed" | "on_hold" | "dropped" | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tracking_id?: string | null;
          title_id?: string;
          previous_status?:
            "planned" | "watching" | "completed" | "on_hold" | "dropped" | null;
          next_status?:
            "planned" | "watching" | "completed" | "on_hold" | "dropped" | null;
          changed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tracking_history_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tracking_history_tracking_id_fkey";
            columns: ["tracking_id"];
            isOneToOne: false;
            referencedRelation: "tracking";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tracking_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      add_collection_item: {
        Args: {
          p_collection: string | null;
          p_title: string | null;
          p_note?: string | null;
        };
        Returns: string;
      };
      add_titles_to_collections: {
        Args: { p_collections: string[] | null; p_titles: string[] | null };
        Returns: undefined;
      };
      admin_account_action: {
        Args: {
          p_user: string | null;
          p_action:
            | "dismissal"
            | "content_removal"
            | "warning"
            | "suspension"
            | "ban"
            | null;
          p_reason: string | null;
          p_until?: string | null;
        };
        Returns: undefined;
      };
      admin_profiles: {
        Args: {
          p_query?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: Json;
      };
      admin_summary: { Args: Record<PropertyKey, never>; Returns: Json };
      blocked_accounts: {
        Args: { p_limit?: number | null; p_offset?: number | null };
        Returns: Json;
      };
      bootstrap_platform_owner: {
        Args: { p_user: string | null };
        Returns: undefined;
      };
      browse_catalog: {
        Args: {
          p_query?: string | null;
          p_category?:
            | "anime"
            | "movie"
            | "series"
            | "cartoon"
            | "drama"
            | "documentary"
            | null;
          p_year?: number | null;
          p_genre?: string | null;
          p_language?: string | null;
          p_country?: string | null;
          p_min_rating?: number | null;
          p_sort?: string | null;
          p_status?:
            | "announced"
            | "airing"
            | "released"
            | "ended"
            | "unavailable"
            | "merged"
            | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: Database["public"]["Tables"]["titles"]["Row"][];
      };
      browse_title_requests: {
        Args: {
          p_query?: string | null;
          p_status?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: Json;
      };
      bulk_title_actions: {
        Args: {
          p_titles: string[] | null;
          p_action: string | null;
          p_status?:
            "planned" | "watching" | "completed" | "on_hold" | "dropped" | null;
        };
        Returns: Json;
      };
      capture_platform_metrics: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      catalog_edit_title: {
        Args: {
          p_id: string | null;
          p_name: string | null;
          p_kind:
            | "anime"
            | "movie"
            | "series"
            | "cartoon"
            | "drama"
            | "documentary"
            | null;
          p_description?: string | null;
          p_year?: number | null;
          p_original?: string | null;
          p_age?: string | null;
        };
        Returns: string;
      };
      catalog_freshness: { Args: { p_ids: string[] | null }; Returns: Json };
      catalog_title_extras: { Args: { p_title: string | null }; Returns: Json };
      change_personal_title: {
        Args: {
          p_title: string | null;
          p_action: string | null;
          p_status?:
            "planned" | "watching" | "completed" | "on_hold" | "dropped" | null;
          p_rating?: number | null;
          p_enabled?: boolean | null;
          p_feedback?: string | null;
        };
        Returns: undefined;
      };
      change_required_username: {
        Args: { p_username: string | null };
        Returns: undefined;
      };
      claim_account_purge: {
        Args: { p_user: string | null };
        Returns: boolean;
      };
      claim_catalog_job: { Args: { p_provider: string | null }; Returns: Json };
      claim_provider_refreshes: {
        Args: { p_provider: string | null; p_limit?: number | null };
        Returns: Database["public"]["Tables"]["metadata_refresh_requests"]["Row"][];
      };
      collection_card_data: { Args: { p_ids: string[] | null }; Returns: Json };
      collection_items_page: {
        Args: {
          p_collection: string | null;
          p_query?: string | null;
          p_category?:
            | "anime"
            | "movie"
            | "series"
            | "cartoon"
            | "drama"
            | "documentary"
            | null;
          p_sort?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: Database["public"]["Tables"]["collection_items"]["Row"][];
      };
      collection_memberships: {
        Args: { p_collections: string[] | null; p_titles: string[] | null };
        Returns: Json;
      };
      collection_metrics: {
        Args: { p_collection: string | null };
        Returns: Json;
      };
      community_rating: { Args: { p_title: string | null }; Returns: Json };
      complete_onboarding: {
        Args: {
          p_username: string | null;
          p_display_name: string | null;
          p_categories?:
            | (
                | "anime"
                | "movie"
                | "series"
                | "cartoon"
                | "drama"
                | "documentary"
              )[]
            | null;
          p_genres?: string[] | null;
          p_starter_titles?: string[] | null;
        };
        Returns: undefined;
      };
      control_account_access: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      control_add_user_note: {
        Args: { p_user: string | null; p_body: string | null };
        Returns: string;
      };
      control_bulk_category: {
        Args: {
          p_ids: string[] | null;
          p_category:
            | "anime"
            | "movie"
            | "series"
            | "cartoon"
            | "drama"
            | "documentary"
            | null;
          p_reason: string | null;
        };
        Returns: undefined;
      };
      control_catalog_job: {
        Args: {
          p_id: string | null;
          p_action: string | null;
          p_provider?: string | null;
          p_kind?: string | null;
          p_query?: Json | null;
          p_reason?: string | null;
        };
        Returns: string;
      };
      control_collection_visibility: {
        Args: {
          p_id: string | null;
          p_hidden: boolean | null;
          p_reason: string | null;
        };
        Returns: undefined;
      };
      control_edit_title: {
        Args: {
          p_id: string | null;
          p_patch: Json | null;
          p_locks: Json | null;
          p_reason: string | null;
        };
        Returns: string;
      };
      control_identity: { Args: Record<PropertyKey, never>; Returns: Json };
      control_import_audit: {
        Args: { p_title: string | null; p_source: string | null };
        Returns: undefined;
      };
      control_member_export: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      control_merge_titles: {
        Args: {
          p_source: string | null;
          p_target: string | null;
          p_reason: string | null;
        };
        Returns: undefined;
      };
      control_profile_action: {
        Args: {
          p_user: string | null;
          p_action: string | null;
          p_value: string | null;
          p_reason: string | null;
        };
        Returns: undefined;
      };
      control_provider_switch: {
        Args: {
          p_id: string | null;
          p_enabled: boolean | null;
          p_reason: string | null;
        };
        Returns: undefined;
      };
      control_request_deletion: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      control_restore_account: {
        Args: { p_user: string | null; p_reason: string | null };
        Returns: undefined;
      };
      control_rollback_document: {
        Args: { p_revision: string | null; p_reason: string | null };
        Returns: string;
      };
      control_rollback_title: {
        Args: { p_revision: string | null; p_reason: string | null };
        Returns: string;
      };
      control_save_document: {
        Args: {
          p_id: string | null;
          p_kind: string | null;
          p_values: Json | null;
          p_version: number | null;
          p_reason: string | null;
        };
        Returns: string;
      };
      control_save_schedule: {
        Args: {
          p_id: string | null;
          p_provider: string | null;
          p_name: string | null;
          p_kind: string | null;
          p_query: Json | null;
          p_interval: number | null;
          p_enabled: boolean | null;
          p_reason: string | null;
        };
        Returns: string;
      };
      control_save_settings: {
        Args: { p_settings: Json | null; p_reason: string | null };
        Returns: undefined;
      };
      control_search: { Args: { p_query: string | null }; Returns: Json };
      control_search_accounts: {
        Args: { p_query: string | null };
        Returns: Json;
      };
      control_split_title: {
        Args: { p_source: string | null; p_reason: string | null };
        Returns: undefined;
      };
      control_support_template: {
        Args: {
          p_id: string | null;
          p_title: string | null;
          p_body: string | null;
          p_remove?: boolean | null;
        };
        Returns: string;
      };
      control_user_detail: { Args: { p_id: string | null }; Returns: Json };
      control_workspace: {
        Args: {
          p_section: string | null;
          p_query?: string | null;
          p_status?: string | null;
          p_page?: number | null;
          p_from?: string | null;
          p_to?: string | null;
          p_assignment?: string | null;
        };
        Returns: Json;
      };
      create_collection_with_titles: {
        Args: {
          p_request: string | null;
          p_title: string | null;
          p_description?: string | null;
          p_visibility?: "private" | "published" | null;
          p_spoiler?: boolean | null;
          p_titles?: string[] | null;
        };
        Returns: string;
      };
      decide_correction_fields: {
        Args: {
          p_id: string | null;
          p_decisions: Json | null;
          p_reason: string | null;
        };
        Returns: undefined;
      };
      deliver_control_announcements: {
        Args: { p_limit?: number | null };
        Returns: number;
      };
      dismiss_control_document: {
        Args: { p_id: string | null };
        Returns: undefined;
      };
      edit_collection_item_version: {
        Args: {
          p_collection: string | null;
          p_item: string | null;
          p_version: number | null;
          p_note?: string | null;
          p_remove?: boolean | null;
        };
        Returns: undefined;
      };
      enforce_control_account: {
        Args: {
          p_user: string | null;
          p_kind: string | null;
          p_reason: string | null;
          p_explanation: string | null;
          p_feature?: string | null;
          p_until?: string | null;
          p_case?: string | null;
        };
        Returns: string;
      };
      enqueue_due_catalog_jobs: {
        Args: { p_providers?: string[] | null };
        Returns: number;
      };
      expire_discovery_history: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      export_personal_data: { Args: Record<PropertyKey, never>; Returns: Json };
      finish_catalog_batch: {
        Args: {
          p_id: string | null;
          p_lease: string | null;
          p_checkpoint: Json | null;
          p_counts: Json | null;
          p_done?: boolean | null;
          p_error?: string | null;
        };
        Returns: undefined;
      };
      follow_counts: { Args: { p_user: string | null }; Returns: Json };
      followed_collection_feed: {
        Args: { p_limit?: number | null; p_offset?: number | null };
        Returns: Database["public"]["Tables"]["collections"]["Row"][];
      };
      import_collection: {
        Args: { p_source: string | null; p_title?: string | null };
        Returns: string;
      };
      import_collection_once: {
        Args: { p_source: string | null; p_request: string | null };
        Returns: string;
      };
      included_collection_titles: {
        Args: { p_collection: string | null; p_titles: string[] | null };
        Returns: Json;
      };
      ingest_catalog_job_title: {
        Args: {
          p_job: string | null;
          p_lease: string | null;
          p_source: string | null;
          p_payload: Json | null;
          p_full?: boolean | null;
        };
        Returns: Json;
      };
      ingest_mal_title: {
        Args: { p_provider: string | null; p_payload: Json | null };
        Returns: string;
      };
      ingest_tmdb_title: {
        Args: { p_provider: string | null; p_payload: Json | null };
        Returns: string;
      };
      invite_moderator: {
        Args: { p_user: string | null; p_reason: string | null };
        Returns: string;
      };
      library_collections: {
        Args: {
          p_section?: string | null;
          p_query?: string | null;
          p_sort?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: Database["public"]["Tables"]["collections"]["Row"][];
      };
      library_titles: {
        Args: {
          p_section?: string | null;
          p_status?:
            "planned" | "watching" | "completed" | "on_hold" | "dropped" | null;
          p_query?: string | null;
          p_sort?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: Database["public"]["Tables"]["titles"]["Row"][];
      };
      manage_admin_role: {
        Args: {
          p_actor: string | null;
          p_user: string | null;
          p_role: "super_admin" | "moderator" | "catalog_editor" | null;
          p_grant: boolean | null;
        };
        Returns: undefined;
      };
      manage_moderator: {
        Args: {
          p_user: string | null;
          p_action: string | null;
          p_reason: string | null;
        };
        Returns: undefined;
      };
      mark_all_notifications_read: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      mark_control_notifications: {
        Args: { p_id?: string | null };
        Returns: undefined;
      };
      member_case_action: {
        Args: {
          p_id: string | null;
          p_action: string | null;
          p_rating?: number | null;
        };
        Returns: undefined;
      };
      moderate_report: {
        Args: {
          p_report: string | null;
          p_action:
            | "dismissal"
            | "content_removal"
            | "warning"
            | "suspension"
            | "ban"
            | null;
          p_reason: string | null;
          p_until?: string | null;
        };
        Returns: undefined;
      };
      move_collection_item: {
        Args: {
          p_collection: string | null;
          p_item: string | null;
          p_before?: string | null;
          p_direction?: number | null;
        };
        Returns: undefined;
      };
      move_collection_item_version: {
        Args: {
          p_collection: string | null;
          p_item: string | null;
          p_version: number | null;
          p_before?: string | null;
          p_direction?: number | null;
        };
        Returns: undefined;
      };
      my_library_counts: { Args: Record<PropertyKey, never>; Returns: Json };
      personal_title_states: {
        Args: { p_ids: string[] | null };
        Returns: Json;
      };
      propose_catalog_merge: {
        Args: {
          p_source: string | null;
          p_target: string | null;
          p_reason: string | null;
        };
        Returns: string;
      };
      public_title_cache_allowed: {
        Args: { p_title: string | null };
        Returns: boolean;
      };
      recommend_title_ids: { Args: { p_limit?: number | null }; Returns: Json };
      record_catalog_job_failure: {
        Args: {
          p_job: string | null;
          p_lease: string | null;
          p_source: string | null;
          p_external: string | null;
          p_code: string | null;
        };
        Returns: undefined;
      };
      record_catalog_search: {
        Args: {
          p_query: string | null;
          p_category: string | null;
          p_empty: boolean | null;
        };
        Returns: undefined;
      };
      record_control_failure: {
        Args: {
          p_actor: string | null;
          p_operation: string | null;
          p_code: string | null;
        };
        Returns: undefined;
      };
      record_platform_activity: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      record_provider_sync: {
        Args: {
          p_title: string | null;
          p_provider: string | null;
          p_success: boolean | null;
          p_error_code?: string | null;
        };
        Returns: undefined;
      };
      recover_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      release_expired_suspensions: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      remember_discovery: {
        Args: { p_kind: string | null; p_value: string | null };
        Returns: undefined;
      };
      reorder_collection_items: {
        Args: { p_collection: string | null; p_item_ids: string[] | null };
        Returns: undefined;
      };
      reply_control_case: {
        Args: {
          p_id: string | null;
          p_body: string | null;
          p_internal?: boolean | null;
        };
        Returns: string;
      };
      request_account_deletion: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      request_data_export: {
        Args: { p_format: string | null };
        Returns: string;
      };
      request_metadata_refresh: {
        Args: { p_title: string | null; p_provider: string | null };
        Returns: string;
      };
      reserve_provider_budget: {
        Args: { p_provider: string | null; p_units?: number | null };
        Returns: undefined;
      };
      resolve_control_appeal: {
        Args: {
          p_id: string | null;
          p_decision: string | null;
          p_reason: string | null;
          p_until?: string | null;
        };
        Returns: undefined;
      };
      resolve_title: { Args: { p_title: string | null }; Returns: string };
      respond_moderator_invitation: {
        Args: { p_id: string | null; p_accept: boolean | null };
        Returns: undefined;
      };
      retry_catalog_failures: {
        Args: { p_id: string | null; p_reason: string | null };
        Returns: string;
      };
      review_catalog_submission: {
        Args: {
          p_kind: string | null;
          p_id: string | null;
          p_approve: boolean | null;
          p_notes?: string | null;
          p_resolved_title?: string | null;
        };
        Returns: undefined;
      };
      review_control_case: {
        Args: {
          p_id: string | null;
          p_status: string | null;
          p_resolution: string | null;
          p_priority?: string | null;
          p_assignee?: string | null;
          p_group?: string | null;
          p_title?: string | null;
        };
        Returns: undefined;
      };
      save_collection_order: {
        Args: {
          p_collection: string | null;
          p_version: number | null;
          p_sort: string | null;
          p_desc: boolean | null;
        };
        Returns: undefined;
      };
      save_onboarding_progress: {
        Args: {
          p_step: number | null;
          p_username?: string | null;
          p_display_name?: string | null;
        };
        Returns: undefined;
      };
      save_onboarding_starters: {
        Args: { p_titles: string[] | null };
        Returns: undefined;
      };
      search_catalog: {
        Args: {
          p_query?: string | null;
          p_category?:
            | "anime"
            | "movie"
            | "series"
            | "cartoon"
            | "drama"
            | "documentary"
            | null;
          p_year?: number | null;
          p_genre?: string | null;
          p_language?: string | null;
          p_country?: string | null;
          p_min_rating?: number | null;
          p_sort?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: Database["public"]["Tables"]["titles"]["Row"][];
      };
      search_creators: {
        Args: {
          p_query?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: Json;
      };
      set_collection_interaction: {
        Args: {
          p_collection: string | null;
          p_kind: string | null;
          p_enabled: boolean | null;
        };
        Returns: undefined;
      };
      set_discovery_preferences: {
        Args: {
          p_categories?:
            | (
                | "anime"
                | "movie"
                | "series"
                | "cartoon"
                | "drama"
                | "documentary"
              )[]
            | null;
          p_genres?: string[] | null;
          p_languages?: string[] | null;
        };
        Returns: undefined;
      };
      set_favorite: {
        Args: { p_title: string | null; p_enabled: boolean | null };
        Returns: undefined;
      };
      set_follow: {
        Args: { p_user: string | null; p_enabled: boolean | null };
        Returns: undefined;
      };
      set_rating: {
        Args: { p_title: string | null; p_score: number | null };
        Returns: string;
      };
      set_title_feedback: {
        Args: { p_title: string | null; p_feedback: string | null };
        Returns: undefined;
      };
      set_tracking: {
        Args: {
          p_title: string | null;
          p_status:
            "planned" | "watching" | "completed" | "on_hold" | "dropped" | null;
        };
        Returns: string;
      };
      sort_collection_items: {
        Args: {
          p_collection: string | null;
          p_sort: string | null;
          p_desc?: boolean | null;
        };
        Returns: undefined;
      };
      submit_control_case: {
        Args: {
          p_kind: string | null;
          p_subject: string | null;
          p_body: string | null;
          p_target?: string | null;
          p_collection?: string | null;
          p_title?: string | null;
          p_payload?: Json | null;
        };
        Returns: string;
      };
      submit_missing_title: {
        Args: {
          p_title: string | null;
          p_kind:
            | "anime"
            | "movie"
            | "series"
            | "cartoon"
            | "drama"
            | "documentary"
            | null;
          p_details?: string | null;
        };
        Returns: string;
      };
      submit_report: {
        Args: {
          p_user: string | null;
          p_collection: string | null;
          p_reason: string | null;
          p_details?: string | null;
        };
        Returns: string;
      };
      suggest_correction: {
        Args: {
          p_title: string | null;
          p_field: string | null;
          p_value: string | null;
          p_reason: string | null;
        };
        Returns: string;
      };
      title_card_data: { Args: { p_ids: string[] | null }; Returns: Json };
      transfer_platform_owner: {
        Args: { p_actor: string | null; p_next: string | null };
        Returns: undefined;
      };
      update_collection_version: {
        Args: {
          p_id: string | null;
          p_version: number | null;
          p_patch: Json | null;
        };
        Returns: Json;
      };
      update_control_enforcement: {
        Args: {
          p_id: string | null;
          p_revoke: boolean | null;
          p_until: string | null;
          p_reason: string | null;
        };
        Returns: undefined;
      };
      username_available: {
        Args: { p_username: string | null };
        Returns: boolean;
      };
      verify_title_relationship: {
        Args: {
          p_source: string | null;
          p_related: string | null;
          p_relation: string | null;
        };
        Returns: undefined;
      };
      vote_title_request: {
        Args: { p_id: string | null; p_enabled: boolean | null };
        Returns: undefined;
      };
    };
    Enums: {
      account_status:
        "active" | "suspended" | "banned" | "deletion_pending" | "purging";
      admin_role: "super_admin" | "moderator" | "catalog_editor";
      catalog_status:
        | "announced"
        | "airing"
        | "released"
        | "ended"
        | "unavailable"
        | "merged";
      collection_visibility: "private" | "published";
      entertainment_kind:
        "anime" | "movie" | "series" | "cartoon" | "drama" | "documentary";
      moderation_kind:
        "dismissal" | "content_removal" | "warning" | "suspension" | "ban";
      notification_kind:
        "new_follower" | "collection_favorite" | "collection_published";
      review_status: "pending" | "approved" | "rejected";
      tracking_status:
        "planned" | "watching" | "completed" | "on_hold" | "dropped";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
export type TableName = keyof Database["public"]["Tables"];
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
