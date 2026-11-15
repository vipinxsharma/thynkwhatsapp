import {describe,it,expect} from "vitest";
import {matchRoutingRule,parseRoutingRule,type RoutingRule} from "../lib/automations/routing";
const input={name:"Support",channelId:null,matchType:"contains",keywords:["help"],tags:["Support"],conversationStatus:"pending",priority:100,enabled:true};
const rule=(extra:Partial<RoutingRule>={}):RoutingRule=>({...parseRoutingRule(input),id:"a",updatedAt:"2026-10-15T00:00:00Z",...extra});
describe("keyword routing",()=>{
 it("validates and normalizes bounded rules",()=>expect(parseRoutingRule({...input,keywords:[" help ","help"]}).keywords).toEqual(["help"]));
 it("rejects arbitrary patterns, malformed values, empty actions and oversized lists",()=>{
  for(const invalid of [{matchType:"regex"},{tags:[],conversationStatus:null},{keywords:[5]},{enabled:"true"},{channelId:"other"},{priority:-1},{keywords:Array(31).fill("x")}, {conversationStatus:{toString:()=>"open"}}]) expect(()=>parseRoutingRule({...input,...invalid})).toThrow();
 });
 it("uses case-insensitive exact versus substring matching",()=>{
  expect(matchRoutingRule([rule({matchType:"exact"})]," HELP ","12345")?.id).toBe("a");
  expect(matchRoutingRule([rule({matchType:"exact"})],"help please","12345")).toBeNull();
  expect(matchRoutingRule([rule()],"help please","12345")?.id).toBe("a");
 });
 it("respects channel, paused rules, priority, and deterministic tie breaks",()=>{
  const rules=[rule({id:"b",priority:2}),rule({id:"a",priority:2}),rule({id:"c",priority:1,enabled:false}),rule({id:"d",priority:0,channelId:"99999"})];
  expect(matchRoutingRule(rules,"help","12345")?.id).toBe("a");
  expect(matchRoutingRule(rules,"help","99999")?.id).toBe("d");
  expect(matchRoutingRule(rules,"","99999")).toBeNull();
 });
});
