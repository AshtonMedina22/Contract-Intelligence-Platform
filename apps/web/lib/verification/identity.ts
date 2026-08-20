const CLIENT_FIELDS = new Set(["client_name", "client", "customer_name"]);
const OPPORTUNITY_FIELDS = new Set(["opportunity_title", "opportunity", "solicitation_title"]);

export function identityTarget(field: string, entity: string | null): "client" | "opportunity" | null {
  const key = field.trim().toLowerCase().split("!").pop() ?? "";
  const ent = (entity ?? "").toLowerCase();
  if (CLIENT_FIELDS.has(key) || ent === "client") return "client";
  if (OPPORTUNITY_FIELDS.has(key) || ent === "opportunity") return "opportunity";
  return null;
}

export function isIdentityField(field: string, entity: string | null): boolean {
  return identityTarget(field, entity) !== null;
}
