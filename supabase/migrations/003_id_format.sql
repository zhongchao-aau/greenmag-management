-- Migration: 003_id_format.sql
-- Change ID padding from 3 to 5 digits, and order prefix from GM-PO- to ORD-

-- 1. Update next_gm_id to pad to 5 digits (00001 instead of 001)
CREATE OR REPLACE FUNCTION next_gm_id(entity text, prefix text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  seq int;
BEGIN
  UPDATE id_sequences SET current = current + 1
  WHERE id_sequences.entity = next_gm_id.entity
  RETURNING current INTO seq;
  RETURN prefix || lpad(seq::text, 5, '0');
END;
$$;

-- 2. Change purchase order prefix from GM-PO- to ORD-
CREATE OR REPLACE FUNCTION assign_order_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := next_gm_id('order', 'ORD-');
  END IF;
  RETURN NEW;
END;
$$;

-- Note: trigger trg_order_code already exists, no need to recreate it.
-- All other prefixes remain: GM-CMP-, GM-REQ-, GM-SHP-, GM-PRD-, GM-VAR-, GM-SMP-
