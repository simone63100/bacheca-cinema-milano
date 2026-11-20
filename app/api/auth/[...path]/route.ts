import { auth } from "@/lib/auth/server";

type Handler = (req: Request, ctx: { params: Promise<{ path: string[] }> }) => Promise<Response>;
const h = (m: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"): Handler => (req, ctx) => (auth().handler()[m] as Handler)(req, ctx);

export const GET = h("GET");
export const POST = h("POST");
export const PUT = h("PUT");
export const DELETE = h("DELETE");
export const PATCH = h("PATCH");
