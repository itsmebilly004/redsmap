import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

type Referee = {
  id: string;
  name: string;
};

export function RefereeOnboardingModal() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [needsReferee, setNeedsReferee] = useState(false);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [selectedRefereeId, setSelectedRefereeId] = useState<string>("none");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    async function checkStatus() {
      // Fetch user's referee_selected status
      const { data: profile, error } = await supabase
        .from("users")
        .select("referee_selected")
        .eq("id", user!.id)
        .single();

      if (error) {
        console.error("Error fetching user profile for referee check:", error);
        setLoading(false);
        return;
      }

      if (!profile?.referee_selected) {
        // Fetch referees
        const { data: refs } = await supabase.from("referees").select("*").order("name");
        if (refs) {
          setReferees(refs);
        }
        setNeedsReferee(true);
      }
      setLoading(false);
    }

    checkStatus();
  }, [user, authLoading]);

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);

    const updates: any = {
      referee_selected: true,
    };

    if (selectedRefereeId !== "none") {
      updates.referee_id = selectedRefereeId;
    } else {
      updates.referee_id = null;
    }

    const { error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      console.error("Error updating referee:", error);
      alert("Failed to save referee. Please try again.");
      setSubmitting(false);
    } else {
      setNeedsReferee(false);
      setSubmitting(false);
    }
  };

  if (loading || !needsReferee) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-[#333] bg-[#151515] p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#4bb4b3]/20">
            <Users className="h-8 w-8 text-[#4bb4b3]" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-white">Who invited you?</h2>
          <p className="text-sm text-[#aaa]">
            Please select the person who referred you to ArkTraders Hub. If no one referred you, select "None".
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#eee]">Select your referrer</label>
            <select
              className="w-full rounded-md border border-[#333] bg-[#222] px-4 py-3 text-sm text-white focus:border-[#4bb4b3] focus:outline-none"
              value={selectedRefereeId}
              onChange={(e) => setSelectedRefereeId(e.target.value)}
              disabled={submitting}
            >
              <option value="none">None (I wasn't referred)</option>
              {referees.map((ref) => (
                <option key={ref.id} value={ref.id}>
                  {ref.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            className="w-full bg-[#4bb4b3] py-6 text-lg font-semibold text-white hover:bg-[#3ca09f]"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : null}
            {submitting ? "Saving..." : "Continue to Dashboard"}
          </Button>
        </div>
      </div>
    </div>
  );
}
