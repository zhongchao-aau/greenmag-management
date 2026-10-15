-- Migration 004: Extended shipment status workflow v2
-- Adds CN transit, EU transit, received, complete statuses
-- Adds exception flag + notes to shipments table

-- Extend the shipment_status enum with new values
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'china_dispatched';
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'cn_transit';
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'eu_transit';
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'received';
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'complete';

-- Add exception tracking columns to shipments
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS has_exception boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exception_notes text;
