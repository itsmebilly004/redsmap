import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { TopShell } from "@/components/top-shell";

export const Route = createFileRoute("/client/dashboard/settings")({
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState<string>("");

  const loadSessions = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user.id);
    if (!error && data) {
      setSessions(data);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, [user]);

  const handleSave = async (id: string) => {
    const balanceNum = parseFloat(newBalance);
    if (isNaN(balanceNum)) {
      toast.error("Invalid balance amount");
      return;
    }

    const { error } = await supabase
      .from("sessions")
      .update({ balance: balanceNum })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update balance");
    } else {
      toast.success("Balance updated successfully");
      setEditingId(null);
      void loadSessions();
    }
  };

  // Functionality to create fake accounts is removed. The clone now purely reads existing accounts.

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Clone Settings</h1>
      
      <p className="mb-6 text-sm text-muted-foreground">
        Use this page to adjust the balances of your connected database accounts for the simulation. 
        To connect more real Deriv accounts, please log into the main platform.
      </p>

      <div className="rounded-xl border bg-card text-card-foreground shadow">
        <div className="p-6">
          <h2 className="text-xl font-semibold">Your Accounts</h2>
          <div className="mt-4 space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <div className="font-mono font-medium">{session.account_id}</div>
                  <div className="text-sm text-muted-foreground">
                    {session.is_demo ? "Demo Account" : "Real Account"} • {session.currency}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {editingId === session.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={newBalance}
                        onChange={(e) => setNewBalance(e.target.value)}
                        className="w-32"
                      />
                      <Button size="sm" onClick={() => handleSave(session.id)}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <>
                      <div className="font-mono text-lg font-bold">
                        {Number(session.balance).toFixed(2)} {session.currency}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditingId(session.id);
                        setNewBalance(String(session.balance));
                      }}>
                        Edit Balance
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="text-sm text-muted-foreground">
                No accounts found. Please connect your accounts on the main platform.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
