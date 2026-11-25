export type ControlRow = Record<string, unknown>;
export type ControlWorkspace = {
  rows: ControlRow[];
  total: number;
  page: number;
  hasMore: boolean;
  metrics: ControlRow;
  series: ControlRow;
  checkedAt: string;
};
export type ControlCase = {
  id: string;
  kind: string;
  owner_id: string | null;
  subject: string;
  description: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  resolution: string;
  title_id: string | null;
  enforcement_id: string | null;
  target_user_id: string | null;
  collection_id: string | null;
  payload: ControlRow;
  created_at: string;
  updated_at: string;
};
export type ControlMessage = {
  id: string;
  author_id: string | null;
  body: string;
  internal: boolean;
  created_at: string;
};
export type CaseDetail = {
  item: ControlCase;
  messages: ControlMessage[];
  hasMoreMessages: boolean;
  decisions: ControlRow[];
  title: ControlRow | null;
  enforcement: ControlRow | null;
};
