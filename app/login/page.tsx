import { ShieldCheck } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#090c10] text-gray-200 flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1117] p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-whatsapp/20 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-whatsapp-light" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">thynkWISE Messaging Cloud</h1>
            <p className="text-xs text-gray-400">Secure workspace access</p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-300">Self-service identity setup required</p>
          <p className="mt-2 text-xs leading-relaxed text-gray-300">
            This security foundation now fails closed. Account signup, email verification, and
            workspace creation will be connected to the durable tenant store in the next pull
            request.
          </p>
        </div>
      </section>
    </main>
  );
}
