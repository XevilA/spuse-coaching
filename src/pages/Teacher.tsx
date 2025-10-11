import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Eye, Users, FileCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function Teacher() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (roleData?.role !== "teacher" && roleData?.role !== "admin") {
      navigate(`/${roleData?.role || "auth"}`);
      return;
    }

    setUser(session.user);
    fetchData();
  };

  const fetchData = async () => {
    try {
      const { data: profileRes } = await supabase.from("profiles").select("*").eq("id", user?.id || "").single();
      if (profileRes) setProfile(profileRes);

      const { data: sessionsData } = await supabase
        .from("coaching_sessions")
        .select(`
          *,
          profiles!coaching_sessions_student_id_fkey (
            first_name,
            last_name,
            student_id
          )
        `)
        .order("created_at", { ascending: false });

      if (sessionsData) {
        const grouped = sessionsData.reduce((acc: any, session: any) => {
          const studentId = session.student_id;
          if (!acc[studentId]) {
            acc[studentId] = {
              studentInfo: session.profiles,
              sessions: [],
              completedCount: 0,
              pendingCount: 0,
            };
          }
          acc[studentId].sessions.push(session);
          if (session.status === "approved") acc[studentId].completedCount++;
          if (session.status === "pending") acc[studentId].pendingCount++;
          return acc;
        }, {});

        setStudents(Object.values(grouped));
      }
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

  const handleReview = async (sessionId: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("coaching_sessions")
        .update({
          status,
          notes: reviewNotes,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (error) throw error;

      toast({
        title: "บันทึกสำเร็จ",
        description: status === "approved" ? "อนุมัติใบ coaching แล้ว" : "ไม่อนุมัติใบ coaching",
      });

      setSelectedSession(null);
      setReviewNotes("");
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  const totalSessions = students.reduce((sum, s) => sum + s.sessions.length, 0);
  const totalPending = students.reduce((sum, s) => sum + s.pendingCount, 0);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">กำลังโหลด...</div>;
  }

  return (
    <DashboardLayout role="teacher" userName={`${profile?.first_name || ""} ${profile?.last_name || ""}`}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">จำนวนนักศึกษา</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{students.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">ใบ Coaching ทั้งหมด</CardTitle>
              <FileCheck className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalSessions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">รอตรวจสอบ</CardTitle>
              <Eye className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{totalPending}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>รายชื่อนักศึกษา</CardTitle>
            <CardDescription>ตรวจสอบและอนุมัติใบ coaching</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัสนักศึกษา</TableHead>
                  <TableHead>ชื่อ-นามสกุล</TableHead>
                  <TableHead className="text-center">จำนวนครั้ง</TableHead>
                  <TableHead className="text-center">อนุมัติแล้ว</TableHead>
                  <TableHead className="text-center">รอตรวจสอบ</TableHead>
                  <TableHead className="text-right">ดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student: any) => (
                  <TableRow key={student.studentInfo.student_id}>
                    <TableCell className="font-medium">{student.studentInfo.student_id || "-"}</TableCell>
                    <TableCell>{`${student.studentInfo.first_name} ${student.studentInfo.last_name}`}</TableCell>
                    <TableCell className="text-center">{student.sessions.length}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-success text-success-foreground">{student.completedCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{student.pendingCount}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {student.sessions.map((session: any) => (
                        <Button
                          key={session.id}
                          variant="outline"
                          size="sm"
                          className="ml-2"
                          onClick={() => {
                            setSelectedSession(session);
                            setReviewNotes(session.notes || "");
                          }}
                        >
                          ครั้งที่ {session.session_number}
                        </Button>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>ตรวจสอบใบ Coaching ครั้งที่ {selectedSession?.session_number}</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4">
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                <iframe
                  src={selectedSession.file_url}
                  className="w-full h-full"
                  title="Coaching Form"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">หมายเหตุ</label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="เพิ่มหมายเหตุ (ถ้ามี)"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-success hover:bg-success/90"
                  onClick={() => handleReview(selectedSession.id, "approved")}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  อนุมัติ
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleReview(selectedSession.id, "rejected")}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  ไม่อนุมัติ
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}