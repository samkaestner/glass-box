"use client";

import React, { useState, useEffect, useRef } from "react";
import { useThoughtTree } from "@glassbox/react";
import { SpatialRail } from "@glassbox/react";
import { askGlassBox, askGlassBoxContinuation } from "./actions";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  nodeId?: string;
};

export function LLMOrchestrator() {
  const { addNode, getBranchTimeline, getNode, state } = useThoughtTree();
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRailOpen, setIsRailOpen] = useState(true);
  
  const lastQueryRef = useRef<string>("");
  const processedConflictIds = useRef<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-continuation loop: Watch for resolved conflicts
  useEffect(() => {
    const timeline = getBranchTimeline();
    if (timeline.length === 0) return;

    const lastNode = timeline[timeline.length - 1];
    
    // Auto-pop open if a conflict arises or user needs to see the rail
    if (lastNode.type === "conflict" && !lastNode.resolution) {
      setIsRailOpen(true);
    }

    // Handle resolution continuation
    if (
      lastNode.type === "conflict" && 
      lastNode.resolution && 
      !processedConflictIds.current.has(lastNode.id)
    ) {
      processedConflictIds.current.add(lastNode.id);
      
      const chosenNode = getNode(lastNode.resolution.chosenNodeId);
      const chosenLabel = chosenNode?.type === "citation" 
        ? chosenNode.source.title ?? chosenNode.source.uri 
        : lastNode.resolution.chosenNodeId;

      handleContinuation(chosenLabel, lastNode.description ?? "Contradictory data detected");
    }
  }, [state.revision]);

  const handleContinuation = async (chosenLabel: string, conflictDescription: string) => {
    setIsLoading(true);
    try {
      const preferenceMsg = chosenLabel 
        ? `I've received your preference for ${chosenLabel}. Resuming synthesis...`
        : "I've received your preference. Resuming synthesis...";

      setMessages(prev => [...prev, {
        id: "resolving-" + Date.now(),
        role: "assistant",
        content: preferenceMsg
      }]);

      // Use the dedicated continuation action (decision-only, no conflict loop)
      const result = await askGlassBoxContinuation(
        lastQueryRef.current,
        chosenLabel,
        conflictDescription
      );
      
      // Remove the "resolving" placeholder
      setMessages(prev => prev.filter(m => !m.id.startsWith("resolving-")));

      // Result is guaranteed to be a decision
      const payload = result.decisionPayload;
      addNode({
        type: "decision",
        claim: payload.claim,
        confidence: payload.confidence,
        rationale: payload.rationale,
        provenance: [],
        alternatives: payload.alternatives || []
      });

      setMessages(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        role: "assistant",
        content: payload.claim
      }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: query
    };

    setMessages(prev => [...prev, userMessage]);
    setQuery("");
    setIsLoading(true);
    lastQueryRef.current = query;

    try {
      const result = await askGlassBox(query);
      
      const citationIds: string[] = [];
      for (const citation of result.citations) {
        const nextState = addNode(citation);
        const timeline = nextState.branchesById[nextState.activeBranchId].timeline;
        citationIds.push(timeline[timeline.length - 1]);
      }

      if (result.llmResponse.nodeType === "decision") {
        const payload = result.llmResponse.decisionPayload;
        addNode({
          type: "decision",
          claim: payload.claim,
          confidence: payload.confidence,
          rationale: payload.rationale,
          provenance: citationIds,
          alternatives: payload.alternatives || []
        });

        setMessages(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          role: "assistant",
          content: payload.claim
        }]);
      } else if (result.llmResponse.nodeType === "conflict") {
        setIsRailOpen(true);
        addNode({
          type: "conflict",
          contenders: citationIds.length >= 2 ? citationIds.slice(-2) : citationIds,
          description: result.llmResponse.conflictPayload.description
        });
        
        setMessages(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          role: "assistant",
          content: "I've encountered a conflict between the studies. Please check the explainability rail to resolve it."
        }]);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to call LLM: " + String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[85vh] w-full gap-4 overflow-hidden p-4">
      {/* LEFT PANE: CHAT */}
      <div className="flex flex-1 flex-col rounded-3xl bg-[#0d1117] border border-white/5 overflow-hidden shadow-2xl relative">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                 <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              </div>
              <h2 className="text-xl font-medium text-white">Glass Box Orchestrator</h2>
              <p className="text-sm mt-2 max-w-xs">Ask a question about your endurance studies to begin the reasoning chain.</p>
            </div>
          )}
          
          {messages.map((m) => (
            <div 
              key={m.id} 
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div 
                className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-lg ${
                  m.role === "user" 
                    ? "bg-emerald-600/20 border border-emerald-500/30 text-emerald-50" 
                    : "bg-white/5 border border-white/10 text-white"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="p-4 bg-black/20 border-t border-white/5">
          <div className="relative">
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about your training split..."
              className="w-full bg-[#161b22] border border-white/10 rounded-full px-6 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/40 transition shadow-inner"
              disabled={isLoading}
            />
            <button 
              type="submit"
              disabled={isLoading || !query.trim()}
              className="absolute right-2 top-2 bottom-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-5 rounded-full font-medium transition disabled:opacity-30 border border-emerald-500/20"
            >
              {isLoading ? "Thinking..." : "Send"}
            </button>
          </div>
        </form>
      </div>

      {/* RIGHT PANE: EXPLAINABILITY RAIL */}
      <div 
        className={`transition-all duration-500 ease-in-out flex flex-col rounded-3xl bg-[#0d1117] border border-white/5 shadow-2xl relative ${
          isRailOpen ? "w-[400px]" : "w-0 overflow-hidden opacity-0 pointer-events-none translate-x-12"
        }`}
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/10">
          <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase pl-2">Explainability Rail</span>
          <button 
            onClick={() => setIsRailOpen(false)}
            className="p-1.5 hover:bg-white/5 rounded-lg transition text-white/40 hover:text-white/80"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <SpatialRail aria-label="Spatial rail" />
        </div>
      </div>

      {/* COLLAPSED RAIL TAB */}
      {!isRailOpen && (
        <button 
          onClick={() => setIsRailOpen(true)}
          className="fixed right-6 top-1/2 -translate-y-1/2 w-10 h-32 bg-[#0d1117] border border-white/10 rounded-full flex flex-col items-center justify-center gap-4 group hover:bg-white/5 transition-colors shadow-2xl z-50"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="[writing-mode:vertical-lr] text-[10px] font-bold tracking-[0.2em] text-white/30 uppercase group-hover:text-white/60 transition-colors">Explainability</span>
        </button>
      )}
    </div>
  );
}
