import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCredits } from "@/lib/credits";


export async function POST(req: Request) {
  const creditCheck = await requireCredits("movie_scenes");

  if (creditCheck.ok === false) {
    return creditCheck.response;
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body = await req.json();

    const { movie_id } = body;

    if (!movie_id) {
      return NextResponse.json(
        {
          error: "Movie ID required",
        },
        {
          status: 400,
        }
      );
    }

    const { data: movie } = await supabase
      .from("movies")
      .select("*, movie_scenes(*)")
      .eq("id", movie_id)
      .eq("user_id", user.id)
      .single();

    if (!movie) {
      return NextResponse.json(
        {
          error: "Movie not found",
        },
        {
          status: 404,
        }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const movieAny = movie as any;

    await (supabase.from("movies") as any)
  .update({
    status: "rendering",
  })
  .eq("id", movie_id);

const response = await fetch(
  `${process.env.NEXT_PUBLIC_WORKER_URL}/api/render-movie`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      movieId: movie_id,
      scenes: movieAny.movie_scenes ?? [],
      characters: movieAny.characters ?? [],
      pipeline: "gemini",
    }),
  }
);

const worker = await response.json();

return NextResponse.json(worker);

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      {
        error: "Movie render failed",
      },
      {
        status: 500,
      }
    );
  }
}