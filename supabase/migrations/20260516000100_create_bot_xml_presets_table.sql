-- Plain-text XML storage for trading bot presets.
-- Stores raw Blockly XML with no JSON wrapping; code never parses structure.
CREATE TABLE IF NOT EXISTS public.bot_xml_presets (
  bot_id      TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  xml_content TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bot_xml_presets ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read all presets
CREATE POLICY "Authenticated users can read bot XML presets"
  ON public.bot_xml_presets FOR SELECT TO authenticated USING (true);

-- Only the 7 registered bot IDs may be seeded
CREATE POLICY "Authenticated users can seed bot XML presets"
  ON public.bot_xml_presets FOR INSERT TO authenticated
  WITH CHECK (bot_id IN (
    'nova-v6','mega-mind','phantom-hit-run','candle-mine','dec-entry',
    'under-pro-sentinel','osam-auto-pilot'
  ));

CREATE POLICY "Authenticated users can update bot XML presets"
  ON public.bot_xml_presets FOR UPDATE TO authenticated
  USING (bot_id IN (
    'nova-v6','mega-mind','phantom-hit-run','candle-mine','dec-entry',
    'under-pro-sentinel','osam-auto-pilot'
  ))
  WITH CHECK (bot_id IN (
    'nova-v6','mega-mind','phantom-hit-run','candle-mine','dec-entry',
    'under-pro-sentinel','osam-auto-pilot'
  ));

notify pgrst, 'reload schema';
