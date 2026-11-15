import {afterEach,describe,it,expect,vi} from "vitest";
import {NextRequest,NextResponse} from "next/server";
const auth=vi.hoisted(()=>vi.fn(async (..._args:unknown[])=>({ok:true,session:{tenantId:"workspace",userId:"agent"}}) as any));
const save=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/auth/session",()=>({requireApiSession:auth}));
vi.mock("@/lib/inbox/store",()=>({updateConversationDetails:save}));
import {PATCH} from "../app/api/inbox/conversation/route";
const id="11111111-1111-4111-8111-111111111111";
const request=(body:unknown)=>new NextRequest("https://xeccel.com/api/inbox/conversation",{method:"PATCH",body:JSON.stringify(body)});
afterEach(()=>vi.clearAllMocks());
describe("saved inbox details",()=>{
 it("rejects unauthorized users without writing",async()=>{auth.mockResolvedValueOnce({ok:false,response:NextResponse.json({error:"Forbidden"},{status:403})});expect((await PATCH(request({conversationId:id,status:"closed"}))).status).toBe(403);expect(save).not.toHaveBeenCalled();});
 it("uses the signed tenant and normalizes tags",async()=>{save.mockResolvedValueOnce({id,status:"pending",tags:["VIP"]});expect((await PATCH(request({conversationId:id,status:"pending",tags:[" VIP ","VIP"],workspaceId:"foreign"}))).status).toBe(200);expect(save).toHaveBeenCalledWith("workspace","agent",id,{status:"pending",tags:["VIP"]});expect(auth).toHaveBeenCalledWith(expect.anything(),["owner","admin","agent"]);});
 it("validates statuses, tags and IDs",async()=>{for(const body of [{conversationId:"bad",status:"open"},{conversationId:id,status:"archived"},{conversationId:id,tags:[null]},{conversationId:id}])expect((await PATCH(request(body))).status).toBe(400);expect(save).not.toHaveBeenCalled();});
 it("returns 404 for a conversation outside the workspace",async()=>{save.mockResolvedValueOnce(undefined);expect((await PATCH(request({conversationId:id,tags:[]}))).status).toBe(404);});
});
