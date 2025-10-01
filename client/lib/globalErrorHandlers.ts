import { toast } from "@/hooks/use-toast";

function onUnhandledRejection(event: PromiseRejectionEvent) {
  try {
    const reason = event.reason;
    const msg = String(reason?.message || reason || "Unknown error");
    if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("network")) {
      toast({
        title: "Network request failed",
        description:
          "A network request (Supabase or API) failed. Check your network connection and Supabase configuration (VITE_SUPABASE_URL / ANON key).",
      });
    }
  } catch {}
}

function onError(evt: ErrorEvent) {
  try {
    const msg = String(evt.message || "");
    if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("network")) {
      toast({
        title: "Network request failed",
        description:
          "A network request (Supabase or API) failed. Check your network connection and Supabase settings.",
      });
    }
  } catch {}
}

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  window.addEventListener("error", onError);
}

export {};
