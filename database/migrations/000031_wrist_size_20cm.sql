-- Extend default wrist size catalog to 20 cm (admin-managed; builder reads dynamically).
BEGIN;

INSERT INTO public.wrist_sizes (size_cm, label, display_order, is_active, is_default) VALUES
  (20.0, '20 cm', 70, TRUE, FALSE)
ON CONFLICT (size_cm) DO NOTHING;

COMMIT;
