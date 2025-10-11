import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Eye, Users, FileCheck, UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppointmentCalendar } from "@/components/AppointmentCalendar";
import { AppointmentManager } from "@/components/AppointmentManager";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Teacher() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [assignedGroups, setAssignedGroups] = useState<any[]>([]);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (selectedSession?.file_url) {
      getSignedUrl(selectedSession.file_url);
    } else {
      setSignedUrl("");
    }
  }, [selectedSession]);

  const getSignedUrl = async (fileUrl: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("coaching-forms")
        .createSignedUrl(fileUrl, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        setSignedUrl(data.signedUrl);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถโหลดไฟล์ได้",
        description: error.message,
      });
    }
  };

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

    if (roleData?.role !== "teacher" && roleData?.role !== "admin" && roleData?.role !== "super_admin") {
      const redirectPath = roleData?.role === "student" ? "/student" : "/auth";
      navigate(redirectPath);
      return;
    }

    setUser(session.user);
    fetchData();
  };

  const fetchData = async () => {
    try {
      const { data: profileRes } = await supabase.from("profiles").select("*").eq("id", user?.id || "").single();
      if (profileRes) setProfile(profileRes);

      // Get teacher's assigned groups with group details
      const { data: assignments } = await supabase
        .from("teacher_assignments")
        .select("*, student_groups(*)")
        .eq("teacher_id", user?.id || "");

      if (!assignments || assignments.length === 0) {
        setStudents([]);
        setAssignedGroups([]);
        setIsLoading(false);
        return;
      }

      setAssignedGroups(assignments);
      const groupIds = assignments.map(a => a.group_id);

      // Get students in assigned groups with member details
      const { data: members } = await supabase
        .from("group_members")
        .select("*, profiles!group_members_student_id_fkey(id, first_name, last_name, student_id)")
        .in("group_id", groupIds);

      if (members) setGroupMembers(members);

      // Get all students for adding to groups
      const { data: studentsData } = await supabase
        .from("profiles")
        .select("*, user_roles!inner(role)")
        .eq("user_roles.role", "student");

      if (studentsData) setAllStudents(studentsData);

      if (!members || members.length === 0) {
        setStudents([]);
        setIsLoading(false);
        return;
      }

      const studentIds = members.map(m => m.student_id);

      // Get coaching sessions for students in assigned groups only
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
        .in("student_id", studentIds)
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

  const handleAddStudentToGroup = async (groupId: string, studentId: string) => {
    try {
      const { error } = await supabase
        .from("group_members")
        .insert({ group_id: groupId, student_id: studentId });

      if (error) throw error;

      // Update student's group_id in profiles
      await supabase
        .from("profiles")
        .update({ group_id: groupId })
        .eq("id", studentId);

      toast({
        title: "เพิ่มนักศึกษาสำเร็จ",
      });

      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  const handleRemoveStudentFromGroup = async (memberId: string, studentId: string) => {
    if (!confirm("ต้องการลบนักศึกษาออกจากกลุ่มนี้หรือไม่?")) return;

    try {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      // Clear student's group_id in profiles
      await supabase
        .from("profiles")
        .update({ group_id: null })
        .eq("id", studentId);

      toast({
        title: "ลบนักศึกษาสำเร็จ",
      });

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
      <Tabs defaultValue="students" className="space-y-6">
        <TabsList>
          <TabsTrigger value="students">นักศึกษา</TabsTrigger>
          <TabsTrigger value="groups">กลุ่มเรียน</TabsTrigger>
          <TabsTrigger value="appointments">นัดหมาย</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="groups" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>กลุ่มเรียนที่รับผิดชอบ</CardTitle>
              <CardDescription>จัดการนักศึกษาในกลุ่มของคุณ</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อกลุ่ม</TableHead>
                    <TableHead>สาขา</TableHead>
                    <TableHead>ชั้นปี</TableHead>
                    <TableHead>จำนวนนักศึกษา</TableHead>
                    <TableHead className="text-right">ดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedGroups.map((assignment: any) => (
                    <React.Fragment key={assignment.id}>
                      <TableRow>
                        <TableCell className="font-medium">{assignment.student_groups?.name}</TableCell>
                        <TableCell>{assignment.student_groups?.major}</TableCell>
                        <TableCell>{assignment.student_groups?.year_level}</TableCell>
                        <TableCell>
                          {groupMembers.filter(m => m.group_id === assignment.group_id).length} คน
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedGroup(selectedGroup === assignment.group_id ? null : assignment.group_id)}
                          >
                            {selectedGroup === assignment.group_id ? "ซ่อน" : "จัดการ"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {selectedGroup === assignment.group_id && (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <div className="p-4 space-y-4 bg-muted/50 rounded-lg">
                              <div className="space-y-2">
                                <h4 className="font-semibold">นักศึกษาในกลุ่ม</h4>
                                <div className="flex gap-2 flex-wrap">
                                  {groupMembers
                                    .filter(m => m.group_id === assignment.group_id)
                                    .map(member => (
                                      <Badge key={member.id} variant="outline" className="gap-2">
                                        {member.profiles?.first_name} {member.profiles?.last_name}
                                        ({member.profiles?.student_id})
                                        <button
                                          onClick={() => handleRemoveStudentFromGroup(member.id, member.student_id)}
                                          className="ml-1 hover:text-destructive"
                                        >
                                          ✕
                                        </button>
                                      </Badge>
                                    ))}
                                </div>
                                <Select onValueChange={(studentId) => handleAddStudentToGroup(assignment.group_id, studentId)}>
                                  <SelectTrigger className="w-[300px]">
                                    <SelectValue placeholder="เพิ่มนักศึกษา" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allStudents
                                      .filter(s => !groupMembers.some(m => m.student_id === s.id && m.group_id === assignment.group_id))
                                      .map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                          {s.first_name} {s.last_name} ({s.student_id})
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="space-y-6">
          <AppointmentCalendar role="teacher" userId={user?.id || ""} />
          <AppointmentManager role="teacher" userId={user?.id || ""} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>ตรวจสอบใบ Coaching ครั้งที่ {selectedSession?.session_number}</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4">
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                {signedUrl ? (
                  <iframe
                    src={signedUrl}
                    className="w-full h-full"
                    title="Coaching Form"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">กำลังโหลดไฟล์...</p>
                  </div>
                )}
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