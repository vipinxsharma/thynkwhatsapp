import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const store = vi.hoisted(()=>({listRoutingRules:vi.fn(),listRoutingRuns:vi.fn(),saveRoutingRule:vi.fn(),deleteRoutingRule:vi.fn()}));
const auth = vi.hoisted(()=>vi.fn(async (..._args: unknown[])=>({ok:true,session:{tenantId:"11111111-1111-4111-8111-111111111111",userId:"owner"}}) as any));
vi.mock("@/lib/auth/session",()=>({requireApiSession:auth}));
vi.mock("@/lib/automations/store",()=>store);
import { GET, POST, PUT, DELETE } from "../app/api/automations/route";
const input = {name:"Support",channelId:null,matchType:"contains",keywords:["help"],tags:["Support"],conversationStatus:"pending",priority:10,enabled:true};
afterEach(()=>{vi.clearAllMocks();});
function request(method: string, body?: unknown, suffix="") { return new NextRequest(`https://xeccel.com/api/automations${suffix}`,{method,body:body ? JSON.stringify(body):undefined}); }
describe("durable automation routes",()=>{
  it("rejects unauthenticated requests before touching storage",async()=>{
    for (const handler of [GET,POST,PUT,DELETE]) {
      auth.mockResolvedValueOnce({ok:false,response:NextResponse.json({error:"Unauthorized"},{status:401})});
      expect((await handler(request("GET"))).status).toBe(401);
    }
    expect(store.listRoutingRules).not.toHaveBeenCalled();
  });
  it("saves only in authenticated workspace and requires administration",async()=>{
    store.saveRoutingRule.mockResolvedValueOnce({...input,id:"rule"});
    expect((await POST(request("POST",{...input,workspaceId:"attacker"}))).status).toBe(201);
    expect(auth).toHaveBeenCalledWith(expect.anything(),["owner","admin"]);
    expect(store.saveRoutingRule).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111","owner",input,undefined);
  });
  it("rejects unsupported reply actions and malformed IDs",async()=>{
    expect((await POST(request("POST",{...input,matchType:"regex"}))).status).toBe(400);
    expect((await PUT(request("PUT",{...input,id:"bad"}))).status).toBe(400);
    expect((await DELETE(request("DELETE",undefined,"?id=bad"))).status).toBe(400);
    expect(store.saveRoutingRule).not.toHaveBeenCalled();
  });
  it("simulation never modifies rules or execution history",async()=>{
    store.listRoutingRules.mockResolvedValueOnce([{...input,id:"a"}]);
    const response = await POST(request("POST",{action:"test",text:"help me",channelId:"12345"}));
    expect(await response.json()).toMatchObject({simulation:true,rule:{id:"a"}});
    expect(store.saveRoutingRule).not.toHaveBeenCalled();
  });
  it("fails closed on unavailable storage without exposing database errors",async()=>{
    store.listRoutingRules.mockRejectedValueOnce(new Error("secret connection string"));
    store.listRoutingRuns.mockResolvedValueOnce([]);
    const response=await GET(request("GET"));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("secret");
  });
});
