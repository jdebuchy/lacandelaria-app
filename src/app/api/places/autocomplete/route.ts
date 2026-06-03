import { NextResponse } from "next/server";
import { getPlaceAutocompleteSuggestions } from "@/lib/google-places";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const suggestions = await getPlaceAutocompleteSuggestions(query);
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("places autocomplete failed", error);
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}
