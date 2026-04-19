import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ayeqrbcvihztxbrxmrth.supabase.co',
  'sb_publishable_YeFrbZkCUwM-cSAm3ZODrg_ie0j1Maa'
);

async function test() {
  // Find ron.nolte@gmail.com
  // Since we can't query auth.users with anon key, we'll query apiaries directly
  // wait, we can't query apiaries without RLS unless we use service role key or we know the user_id.
  console.log("We can't easily query RLS tables without a user token.");
}

test();
