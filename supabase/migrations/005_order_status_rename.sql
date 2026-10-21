-- Migration 005: rename order_status enum values (approved→draft, ordered→sent)
-- The TypeScript codebase was updated to use 'draft' and 'sent'.
-- This migration adds the new enum values and migrates existing data.

-- Step 1: add new enum values (Postgres 12+ supports this in transactions)
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'sent';

-- Step 2: migrate existing rows to new status names
UPDATE purchase_orders SET status = 'draft' WHERE status = 'approved';
UPDATE purchase_orders SET status = 'sent'  WHERE status = 'ordered';
