import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Users } from "lucide-react";

interface Group {
  id: string;
  name: string;
  major: string;
  year_level: string;
  required_sessions: number;
}

interface Evaluation {
  id: string;
  group_id: string;
  score: number | null;
  max_score: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  student_groups?: Group;
}

export default function ExternalEvaluator() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [evaluateDialogOpen, setEvaluateDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [score, setScore] = useState<number>(100);
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const verifyRole = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      navigate('/auth');
      return false;
    }
    
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUser.id)
      .single();
    
    // @ts-ignore - external_evaluator role will be available after types regeneration
    if (roleData?.role !== 'external_evaluator' && roleData?.role !== 'super_admin') {
      toast({
        variant: "destructive",
        title: "ไม่มีสิทธิ์เข้าถึง",
        description: "คุณไม่มีสิทธิ์เข้าถึงหน้านี้",
      });
      navigate('/auth');
      return false;
    }
    return true;
  };

  const checkAuth = async () => {
    const isAuthorized = await verifyRole();
    if (!isAuthorized) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
    fetchData(session.user.id);
  };

  const fetchData = async (userId: string) => {
    try {
      const [profileRes, groupsRes, evaluationsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("student_groups").select("*").order("name"),
        // @ts-ignore - external_evaluations will be available after types regeneration
        supabase.from("external_evaluations").select("*, student_groups(*)").eq("evaluator_id", userId),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (groupsRes.data) setGroups(groupsRes.data);
      if (evaluationsRes.data) setEvaluations(evaluationsRes.data as any);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openEvaluateDialog = (group: Group) => {
    const existing = evaluations.find(e => e.group_id === group.id);
    setSelectedGroup(group);
    setScore(existing?.score || 100);
    setComment(existing?.comment || "");
    setEvaluateDialogOpen(true);
  };

  const handleSaveEvaluation = async () => {
    if (!selectedGroup || !user) return;

    setIsSaving(true);
    try {
      const existing = evaluations.find(e => e.group_id === selectedGroup.id);

      if (existing) {
        // Update existing evaluation
        const { error } = await supabase
          // @ts-ignore - external_evaluations will be available after types regeneration
          .from("external_evaluations")
          .update({
            score,
            comment,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Create new evaluation
        const { error } = await supabase
          // @ts-ignore - external_evaluations will be available after types regeneration
          .from("external_evaluations")
          .insert({
            group_id: selectedGroup.id,
            evaluator_id: user.id,
            score,
            comment,
            max_score: 100,
          });

        if (error) throw error;
      }

      toast({
        title: "บันทึกสำเร็จ",
        description: "บันทึกการประเมินแล้ว",
      });

      setEvaluateDialogOpen(false);
      fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">กำลังโหลด...</div>;
  }

  return (
    <DashboardLayout role="external_evaluator" userName={`${profile?.first_name || ""} ${profile?.last_name || ""}`}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              ประเมินกลุ่มนักศึกษา
            </CardTitle>
            <CardDescription>เลือกกลุ่มเพื่อให้คะแนนและแสดงความเห็น</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อกลุ่ม</TableHead>
                  <TableHead>สาขา</TableHead>
                  <TableHead>ปี</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => {
                  const evaluation = evaluations.find(e => e.group_id === group.id);
                  return (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">{group.name}</TableCell>
                      <TableCell>{group.major}</TableCell>
                      <TableCell>{group.year_level}</TableCell>
                      <TableCell>
                        {evaluation ? (
                          <Badge variant="default">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            ประเมินแล้ว ({evaluation.score}/100)
                          </Badge>
                        ) : (
                          <Badge variant="secondary">ยังไม่ได้ประเมิน</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => openEvaluateDialog(group)}>
                          {evaluation ? "แก้ไข" : "ประเมิน"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={evaluateDialogOpen} onOpenChange={setEvaluateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ประเมินกลุ่ม: {selectedGroup?.name}</DialogTitle>
              <DialogDescription>
                {selectedGroup?.major} ปี {selectedGroup?.year_level}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>คะแนน (เต็ม 100)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={score}
                  onChange={(e) => setScore(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>ความเห็น</Label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="แสดงความเห็นเกี่ยวกับการประเมิน..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setEvaluateDialogOpen(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleSaveEvaluation} disabled={isSaving}>
                {isSaving ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
