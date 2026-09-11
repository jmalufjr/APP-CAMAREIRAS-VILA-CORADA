export type UserRole = "admin" | "camareira" | "manutencao";
export type ChecklistType = "arrumacao" | "preparacao" | "troca";
export type TaskStatus = "pendente" | "em_andamento" | "concluido";
export type TableShape = "round" | "rect";
export type OccurrenceStatus = "pendente" | "selecionada" | "resolvida";
export type MaintenanceExecutionType = "nao_tecnico" | "tecnico";
export type MaintenanceItemStatus = "pendente" | "selecionada";
export type RoomBillStatus = "aberta" | "fechada" | "reaberta" | "paga";

export interface Profile {
  id: string;
  role: UserRole;
  name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  created_at: string;
}

export interface Room {
  id: string;
  number: string;
  name: string | null;
  active: boolean;
  position: number;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  type: ChecklistType;
  label: string;
  description: string | null;
  position: number;
  active: boolean;
  created_at: string;
}

export interface RoomChecklistItem {
  room_id: string;
  checklist_item_id: string;
  position: number;
}

export interface OccurrenceCategory {
  id: string;
  name: string;
  active: boolean;
  position: number;
  created_at: string;
}

export interface BreakfastTable {
  id: string;
  label: string;
  shape: TableShape;
  seats: number;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  active: boolean;
  created_at: string;
}

export interface CommissionSettings {
  id: number;
  value_per_table: number;
  updated_at: string;
}

export interface DailyRoomTask {
  id: string;
  date: string;
  room_id: string;
  task_type: ChecklistType;
  assigned_to: string | null;
  status: TaskStatus;
  started_at: string | null;
  finished_at: string | null;
  released_at: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export interface DailyRoomTaskCheck {
  id: string;
  daily_room_task_id: string;
  checklist_item_id: string;
  checked: boolean;
  checked_at: string | null;
}

export interface DailyRoomTaskOccurrence {
  id: string;
  daily_room_task_id: string;
  occurrence_category_id: string;
  description: string | null;
  status: OccurrenceStatus;
  selected_by: string | null;
  selected_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface DailyBreakfast {
  id: string;
  date: string;
  table_id: string;
  guest_count: number;
  notes: string | null;
  value_per_table_snapshot: number;
  created_at: string;
}

export interface DailyArrival {
  id: string;
  date: string;
  room_id: string;
  guest_name: string;
  expected_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyDeparture {
  id: string;
  date: string;
  room_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceCategory {
  id: string;
  name: string;
  active: boolean;
  position: number;
  start_date: string | null;
  created_at: string;
}

export interface MaintenanceItem {
  id: string;
  category_id: string;
  label: string;
  description: string | null;
  execution_type: MaintenanceExecutionType;
  periodicity_days: number;
  next_due_date: string;
  status: MaintenanceItemStatus;
  selected_by: string | null;
  selected_at: string | null;
  active: boolean;
  position: number;
  follows_category_start_date: boolean;
  start_date: string | null;
  created_at: string;
}

export interface MaintenanceCompletion {
  id: string;
  item_id: string;
  due_date: string;
  completed_by: string | null;
  completed_at: string;
  external_technician_name: string | null;
  created_at: string;
}

export interface MinibarItem {
  id: string;
  name: string;
  price: number;
  active: boolean;
  position: number;
  created_at: string;
}

export interface PoolbarItem {
  id: string;
  category: string | null;
  name: string;
  price: number;
  active: boolean;
  position: number;
  created_at: string;
}

export interface RoomBill {
  id: string;
  room_id: string;
  status: RoomBillStatus;
  opened_at: string;
  closed_at: string | null;
  closed_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  paid_at: string | null;
  paid_by: string | null;
}

export interface RoomBillMinibarItem {
  id: string;
  bill_id: string;
  minibar_item_id: string;
  quantity: number;
  price_snapshot: number;
  updated_at: string;
}

export interface RoomBillPoolbarItem {
  id: string;
  bill_id: string;
  poolbar_item_id: string;
  quantity: number;
  price_snapshot: number;
  updated_at: string;
}

// Minimal Database type placeholder so @supabase/ssr generics compile.
// Replace with `supabase gen types typescript` output for full type-safety.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
