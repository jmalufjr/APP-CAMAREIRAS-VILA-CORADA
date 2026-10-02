export type UserRole = "admin" | "camareira" | "manutencao";
export type ChecklistType = "arrumacao" | "preparacao" | "troca" | "somente_chegada" | "somente_saida";
export type TaskStatus = "pendente" | "em_andamento" | "concluido" | "cancelado";
export type TableShape = "round" | "rect" | "square";
export type OccurrenceStatus = "pendente" | "selecionada" | "resolvida";
export type MaintenanceExecutionType = "nao_tecnico" | "tecnico";
export type MaintenanceItemStatus = "pendente" | "selecionada";
export type RoomBillStatus = "aberta" | "fechada" | "reaberta" | "paga";
export type PaymentMethod =
  | "pix"
  | "cartao_credito"
  | "cartao_debito"
  | "transferencia_bancaria"
  | "dinheiro"
  | "boleto";
export type InventoryMovementType = "compra" | "baixa_manual" | "baixa_consumo_hospede" | "ajuste_contagem";
export type InventoryCountStatus = "em_andamento" | "concluida";
export type PurchaseRequestStatus = "pendente" | "atendido" | "cancelado";
// 'unica' cobre o dia normal (1 conta por suíte, como sempre foi); os
// outros dois só existem num dia de Saída com Chegada em que a conta do
// hóspede que sai ainda não foi paga quando o hóspede novo chega.
export type RoomBillGuestSlot = "unica" | "saida_hoje" | "chegada_hoje";
export type ComandaStatus = "original" | "cancelada" | "editada";

export interface Profile {
  id: string;
  role: UserRole;
  name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  created_at: string;
  // Nota de qualidade do serviço (comissão de serviços nas suítes e no
  // café) — único valor contínuo por camareira, 0 a 10, padrão 5.
  service_quality_score: number;
}

export interface Room {
  id: string;
  number: string;
  name: string | null;
  active: boolean;
  position: number;
  created_at: string;
  stays_listing_id: string | null;
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

export interface DailyBreakfastRoomAssignment {
  id: string;
  date: string;
  table_id: string;
  room_id: string;
  guest_count: number;
  created_at: string;
  stays_locked: boolean;
}

export interface DailyBreakfastSettings {
  date: string;
  notes: string | null;
  updated_at: string;
}

export interface ReceiptSettings {
  id: number;
  accounting_email: string | null;
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
  cancelled_by: string | null;
  cancelled_at: string | null;
  stays_locked: boolean;
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

export interface DailyRoomTaskOccurrencePhoto {
  id: string;
  occurrence_id: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

// Foto já resolvida pra exibição: url é a URL assinada gerada na hora pelo
// servidor (null só se a assinatura falhar por algum motivo).
export interface OccurrencePhotoView {
  id: string;
  url: string | null;
}

export interface DailyBreakfast {
  id: string;
  date: string;
  table_id: string;
  guest_count: number;
  notes: string | null;
  value_per_table_snapshot: number;
  created_at: string;
  stays_locked: boolean;
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
  nights: number | null;
  guest_count: number | null;
  stays_locked: boolean;
}

export interface DailyDeparture {
  id: string;
  date: string;
  room_id: string;
  guest_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  stays_locked: boolean;
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
  guest_slot: RoomBillGuestSlot;
  guest_name_hint: string | null;
  opened_at: string;
  closed_at: string | null;
  closed_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  paid_at: string | null;
  paid_by: string | null;
  receipt_email_sent: boolean;
  service_charge_waived: boolean;
}

export interface RoomBillMinibarItem {
  id: string;
  bill_id: string;
  minibar_item_id: string;
  quantity: number;
  price_snapshot: number;
  updated_at: string;
}

export interface BarComanda {
  id: string;
  room_id: string;
  bill_id: string;
  sequence_number: number;
  monthly_number: number | null;
  status: ComandaStatus;
  created_by: string | null;
  created_at: string;
  last_action_by: string | null;
  last_action_at: string;
}

export interface BarComandaItem {
  id: string;
  comanda_id: string;
  poolbar_item_id: string;
  quantity: number;
  price_snapshot: number;
}

// ---------- Compras, despesas e estoque (PRD_compras.md) ----------

export interface ExpenseCategory {
  id: string;
  name: string;
  is_inventory_category: boolean;
  count_frequency_days: number | null;
  active: boolean;
  position: number;
  created_at: string;
}

export interface InventoryTurnoverGroup {
  id: string;
  name: string;
  coverage_days: number;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category_id: string;
  unit: string;
  barcode: string | null;
  reorder_point: number;
  turnover_group_id: string | null;
  portion_weight_kg: number | null;
  active: boolean;
  position: number;
  created_at: string;
}

// Ficha técnica: qual(is) produto(s) do cardápio (frigobar OU bar da
// piscina, nunca os dois) consomem este ingrediente, e quantas porções
// por pedido.
export interface InventoryItemRecipe {
  id: string;
  inventory_item_id: string;
  minibar_item_id: string | null;
  poolbar_item_id: string | null;
  portions_per_order: number;
  created_at: string;
}

// Dispensa, pelo admin, da sugestão calculada de um item — só vale
// enquanto o saldo do item não mudar de novo (ver PurchaseListRow).
export interface InventorySuggestionDismissal {
  inventory_item_id: string;
  dismissed_balance: number;
  dismissed_by: string | null;
  dismissed_at: string;
}

export interface PurchaseRequest {
  id: string;
  inventory_item_id: string;
  requested_qty: number;
  notes: string | null;
  status: PurchaseRequestStatus;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Ativo permanente (PRD_compras.md seção 8) ----------

export interface AssetCategory {
  id: string;
  name: string;
  active: boolean;
  position: number;
  created_at: string;
}

export interface FixedAsset {
  id: string;
  category_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  purchase_date: string | null;
  purchase_value: number | null;
  warranty_until: string | null;
  supplier_name: string | null;
  location: string | null;
  notes: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  date: string;
  category_id: string;
  supplier_name: string | null;
  total_amount: number;
  payment_method: PaymentMethod | null;
  receipt_storage_path: string | null;
  nfce_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ExpenseItem {
  id: string;
  expense_id: string;
  inventory_item_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  inventory_item_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  reference_expense_item_id: string | null;
  reference_room_bill_id: string | null;
  reference_count_line_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface InventoryCountSession {
  id: string;
  category_id: string | null;
  status: InventoryCountStatus;
  created_by: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface InventoryCountLine {
  id: string;
  session_id: string;
  inventory_item_id: string;
  theoretical_qty: number;
  counted_qty: number | null;
  created_at: string;
}

// Minimal Database type placeholder so @supabase/ssr generics compile.
// Replace with `supabase gen types typescript` output for full type-safety.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
