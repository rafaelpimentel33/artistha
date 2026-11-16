export type CustomerProfile = { name: string; email: string; phone: string; cep: string; cpfLastDigits: string | null };
export const emptyProfile: CustomerProfile = { name: "", email: "", phone: "", cep: "", cpfLastDigits: null };

export function parseCustomerProfile(data: unknown): CustomerProfile | null {
  if (!data || typeof data !== "object") return null;
  const { name, email, phone, cep, cpfLastDigits } = data as Partial<CustomerProfile>;
  if (typeof name !== "string" || typeof email !== "string" || typeof phone !== "string" || typeof cep !== "string") return null;
  return { name, email, phone, cep, cpfLastDigits: typeof cpfLastDigits === "string" && /^\d{2}$/.test(cpfLastDigits) ? cpfLastDigits : null };
}

export const orderStatus = { pending: "Aguardando confirmação", confirmed: "Confirmado", completed: "Concluído", cancelled: "Cancelado" } as const;
export type OrderStatus = keyof typeof orderStatus;

export type Order = {
  id: string; number: number; created_at: string; status: OrderStatus;
  name: string; customer_email?: string; customer_phone?: string; method: "delivery" | "pickup"; cep: string; note: string;
  lines: Array<{ name: string; option: string; quantity: number; price: number; reference?: string }>;
  subtotal: number; freight: number | null; total: number | null;
};
