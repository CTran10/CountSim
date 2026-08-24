import { checkForUpdate } from "../../../lib/updateCheck";

export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function GET(): Promise<Response> {
  try {
    return Response.json(await checkForUpdate(), {
      headers: RESPONSE_HEADERS
    });
  } catch {
    return Response.json(
      { error: "The update check could not be completed." },
      { headers: RESPONSE_HEADERS, status: 502 }
    );
  }
}
