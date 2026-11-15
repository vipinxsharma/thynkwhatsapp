import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { updateConversationDetails } from "@/lib/inbox/store";
export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession(request,["owner","admin","agent"]);
  if (!auth.ok) return auth.response;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({error:"Invalid JSON"},{status:400}); }
  if (!body || typeof body !== "object" || typeof body.conversationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.conversationId)
    || (body.status !== undefined && !["open","pending","closed"].includes(body.status))
    || (body.tags !== undefined && (!Array.isArray(body.tags) || body.tags.length > 50 || body.tags.some((x:unknown)=>typeof x !== "string" || !x.trim() || x.length>60)))
    || (body.status === undefined && body.tags === undefined)) return NextResponse.json({error:"Invalid conversation update"},{status:400});
  try {
    const data = await updateConversationDetails(auth.session.tenantId,auth.session.userId,body.conversationId,{
      status:body.status,tags:body.tags ? [...new Set<string>(body.tags.map((x:string)=>x.trim()))] : undefined
    });
    return data ? NextResponse.json({data}) : NextResponse.json({error:"Conversation not found"},{status:404});
  } catch { return NextResponse.json({error:"Could not save conversation details"},{status:503}); }
}
