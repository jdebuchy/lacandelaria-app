import { NextResponse } from "next/server";
import { getPlaceDetails } from "@/lib/google-places";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = (searchParams.get("placeId") ?? "").trim();

  if (!placeId) {
    return NextResponse.json({ success: false, message: "Falta el placeId." }, { status: 400 });
  }

  try {
    const place = await getPlaceDetails(placeId);
    return NextResponse.json({ success: true, place });
  } catch (error) {
    console.error("place details failed", error);
    return NextResponse.json(
      { success: false, message: "No se pudo recuperar la dirección sugerida." },
      { status: 500 }
    );
  }
}
