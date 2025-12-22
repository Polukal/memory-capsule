// deno-lint-ignore-file no-explicit-any
import { createClient } from "supabase";

const supabase = createClient(
  Deno.env.get("PROJECT_URL")!,
  Deno.env.get("SERVICE_ROLE_KEY")!
);

const FAL_KEY = Deno.env.get("FAL_KEY")!;

Deno.serve(async (req) => {
  try {
    const { photo_id } = await req.json();

    if (!photo_id) {
      return respond(400, { error: "photo_id missing" });
    }

    // --- get photo record
    const { data: photo } = await supabase
      .from("photos")
      .select("id, file_path, album_id")
      .eq("id", photo_id)
      .single();

    if (!photo) {
      return respond(404, { error: "photo not found" });
    }

    // --- signed URL
    const { data: signed } = await supabase.storage
      .from("user-uploads")
      .createSignedUrl(photo.file_path, 60 * 60);

    if (!signed?.signedUrl) {
      return respond(500, { error: "failed to sign url" });
    }

    const modelPath = "fal-ai/kling-video/v1.6/pro/image-to-video";

    // --- SUBMIT job
    const submitRes = await fetch(
      `https://fal.run/${modelPath}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Key ${FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: "Realistic old portrait animation",
          image_url: signed.signedUrl,
          duration: "5",
          aspect_ratio: "16:9"
        }),
      },
    );

    if (!submitRes.ok) {
      return respond(
        500,
        { error: "submit fail", details: await submitRes.text() },
      );
    }

    const submitJson = await submitRes.json();
    const requestId = submitJson?.request_id;

    if (!requestId) {
      return respond(500, { error: "missing request_id" });
    }

    // --- POLLING LOOP
    let finalJob: any = null;

    for (let i = 0; i < 100; i++) {

      await wait(4000); // 4 secs, 400 secs total

      const pollRes = await fetch(
        `https://fal.run/${modelPath}/status`,
        {
          method: "POST",
          headers: {
            "Authorization": `Key ${FAL_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            request_id: requestId,
            logs: false
          }),
        },
      );

      const pollJson = await pollRes.json();

      if (pollJson?.status === "COMPLETED") {
        finalJob = pollJson;
        break;
      }

      if (pollJson?.status === "FAILED") {
        return respond(500, { error: "Fal failed", detail: pollJson });
      }
    }

    if (!finalJob) {
      // job is still running
      // store pending row so front-end can check later
      await supabase
        .from("animations")
        .insert({
          photo_id,
          model_used: "v1.6",
          fal_job_id: requestId,
          status: "pending"
        });

      return respond(200, {
        success: true,
        status: "pending",
        message: "Animation still being generated. Check back in ~3 minutes."
      });
    }

    // get video url
    const videoUrl = finalJob?.data?.video?.url;

    if (!videoUrl) {
      return respond(500, {
        error: "no output url",
        detail: finalJob
      });
    }

    // download video
    const videoRes = await fetch(videoUrl);
    const buffer = new Uint8Array(await videoRes.arrayBuffer());

    const videoPath =
      `${photo.album_id}/${photo.id}-${Date.now()}.mp4`;

    // upload  
    const upload = await supabase.storage
      .from("animations")
      .upload(videoPath, buffer, {
        contentType: "video/mp4",
      });

    // insert db row
    const { data: animRow } = await supabase
      .from("animations")
      .insert({
        photo_id,
        model_used: "v1.6",
        video_path: videoPath,
        fal_job_id: requestId,
        status: "completed",
      })
      .select()
      .single();

    return respond(200, {
      success: true,
      animation: animRow,
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

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
