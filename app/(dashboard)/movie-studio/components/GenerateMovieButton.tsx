"use client";

import { useState } from "react";

interface Props {
  movieId: string;
}

export default function GenerateMovieButton({
  movieId,
}: Props) {
  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  async function generateMovie() {
    setLoading(true);
    setMessage("Starting render...");

    try {
      const res = await fetch(
        "/api/movie/render",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            movie_id: movieId,
          }),
        }
      );

      const data =
        await res.json();

      if (!res.ok) {
        setMessage(
          data.error ??
            "Render failed"
        );
        return;
      }

      setMessage(
        "Movie submitted successfully."
      );

      console.log(data);

    } catch (error) {

      console.error(error);

      setMessage(
        "Unexpected error."
      );

    } finally {

      setLoading(false);

    }
  }

  return (
    <div className="space-y-3">

      <button
        onClick={generateMovie}
        disabled={loading}
        className="rounded-lg bg-purple-600 px-6 py-3 text-white font-semibold hover:bg-purple-700 disabled:opacity-50"
      >
        {loading
          ? "Generating..."
          : "🎬 Generate Movie"}
      </button>

      {message && (
        <p className="text-sm text-gray-300">
          {message}
        </p>
      )}

    </div>
  );
}