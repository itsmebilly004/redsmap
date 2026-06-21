-- Drop existing RLS policies that restrict insertions and updates
DROP POLICY IF EXISTS "Authenticated users can seed bot XML presets" ON public.bot_xml_presets;
DROP POLICY IF EXISTS "Authenticated users can update bot XML presets" ON public.bot_xml_presets;

-- Recreate the INSERT policy, adding 'under-destroyer-v2' to the whitelist
CREATE POLICY "Authenticated users can seed bot XML presets"
  ON public.bot_xml_presets FOR INSERT TO authenticated
  WITH CHECK (bot_id IN (
    'nova-v6','mega-mind','phantom-hit-run','candle-mine','dec-entry',
    'under-pro-sentinel','osam-auto-pilot','under-destroyer-v2'
  ));

-- Recreate the UPDATE policy, adding 'under-destroyer-v2' to the whitelist
CREATE POLICY "Authenticated users can update bot XML presets"
  ON public.bot_xml_presets FOR UPDATE TO authenticated
  USING (bot_id IN (
    'nova-v6','mega-mind','phantom-hit-run','candle-mine','dec-entry',
    'under-pro-sentinel','osam-auto-pilot','under-destroyer-v2'
  ))
  WITH CHECK (bot_id IN (
    'nova-v6','mega-mind','phantom-hit-run','candle-mine','dec-entry',
    'under-pro-sentinel','osam-auto-pilot','under-destroyer-v2'
  ));

-- Reload the PostgREST schema cache so the new policies take effect immediately
notify pgrst, 'reload schema';
