-- Reject alphabetic PO fragments (e.g. "litical" from "political") at the canonical gate.
-- Extractor also tightened; this is defense-in-depth for promote_contract_from_fact.

delete from public.purchase_orders
where po_number !~ '[0-9]';

alter table public.purchase_orders
  drop constraint if exists purchase_orders_po_number_has_digit;

alter table public.purchase_orders
  add constraint purchase_orders_po_number_has_digit
  check (po_number ~ '[0-9]');

comment on constraint purchase_orders_po_number_has_digit on public.purchase_orders is
  'PO numbers must include at least one digit; blocks word-fragment false positives.';
