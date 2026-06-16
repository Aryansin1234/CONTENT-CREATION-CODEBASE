import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function uploadToSupabase(
  data: Buffer | ArrayBuffer,
  path: string,
  mimeType: string
): Promise<string> {
  const buffer = data instanceof ArrayBuffer ? Buffer.from(data) : data;

  const { error } = await supabase.storage
    .from("pipeline-assets")
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from("pipeline-assets")
    .getPublicUrl(path);

  return urlData.publicUrl;
}
