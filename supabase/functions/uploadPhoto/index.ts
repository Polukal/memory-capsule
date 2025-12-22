// deno-lint-ignore-file no-explicit-any
import { createClient } from "supabase";

const supabase = createClient(
  Deno.env.get("PROJECT_URL")!,
  Deno.env.get("SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return respond(405, { error: "Only POST allowed" });
    }

    // Parse form-data
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return respond(400, { error: "Expected multipart/form-data" });
    }

    const formData = await req.formData();

    const album_id = formData.get("album_id")?.toString();
    const user_id = formData.get("user_id")?.toString();
    const file = formData.get("file") as File | null;

    if (!album_id) return respond(400, { error: "album_id missing" });
    if (!user_id) return respond(400, { error: "user_id missing" });
    if (!file) return respond(400, { error: "file missing" });

    // Convert File → buffer
    const buffer = new Uint8Array(await file.arrayBuffer());

    // create unique path
    const fileExt = file.name.split(".").pop();
    const path = `${user_id}/${crypto.randomUUID()}.${fileExt}`;

    // Upload into bucket
    const { error: uploadError } = await supabase.storage
      .from("user-uploads")
      .upload(path, buffer, {
        contentType: file.type,
      });

    if (uploadError) {
      return respond(500, { error: uploadError.message });
    }

    // Insert DB record
    const { data: row, error: dbError } = await supabase
      .from("photos")
      .insert({
        album_id: album_id,
        file_path: path,
        status: "uploaded",
        user_id: user_id
      })
      .select()
      .single();

    if (dbError) {
      return respond(500, { error: dbError.message });
    }

    return respond(200, {
      success: true,
      photo: row,
    });

  } catch (err: any) {
    return respond(500, { error: err.message });
  }
});


function respond(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
