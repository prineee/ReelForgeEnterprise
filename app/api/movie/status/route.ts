import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {

  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url =
    new URL(req.url);

  const movieId =
    url.searchParams.get(
      "movie_id"
    );

  if (!movieId) {
    return NextResponse.json(
      {
        error:
          "Movie ID required",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const { data } =
      await (supabase
        .from("movies") as any)
        .select("*")
        .eq("id", movieId)
        .eq("user_id", user.id)
        .single();

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Movie not found",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({

      status:
        data.status ?? "waiting",

      progress:
        data.progress ?? 0,

      currentScene:
        data.current_scene ?? 0,

      totalScenes:
        data.total_scenes ?? 0,

      downloadUrl:
        data.video_url ?? null,

    });
  } catch (error) {
    console.error("[movie/status] GET failed", error);
    return NextResponse.json({ error: "Failed to fetch movie status." }, { status: 500 });
  }

}